/**
 * Prescription quick templates — a doctor's personal, reusable set of
 * medicines they can drop into a new prescription in one click. Private per
 * doctor: every read/write is scoped to the requesting doctor's own rows.
 */
import { prescriptionTemplatesRepo, medicinesRepo } from "@/repositories";
import { toPrescriptionTemplateDTO } from "@/repositories/mappers";
import { type PrescriptionTemplateRow } from "@/db/tables";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { prescriptionTemplates as DEFAULT_TEMPLATES } from "@/db/sample-data/medicines";
import { requireHospitalId } from "@/services/hospital-scope";

const DEFAULT_TEMPLATE_LABELS: Record<string, string> = {
  fever: "Fever",
  diabetes: "Diabetes",
  hypertension: "Hypertension",
  cold: "Cold / URTI",
  acidity: "Acidity",
};

/**
 * A brand-new doctor account starts with no templates. Rather than shipping
 * a separate, uneditable set of "built-in" presets, we give every doctor
 * their own private copy of the standard starter set on first visit — so
 * they can rename, edit, or delete them exactly like anything else they save.
 */
async function seedDefaultTemplates(doctorId: number, hospitalId: number): Promise<void> {
  const { rows: meds } = await medicinesRepo.listRows({ unpaged: true });
  const byId = new Map(meds.map((m) => [m.id, m]));

  for (const [key, items] of Object.entries(DEFAULT_TEMPLATES)) {
    const resolved = items
      .map((it) => {
        const med = byId.get(it.medicineId);
        if (!med) return null;
        return {
          medicineId: med.id,
          medicineName: med.name,
          dosage: it.dosage,
          frequency: it.frequency,
          duration: it.duration,
          instructions: it.instructions,
        };
      })
      .filter((it): it is NonNullable<typeof it> => it !== null);

    if (resolved.length === 0) continue;
    await prescriptionTemplatesRepo.create({
      hospital_id: hospitalId,
      doctor_id: doctorId,
      name: DEFAULT_TEMPLATE_LABELS[key] ?? key,
      items: resolved,
    });
  }
}

interface TemplateItemInput {
  medicineId?: unknown;
  medicineName?: unknown;
  dosage?: unknown;
  frequency?: unknown;
  duration?: unknown;
  instructions?: unknown;
}

const headerSchema = {
  name: { type: "string", required: true, min: 2, max: 80 },
} as const;

function normalizeItems(input: unknown): {
  medicineId: number | null;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}[] {
  if (!Array.isArray(input)) return [];
  return (input as TemplateItemInput[])
    .map((it) => ({
      medicineId: typeof it?.medicineId === "number" ? it.medicineId : null,
      medicineName: String(it?.medicineName ?? "").trim(),
      dosage: String(it?.dosage ?? "").trim(),
      frequency: String(it?.frequency ?? "").trim(),
      duration: String(it?.duration ?? "").trim(),
      instructions: String(it?.instructions ?? "").trim(),
    }))
    .filter((it) => it.medicineName.length > 0);
}

function requireDoctor(actor: Session): number {
  if (actor.doctorId == null) {
    throw new ForbiddenError("Only doctor accounts can manage prescription templates");
  }
  return actor.doctorId;
}

/** List the requesting doctor's own templates. Non-doctor accounts see none. */
export async function listPrescriptionTemplates(actor: Session) {
  if (actor.doctorId == null) return { rows: [], total: 0 };
  const doctorId = actor.doctorId;
  const query = {
    filters: [{ column: "doctor_id", op: "eq" as const, value: doctorId }],
    sort: [{ column: "id" as const, direction: "asc" as const }],
    unpaged: true,
  };
  const existing = await prescriptionTemplatesRepo.list(query);
  if (existing.total > 0) return existing;
  await seedDefaultTemplates(doctorId, requireHospitalId(actor));
  return prescriptionTemplatesRepo.list(query);
}

export async function createPrescriptionTemplate(input: unknown, actor: Session) {
  const doctorId = requireDoctor(actor);
  const data = validate(headerSchema, input);
  const items = normalizeItems((input as { items?: unknown }).items);
  if (items.length === 0) {
    throw new BadRequestError("Template needs at least one medicine");
  }
  const row = await prescriptionTemplatesRepo.create({
    hospital_id: requireHospitalId(actor),
    doctor_id: doctorId,
    name: data.name,
    items,
  });
  await audit(actor, "create", "prescription_template", row.id, { name: data.name });
  return toPrescriptionTemplateDTO(row as PrescriptionTemplateRow);
}

async function loadOwned(id: number, actor: Session): Promise<PrescriptionTemplateRow> {
  const doctorId = requireDoctor(actor);
  const row = await prescriptionTemplatesRepo.getRow(id);
  if (!row) throw new NotFoundError("Prescription template");
  if (row.doctor_id !== doctorId) {
    throw new ForbiddenError("You can only manage your own templates");
  }
  return row;
}

export async function updatePrescriptionTemplate(id: number, input: unknown, actor: Session) {
  await loadOwned(id, actor);
  const data = validatePartial(headerSchema, input);
  const patch: Record<string, unknown> = {};
  if ("name" in data) patch.name = data.name;
  if (Array.isArray((input as { items?: unknown }).items)) {
    const items = normalizeItems((input as { items: unknown }).items);
    if (items.length === 0) throw new BadRequestError("Template needs at least one medicine");
    patch.items = items;
  }
  const row = await prescriptionTemplatesRepo.update(id, patch);
  await audit(actor, "update", "prescription_template", id, patch);
  return toPrescriptionTemplateDTO(row as PrescriptionTemplateRow);
}

export async function deletePrescriptionTemplate(id: number, actor: Session) {
  await loadOwned(id, actor);
  await prescriptionTemplatesRepo.remove(id);
  await audit(actor, "delete", "prescription_template", id);
}
