/**
 * Consent templates. The built-in forms live in code (`consent-catalog.ts`); a hospital writes its own here, once, and
 * every patient's consent can then be made from it. A template has a title and body per language (English is required;
 * Hindi and Gujarati are optional — a patient is only offered the languages the form has). `{{patient_name}}`, `{{age}}`
 * and `{{date}}` in the wording are filled in when a consent is made, and the finished wording is copied onto the
 * consent, so editing or deleting a template later never changes a consent that has already been issued.
 */
import { randomBytes } from "node:crypto";
import { consentTemplatesRepo } from "@/repositories";
import { type ConsentTemplateRow } from "@/db/tables";
import { ValidationError } from "@/lib/errors";
import { localDate } from "@/lib/clock";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import { type ConsentTemplateDTO } from "@shared/types/api";
import { CONSENT_FORMS, CONSENT_LANGUAGES, type ConsentLanguage } from "@shared/types/consent-catalog";

const MAX_TITLE = 120;
const MAX_BODY = 4000;
export const PLACEHOLDERS = ["{{patient_name}}", "{{age}}", "{{date}}"] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const prettyDate = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };

/** Fill `{{patient_name}}`, `{{age}}`, `{{date}}` in a piece of wording. */
export function fillPlaceholders(text: string, vars: { patientName: string; age: number | null }): string {
  return text
    .replace(/\{\{\s*patient_name\s*\}\}/gi, vars.patientName)
    .replace(/\{\{\s*age\s*\}\}/gi, vars.age != null ? String(vars.age) : "")
    .replace(/\{\{\s*date\s*\}\}/gi, prettyDate(localDate()));
}

const builtIns = (): ConsentTemplateDTO[] =>
  CONSENT_FORMS.map((f) => ({ key: f.key, id: null, builtIn: true, titles: { ...f.title }, bodies: { ...f.body }, languages: [...CONSENT_LANGUAGES], active: true }));

const toDto = (r: ConsentTemplateRow): ConsentTemplateDTO => ({
  key: r.key, id: r.id, builtIn: false, titles: r.titles ?? {}, bodies: r.bodies ?? {},
  languages: CONSENT_LANGUAGES.filter((l) => (r.bodies ?? {})[l]), active: r.active !== false,
});

/** The built-in forms, then the hospital's own (oldest first). */
export async function listTemplates(actor: Session): Promise<ConsentTemplateDTO[]> {
  const { rows } = await consentTemplatesRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "asc" }] }, actor));
  return [...builtIns(), ...(rows as ConsentTemplateRow[]).map(toDto)];
}

/** The template a consent is made from: a built-in one, or one of the hospital's that is switched on. */
export async function resolveTemplate(key: string, actor: Session): Promise<ConsentTemplateDTO> {
  const found = (await listTemplates(actor)).find((t) => t.key === key);
  if (!found || !found.active) throw new ValidationError([{ field: "template", message: "choose one of the listed forms" }]);
  return found;
}

/** Read and check the wording posted for a template. English is required; another language needs both its title and body. */
function parseWording(body: Record<string, unknown>, existing?: ConsentTemplateRow): { titles: Record<string, string>; bodies: Record<string, string> } {
  const inTitles = (body.titles ?? {}) as Record<string, unknown>;
  const inBodies = (body.bodies ?? {}) as Record<string, unknown>;
  const titles: Record<string, string> = {};
  const bodies: Record<string, string> = {};
  const errors: { field: string; message: string }[] = [];
  for (const l of CONSENT_LANGUAGES as readonly ConsentLanguage[]) {
    const t = String(inTitles[l] ?? (existing && !(l in inTitles) ? existing.titles?.[l] ?? "" : "")).trim();
    const b = String(inBodies[l] ?? (existing && !(l in inBodies) ? existing.bodies?.[l] ?? "" : "")).trim();
    if (!t && !b) { if (l === "English") errors.push({ field: "titles.English", message: "an English title and text are required" }); continue; }
    if (t.length < 3) errors.push({ field: `titles.${l}`, message: `give the ${l} title (at least 3 characters)` });
    if (t.length > MAX_TITLE) errors.push({ field: `titles.${l}`, message: `the ${l} title is too long (${MAX_TITLE} characters at most)` });
    if (b.length < 20) errors.push({ field: `bodies.${l}`, message: `give the ${l} text (at least 20 characters)` });
    if (b.length > MAX_BODY) errors.push({ field: `bodies.${l}`, message: `the ${l} text is too long (${MAX_BODY} characters at most)` });
    titles[l] = t;
    bodies[l] = b;
  }
  const known = new Set<string>(["patient_name", "age", "date"]);
  for (const l of Object.keys(bodies)) for (const m of `${titles[l]} ${bodies[l]}`.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)) {
    if (!known.has(m[1].toLowerCase())) errors.push({ field: `bodies.${l}`, message: `{{${m[1]}}} isn't a placeholder — use ${PLACEHOLDERS.join(", ")}` });
  }
  if (errors.length) throw new ValidationError(errors);
  return { titles, bodies };
}

export async function createTemplate(input: unknown, actor: Session): Promise<ConsentTemplateDTO> {
  const body = (input ?? {}) as Record<string, unknown>;
  const { titles, bodies } = parseWording(body);
  const dupe = (await listTemplates(actor)).find((t) => t.titles.English.trim().toLowerCase() === titles.English.toLowerCase());
  if (dupe) throw new ValidationError([{ field: "titles.English", message: `a form called "${dupe.titles.English}" already exists` }]);
  const row = await consentTemplatesRepo.create({
    hospital_id: requireHospitalId(actor), key: `custom-${randomBytes(4).toString("hex")}`, titles, bodies, active: body.active !== false, created_by: actor.name,
  });
  await audit(actor, "create", "consent-template", row.id, { title: titles.English });
  return toDto(row as ConsentTemplateRow);
}

async function ownedCustom(id: number, actor: Session): Promise<ConsentTemplateRow> {
  const row = await consentTemplatesRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Template");
  return row as ConsentTemplateRow;
}

/** Edit a custom template's wording or switch it on / off. Consents already made keep the wording they were made with. */
export async function updateTemplate(id: number, input: unknown, actor: Session): Promise<ConsentTemplateDTO> {
  const existing = await ownedCustom(id, actor);
  const body = (input ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if ("titles" in body || "bodies" in body) {
    const w = parseWording(body, existing);
    const dupe = (await listTemplates(actor)).find((t) => t.key !== existing.key && t.titles.English.trim().toLowerCase() === w.titles.English.toLowerCase());
    if (dupe) throw new ValidationError([{ field: "titles.English", message: `a form called "${dupe.titles.English}" already exists` }]);
    patch.titles = w.titles;
    patch.bodies = w.bodies;
  }
  if ("active" in body) patch.active = body.active !== false;
  const row = await consentTemplatesRepo.update(id, patch);
  await audit(actor, "update", "consent-template", id, { fields: Object.keys(patch) });
  return toDto(row as ConsentTemplateRow);
}

export async function deleteTemplate(id: number, actor: Session): Promise<void> {
  const existing = await ownedCustom(id, actor);
  await consentTemplatesRepo.remove(id);
  await audit(actor, "delete", "consent-template", id, { title: existing.titles?.English });
}
