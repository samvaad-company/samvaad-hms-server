/**
 * Notes a doctor keeps to use again.
 *
 * A "remark" belongs to the doctor (their own list, found again by typing a few letters). "Advice" is kept for one patient, so it is
 * there to pick the next time that patient is seen.
 */
import { savedNotesRepo, doctorsRepo, patientsRepo } from "@/repositories";
import { toSavedNoteDTO } from "@/repositories/mappers";
import { type SavedNoteRow } from "@/db/tables";
import { BadRequestError, ForbiddenError } from "@/lib/errors";
import { type Session } from "@/auth/session";
import { assertOwnedByHospital, requireHospitalId, scopeToHospital } from "@/services/hospital-scope";

const clean = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ").slice(0, 600);
const key = (s: string) => s.toLowerCase();

async function doctorOf(actor: Session, requested?: number | null): Promise<number> {
  const id = actor.doctorId ?? requested ?? null;
  if (id == null) throw new BadRequestError("Choose the doctor first");
  if (actor.doctorId != null && requested != null && requested !== actor.doctorId) throw new ForbiddenError("You can only use your own remarks");
  assertOwnedByHospital(await doctorsRepo.getRow(id), actor, "Doctor");
  return id;
}

async function rowsOf(filters: { column: string; op: "eq"; value: unknown }[], actor: Session): Promise<SavedNoteRow[]> {
  const { rows } = await savedNotesRepo.listRows(scopeToHospital({ unpaged: true, filters } as never, actor));
  return rows as SavedNoteRow[];
}

export async function listSavedNotes(actor: Session, opts: { kind: string; doctorId?: number | null; patientId?: number | null; q?: string; limit?: number }) {
  const q = key(clean(opts.q));
  if (opts.kind === "advice") {
    if (opts.patientId == null) return [];
    assertOwnedByHospital(await patientsRepo.getRow(opts.patientId), actor, "Patient");
    const rows = await rowsOf([{ column: "patient_id", op: "eq", value: opts.patientId }], actor);
    return rows.filter((r) => r.kind === "advice" && (!q || key(r.text).includes(q)))
      .sort((a, b) => b.id - a.id).slice(0, opts.limit ?? 50).map(toSavedNoteDTO);
  }
  if (actor.doctorId == null && opts.doctorId == null) return [];
  const doctorId = await doctorOf(actor, opts.doctorId);
  const rows = await rowsOf([{ column: "doctor_id", op: "eq", value: doctorId }], actor);
  return rows.filter((r) => r.kind === "remark" && (!q || key(r.text).includes(q)))
    .sort((a, b) => (b.use_count ?? 0) - (a.use_count ?? 0) || b.id - a.id).slice(0, opts.limit ?? 50).map(toSavedNoteDTO);
}

/** Keeps a remark (doctor's list) or advice (for a patient); the same words again are not repeated, they count as used. */
export async function addSavedNote(input: unknown, actor: Session) {
  const body = (input ?? {}) as { kind?: unknown; text?: unknown; doctorId?: unknown; patientId?: unknown; used?: unknown };
  const kind = body.kind === "advice" ? "advice" : "remark";
  const text = clean(body.text);
  if (text.length < 2) throw new BadRequestError(kind === "advice" ? "Type the advice first" : "Type the remark first");
  const hospitalId = requireHospitalId(actor);
  let doctorId: number | null = null;
  let patientId: number | null = null;
  if (kind === "advice") {
    patientId = typeof body.patientId === "number" ? body.patientId : null;
    if (patientId == null) throw new BadRequestError("Choose the patient first");
    assertOwnedByHospital(await patientsRepo.getRow(patientId), actor, "Patient");
    doctorId = actor.doctorId ?? (typeof body.doctorId === "number" ? body.doctorId : null);
  } else {
    doctorId = await doctorOf(actor, typeof body.doctorId === "number" ? body.doctorId : null);
  }
  const existing = (await rowsOf(kind === "advice" ? [{ column: "patient_id", op: "eq", value: patientId }] : [{ column: "doctor_id", op: "eq", value: doctorId }], actor))
    .find((r) => r.kind === kind && key(r.text) === key(text));
  const used = body.used === true ? 1 : 0;
  if (existing) {
    if (!used) return toSavedNoteDTO(existing);
    return toSavedNoteDTO((await savedNotesRepo.update(existing.id, { use_count: (existing.use_count ?? 0) + 1 })) as SavedNoteRow);
  }
  return toSavedNoteDTO((await savedNotesRepo.create({ hospital_id: hospitalId, doctor_id: doctorId, patient_id: patientId, kind, text, use_count: used })) as SavedNoteRow);
}

export async function deleteSavedNote(id: number, actor: Session) {
  const row = await savedNotesRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Note");
  if (row.kind === "remark" && actor.doctorId != null && row.doctor_id !== actor.doctorId) throw new ForbiddenError("You can only remove your own remarks");
  await savedNotesRepo.remove(id);
}
