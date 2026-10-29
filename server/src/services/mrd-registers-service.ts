/**
 * MRD statutory registers — birth and death.
 *
 * Entries are permanent. A correction is a new entry that amends the old one (the old one is marked superseded and
 * keeps its number and text), so the register always shows what was originally written and what replaced it.
 * Entry numbers run per register and year (BR/2026/00001, DR/2026/00001) and are issued one at a time.
 */
import { mrdRegisterEntriesRepo } from "@/repositories";
import { toMrdRegisterEntryDTO } from "@/repositories/mappers";
import { TABLES, type MrdRegisterEntryRow } from "@/db/tables";
import { transactional } from "@/db/unit-of-work";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { localDate } from "@/lib/clock";
import { withKeyLocks } from "@/lib/key-lock";
import { nextCode } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import { MRD_REGISTERS, type MrdRegisterDTO, type MrdRegisterFieldDTO, type MrdRegisterKind } from "@shared/types/api";

const SEX = ["male", "female", "other"];

const f = (key: string, label: string, kind: MrdRegisterFieldDTO["kind"] = "text", required = false, extra: Partial<MrdRegisterFieldDTO> = {}): MrdRegisterFieldDTO => ({ key, label, required, kind, ...extra });

const FIELDS: Record<MrdRegisterKind, MrdRegisterFieldDTO[]> = {
  birth: [
    f("motherName", "Mother's name", "text", true),
    f("babySex", "Baby sex", "select", true, { options: SEX }),
    f("weightG", "Weight (g)", "number"),
    f("timeOfBirth", "Time of birth", "time", true),
    f("deliveryType", "Type of delivery", "text", true, { suggestions: ["Normal vaginal", "Caesarean section", "Assisted (forceps / vacuum)"] }),
    f("attendant", "Attendant"),
    f("fatherName", "Father's name"),
    f("address", "Address"),
    f("remarks", "Remarks"),
  ],
  death: [
    f("deceasedName", "Name of the deceased", "text", true),
    f("sex", "Sex", "select", true, { options: SEX }),
    f("age", "Age", "text", true),
    f("timeOfDeath", "Time of death", "time", true),
    f("causeOfDeath", "Cause of death", "text", true),
    f("placeOfDeath", "Place of death", "text", false, { suggestions: ["Ward", "ICU", "Emergency", "Operation theatre"] }),
    f("certifiedBy", "Certified by (doctor)"),
    f("informant", "Informant"),
    f("address", "Address"),
    f("remarks", "Remarks"),
  ],
};

const PREFIX: Record<MrdRegisterKind, string> = { birth: "BR", death: "DR" };

function kindOf(raw: string): MrdRegisterKind {
  if (raw === "birth" || raw === "death") return raw;
  throw new NotFoundError("Register");
}

const titleOf = (kind: MrdRegisterKind) => MRD_REGISTERS.find((r) => r.kind === kind)!.title;

/** Check the posted values against the register's field list; returns the cleaned data object. */
function cleanData(kind: MrdRegisterKind, body: Record<string, unknown>): Record<string, string> {
  const errors: { field: string; message: string }[] = [];
  const out: Record<string, string> = {};
  for (const spec of FIELDS[kind]) {
    const v = String(body[spec.key] ?? "").trim();
    if (!v) { if (spec.required) errors.push({ field: spec.key, message: "is required" }); continue; }
    if (v.length > 200) { errors.push({ field: spec.key, message: "must be at most 200 characters" }); continue; }
    if (spec.kind === "select" && !spec.options!.includes(v)) { errors.push({ field: spec.key, message: `must be one of ${spec.options!.join(", ")}` }); continue; }
    if (spec.kind === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) { errors.push({ field: spec.key, message: "must be a time like 14:30" }); continue; }
    if (spec.kind === "number" && !(Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) <= 10000)) { errors.push({ field: spec.key, message: "must be a positive number" }); continue; }
    out[spec.key] = v;
  }
  if (kind === "birth" && out.weightG && (Number(out.weightG) < 200 || Number(out.weightG) > 7000)) errors.push({ field: "weightG", message: "looks wrong — enter grams, between 200 and 7000" });
  if (errors.length) throw new ValidationError(errors);
  return out;
}

function entryDateOf(raw: unknown): string {
  const v = String(raw ?? "").trim() || localDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(new Date(v).getTime())) throw new ValidationError([{ field: "entryDate", message: "must be a date" }]);
  if (v > localDate()) throw new ValidationError([{ field: "entryDate", message: "can't be in the future" }]);
  return v;
}

/** A register with its entries (oldest first). `months` keeps only recent entries — the printout asks for 12. */
export async function getRegister(rawKind: string, actor: Session, months?: number): Promise<MrdRegisterDTO> {
  const kind = kindOf(rawKind);
  const { rows } = await mrdRegisterEntriesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "register", op: "eq", value: kind }], sort: [{ column: "id", direction: "asc" }] }, actor));
  let entries = (rows as MrdRegisterEntryRow[]).map(toMrdRegisterEntryDTO);
  if (months && months > 0) {
    const [y, m, d] = localDate().split("-").map(Number);
    const cut = new Date(Date.UTC(y, m - 1 - months, d)).toISOString().slice(0, 10);
    entries = entries.filter((e) => e.entryDate >= cut);
  }
  return { kind, title: titleOf(kind), fields: FIELDS[kind], entries };
}

async function writeEntry(kind: MrdRegisterKind, body: Record<string, unknown>, actor: Session, amends: MrdRegisterEntryRow | null) {
  const data = cleanData(kind, body);
  const entryDate = entryDateOf(body.entryDate);
  const reportTo = String(body.reportTo ?? "").trim().slice(0, 120);
  const hospitalId = requireHospitalId(actor);
  if (amends) {
    const reason = String(body.amendmentReason ?? "").trim();
    if (reason.length < 3) throw new ValidationError([{ field: "amendmentReason", message: "say what is being corrected and why" }]);
    data.amendmentReason = reason.slice(0, 200);
  }
  return withKeyLocks([`register:${hospitalId}:${kind}`], async () => {
    if (amends) {
      const current = (await mrdRegisterEntriesRepo.getRow(amends.id)) as MrdRegisterEntryRow;
      if (current.superseded_by != null) throw new ConflictError(`${current.entry_no} has already been amended — amend the latest entry instead`);
    }
    const { rows } = await mrdRegisterEntriesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "register", op: "eq", value: kind }] }, actor));
    const entryNo = nextCode(rows.map((r) => r.entry_no), `${PREFIX[kind]}/${entryDate.slice(2, 4)}/`, 5);
    const now = new Date().toISOString();
    return transactional("mrd.register-entry", async (uow) => {
      const row = await uow.insert<MrdRegisterEntryRow>(TABLES.mrdRegisterEntries, {
        hospital_id: hospitalId, register: kind, entry_no: entryNo, entry_date: entryDate, data, report_to: reportTo,
        filed_by: actor.name, filed_at: now, amends_id: amends?.id ?? null, superseded_by: null,
      });
      if (amends) await uow.update(TABLES.mrdRegisterEntries, amends.id, { superseded_by: row.id });
      return row;
    });
  });
}

export async function fileEntry(rawKind: string, input: unknown, actor: Session) {
  const kind = kindOf(rawKind);
  const row = await writeEntry(kind, (input ?? {}) as Record<string, unknown>, actor, null);
  await audit(actor, "file", `mrd-register-${kind}`, row.id, { entryNo: row.entry_no });
  return toMrdRegisterEntryDTO(row as MrdRegisterEntryRow);
}

/** Correct an entry: files a new one that supersedes it. */
export async function amendEntry(rawKind: string, id: number, input: unknown, actor: Session) {
  const kind = kindOf(rawKind);
  const old = await mrdRegisterEntriesRepo.getRow(id);
  assertOwnedByHospital(old, actor, "Register entry");
  if (old!.register !== kind) throw new NotFoundError("Register entry");
  const row = await writeEntry(kind, (input ?? {}) as Record<string, unknown>, actor, old as MrdRegisterEntryRow);
  await audit(actor, "amend", `mrd-register-${kind}`, row.id, { amends: old!.entry_no, entryNo: row.entry_no });
  return toMrdRegisterEntryDTO(row as MrdRegisterEntryRow);
}
