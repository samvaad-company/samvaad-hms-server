/**
 * The IPD case file: the forms kept with an admitted patient (progress notes, treatment sheet, TPR chart, handover, investigation sheet…).
 *
 * Each form is saved whole, as JSON, one record per form per admission. Staff with access edit them; a save carries the version the
 * person loaded, and if someone else saved in between, the save is refused (409) rather than overwriting their work.
 * What the rest of the app already holds about the patient (vitals, doctor rounds, medicines and their doses, IV lines, handovers, lab
 * orders, prescriptions) is read and returned alongside, so the forms show it without anyone typing it twice. Everything is scoped to the
 * admission's own hospital.
 */
import {
  caseFileEntriesRepo, hospitalsRepo, ipdDoseLogRepo, ipdHandoversRepo, ipdIvLinesRepo, ipdMedicationsRepo, ipdNotesRepo, ipdRepo, ipdVitalsRepo,
  labRepo, patientsRepo, prescriptionItemsRepo, prescriptionsRepo, setupRecordsRepo,
} from "@/repositories";
import type {
  CaseFileEntryRow, HospitalRow, IpdAdmissionRow, IpdDoseLogRow, IpdHandoverRow, IpdIvLineRow, IpdMedicationRow, IpdNoteRow, IpdVitalRow, LabTestRow,
  PatientRow, PrescriptionItemRow, PrescriptionRow, SetupRecordRow,
} from "@/db/tables";
import { type Session } from "@/auth/session";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { assertOwnedByHospital, requireHospitalId, scopeToHospital } from "@/services/hospital-scope";
import { audit } from "@/services/audit";
import { TZ, localDate } from "@/lib/clock";
import { datesBetween, doseSlots } from "@/services/ipd-schedule";
import { CASE_FILE_FORMS, type CaseFormKey, type CaseFileDTO, type CaseFileLinkedDTO, type CaseFileListItemDTO, type CaseFormRecordDTO } from "@shared/types/casefile";

const MAX_JSON_CHARS = 250_000;
const MAX_TEXT = 5_000;
const MAX_ARRAY = 500;
const MAX_DEPTH = 7;
/** How many days of medicine doses are worked out for the treatment sheet. */
const MAX_DOSE_DAYS = 60;

const isKey = (k: unknown): k is (typeof CASE_FILE_FORMS)[number] => typeof k === "string" && (CASE_FILE_FORMS as readonly string[]).includes(k);

async function loadAdmission(id: number, actor: Session): Promise<IpdAdmissionRow> {
  const row = (await ipdRepo.getRow(id)) as IpdAdmissionRow | null;
  assertOwnedByHospital(row, actor, "Admission");
  return row as IpdAdmissionRow;
}

/** Keeps the shape staff can reasonably have typed: plain objects, arrays, short strings, numbers and booleans. */
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return null;
  if (typeof value === "string") return value.slice(0, MAX_TEXT);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY).map((v) => sanitize(v, depth + 1));
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 400)) {
      if (k.length > 60 || k === "__proto__" || k === "constructor" || k === "prototype") continue;
      out[k] = sanitize(v, depth + 1);
    }
    return out;
  }
  return null;
}

/** True when a form has anything written in it. */
function hasContent(v: unknown): boolean {
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "number") return true;
  if (typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.some(hasContent);
  if (typeof v === "object" && v !== null) return Object.values(v).some(hasContent);
  return false;
}

const timeOf = (iso: string): string => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const dateOf = (iso: string): string => localDate(new Date(iso));
const fahrenheit = (c: number | null): number | null => (c == null ? null : Math.round((c * 9 / 5 + 32) * 10) / 10);

/** Which of the sheet's four windows (8am–2pm, 2pm–8pm, 8pm–2am, 2am–8am) an instant falls in. */
function windowOf(iso: string): number {
  const [h] = timeOf(iso).split(":").map(Number);
  if (h >= 8 && h < 14) return 0;
  if (h >= 14 && h < 20) return 1;
  if (h >= 20 || h < 2) return 2;
  return 3;
}

async function byAdmission<T>(repo: { listRows: (o: never) => Promise<{ rows: unknown[] }> }, admissionId: number): Promise<T[]> {
  const { rows } = await repo.listRows({ unpaged: true, filters: [{ column: "admission_id", op: "eq", value: admissionId }] } as never);
  return rows as T[];
}

async function linkedFor(adm: IpdAdmissionRow, actor: Session): Promise<CaseFileLinkedDTO> {
  const patientFilter = adm.patient_id ? { unpaged: true, filters: [{ column: "patient_id", op: "eq" as const, value: adm.patient_id }] } : null;
  const [vitals, notes, meds, doses, iv, handovers] = await Promise.all([
    byAdmission<IpdVitalRow>(ipdVitalsRepo as never, adm.id), byAdmission<IpdNoteRow>(ipdNotesRepo as never, adm.id), byAdmission<IpdMedicationRow>(ipdMedicationsRepo as never, adm.id),
    byAdmission<IpdDoseLogRow>(ipdDoseLogRepo as never, adm.id), byAdmission<IpdIvLineRow>(ipdIvLinesRepo as never, adm.id), byAdmission<IpdHandoverRow>(ipdHandoversRepo as never, adm.id),
  ]);

  // Doses on the sheet's four windows, for each day the medicine runs (capped so a very long stay stays quick).
  const today = localDate();
  const from = adm.admission_date || today;
  const to = today > from ? today : from;
  const span = datesBetween(from, to);
  const days = span.length > MAX_DOSE_DAYS ? span.slice(span.length - MAX_DOSE_DAYS) : span;
  const medicines: CaseFileLinkedDTO["medicines"] = meds.sort((a, b) => a.id - b.id).map((m) => {
    const slots = doseSlots([{ ...m, status: "Active" }], doses, days[0], days[days.length - 1]);
    const perDay: Record<string, ("" | "due" | "given" | "held")[]> = {};
    const givenBy: Record<string, string[]> = {};
    for (const s of slots) {
      const d = dateOf(s.scheduledAt), w = windowOf(s.scheduledAt);
      perDay[d] ??= ["", "", "", ""]; givenBy[d] ??= ["", "", "", ""];
      perDay[d][w] = s.state === "given" ? "given" : s.state === "held" ? "held" : "due";
      if (s.givenBy) givenBy[d][w] = s.givenBy;
    }
    return { id: m.id, name: m.medicine_name, dosage: m.dosage, frequency: m.frequency, route: m.route, start: m.start_date, end: m.end_date, status: m.status, days: perDay, givenBy };
  });

  // The same patient's prescriptions written since admission.
  const prescriptions: CaseFileLinkedDTO["prescriptions"] = [];
  const labTests: CaseFileLinkedDTO["labTests"] = [];
  if (patientFilter) {
    const rx = ((await prescriptionsRepo.listRows(scopeToHospital(patientFilter, actor))).rows as PrescriptionRow[]).filter((r) => r.prescribed_date >= from).sort((a, b) => a.prescribed_date.localeCompare(b.prescribed_date) || a.id - b.id);
    for (const r of rx) {
      const items = ((await prescriptionItemsRepo.listRows({ unpaged: true, filters: [{ column: "prescription_id", op: "eq", value: r.id }] } as never)).rows as PrescriptionItemRow[]).sort((a, b) => a.id - b.id);
      prescriptions.push({ rx: r.rx_number, date: r.prescribed_date, doctor: r.doctor, diagnosis: r.diagnosis, items: items.map((i) => ({ name: i.medicine_name, dosage: i.dosage, frequency: i.frequency, duration: i.duration, instructions: i.instructions ?? "" })) });
    }
    const labs = ((await labRepo.listRows(scopeToHospital(patientFilter, actor))).rows as LabTestRow[]).filter((t) => t.test_date >= from).sort((a, b) => a.test_date.localeCompare(b.test_date) || a.id - b.id);
    for (const t of labs) labTests.push({ name: t.test_name, date: t.test_date, status: t.report_status || t.status, orderNumber: t.order_number });
  }

  return {
    vitals: vitals.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)).map((v) => ({
      at: v.recorded_at, date: dateOf(v.recorded_at), time: timeOf(v.recorded_at), tempF: fahrenheit(v.temp_c), pulse: v.pulse, rr: v.resp_rate,
      bp: v.bp_systolic != null && v.bp_diastolic != null ? `${v.bp_systolic}/${v.bp_diastolic}` : "", spo2: v.spo2, note: v.note, by: v.recorded_by,
    })),
    doctorNotes: notes.filter((n) => n.note_type === "Doctor Round").sort((a, b) => `${a.note_date} ${a.note_time}`.localeCompare(`${b.note_date} ${b.note_time}`)).map((n) => ({ date: n.note_date, time: n.note_time, by: n.author, text: n.content })),
    dailyNotes: notes.filter((n) => n.note_type === "Daily Note").sort((a, b) => `${a.note_date} ${a.note_time}`.localeCompare(`${b.note_date} ${b.note_time}`)).map((n) => ({ date: n.note_date, time: n.note_time, by: n.author, text: n.content })),
    medicines,
    prescriptions,
    ivLines: iv.sort((a, b) => a.started_at.localeCompare(b.started_at)).map((l) => ({ date: dateOf(l.started_at), time: timeOf(l.started_at), fluid: l.fluid, volumeMl: l.volume_ml, rateMlHr: l.rate_ml_hr, status: l.status, by: l.started_by })),
    handovers: handovers.sort((a, b) => a.shift_date.localeCompare(b.shift_date) || a.id - b.id).map((h) => ({ date: h.shift_date, shift: h.shift, note: h.note, author: h.author })),
    labTests,
  };
}

const recordOf = (r: CaseFileEntryRow | undefined): CaseFormRecordDTO => (r ? { data: r.data ?? {}, version: r.version, updatedAt: r.updated_at, updatedBy: r.updated_by } : { data: {}, version: 0, updatedAt: null, updatedBy: "" });

async function entriesOf(admissionId: number): Promise<CaseFileEntryRow[]> {
  return byAdmission<CaseFileEntryRow>(caseFileEntriesRepo as never, admissionId);
}

// ── The order the hospital keeps its forms in ────────────────────────────────────────────────────────────────────────────

const ORDER_KIND = "config:casefile_order";

async function orderRecord(hospitalId: number): Promise<SetupRecordRow | undefined> {
  const { rows } = await setupRecordsRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: hospitalId }, { column: "kind", op: "eq", value: ORDER_KIND }] } as never);
  return (rows as SetupRecordRow[])[0];
}

/** A saved order cleaned up: only real forms, none twice, and any form it doesn't mention goes at the end in the standard order. */
function completeOrder(saved: unknown): CaseFormKey[] {
  const out: CaseFormKey[] = [];
  if (Array.isArray(saved)) for (const k of saved) if (isKey(k) && !out.includes(k)) out.push(k);
  for (const k of CASE_FILE_FORMS) if (!out.includes(k)) out.push(k);
  return out;
}

/** The order this hospital's staff see the forms in: the standard order until the hospital's admin rearranges it. */
export async function getFormOrder(actor: Session): Promise<CaseFormKey[]> {
  const hid = requireHospitalId(actor);
  return completeOrder(((await orderRecord(hid))?.data as { order?: unknown } | undefined)?.order);
}

/** `{ order: [every form key, in the new order] }` or `{ reset: true }`. Only the hospital's Super Admin. */
export async function saveFormOrder(input: unknown, actor: Session): Promise<CaseFormKey[]> {
  const hid = requireHospitalId(actor);
  if (actor.role !== "Super Admin") throw new ForbiddenError("Only the hospital's admin can rearrange the forms.");
  const body = (typeof input === "object" && input !== null ? input : {}) as { order?: unknown; reset?: unknown };
  let order: CaseFormKey[];
  if (body.reset === true) order = [...CASE_FILE_FORMS];
  else {
    const given = Array.isArray(body.order) ? body.order : null;
    if (!given || given.length !== CASE_FILE_FORMS.length || !given.every(isKey) || new Set(given).size !== given.length) {
      throw new ValidationError([{ field: "order", message: `send all ${CASE_FILE_FORMS.length} forms, each once, in the order you want` }]);
    }
    order = given as CaseFormKey[];
  }
  const row = await orderRecord(hid);
  const data = { order };
  if (row) await setupRecordsRepo.update(row.id, { data: data as never } as never);
  else await setupRecordsRepo.create({ hospital_id: hid, kind: ORDER_KIND, code: "", name: "case file order", active: true, sort_order: 0, data } as never);
  await audit(actor, body.reset === true ? "casefile.order_reset" : "casefile.order", "case_file", "order", { first: order[0] });
  return order;
}

/** The whole case file of one admission. */
export async function getCaseFile(admissionId: number, actor: Session): Promise<CaseFileDTO> {
  const hid = requireHospitalId(actor);
  const adm = await loadAdmission(admissionId, actor);
  const [hospital, patient, entries, linked] = await Promise.all([
    hospitalsRepo.getRow(hid) as Promise<HospitalRow | null>,
    adm.patient_id ? (patientsRepo.getRow(adm.patient_id) as Promise<PatientRow | null>) : Promise.resolve(null),
    entriesOf(adm.id),
    linkedFor(adm, actor),
  ]);
  const forms: Record<string, CaseFormRecordDTO> = {};
  for (const key of CASE_FILE_FORMS) forms[key] = recordOf(entries.find((e) => e.form_key === key));
  return {
    hospital: { name: hospital?.name ?? "", address: hospital?.address ?? "", city: hospital?.city ?? "", phone: hospital?.phone ?? "", email: hospital?.email ?? "" },
    patient: { id: adm.patient_id, name: adm.patient_name, age: adm.patient_age, sex: patient?.gender ?? "", uhid: adm.patient_code || patient?.patient_code || "", phone: patient?.phone ?? "", allergies: patient?.allergies ?? "", chronic: patient?.chronic_conditions ?? "" },
    admission: { id: adm.id, ipdNo: adm.admission_no ?? `ADM-${adm.id}`, admittedOn: adm.admission_date, status: adm.status, ward: adm.ward, bed: adm.bed, doctor: adm.doctor, diagnosis: adm.diagnosis, diet: adm.diet ?? "" },
    order: await getFormOrder(actor),
    forms,
    linked,
  };
}

/** `{ data, version }`. A first save (version 0) creates the form; later saves must carry the version that was loaded. */
export async function saveForm(admissionId: number, formKey: string, input: unknown, actor: Session, creating: boolean): Promise<CaseFormRecordDTO> {
  const hid = requireHospitalId(actor);
  const adm = await loadAdmission(admissionId, actor);
  if (!isKey(formKey)) throw new NotFoundError("Form");
  const body = (typeof input === "object" && input !== null ? input : {}) as { data?: unknown; version?: unknown };
  if (typeof body.data !== "object" || body.data === null || Array.isArray(body.data)) throw new ValidationError([{ field: "data", message: "send the form's contents" }]);
  const data = sanitize(body.data) as Record<string, unknown>;
  if (JSON.stringify(data).length > MAX_JSON_CHARS) throw new ValidationError([{ field: "data", message: "this form has grown too large to save: remove some old rows" }]);

  const existing = (await entriesOf(adm.id)).find((e) => e.form_key === formKey);
  const sent = Number(body.version ?? 0);
  if (!existing) {
    if (!creating) throw new ConflictError("This form hasn't been saved yet: reload and try again.");
    const row = (await caseFileEntriesRepo.create({ hospital_id: hid, admission_id: adm.id, form_key: formKey, data, version: 1, updated_by: actor.name })) as CaseFileEntryRow;
    await audit(actor, "casefile.save", "case_file", `${adm.id}/${formKey}`, { version: 1 });
    return recordOf(row);
  }
  if (creating) throw new ConflictError(`Someone saved this form just now (${existing.updated_by}). Reload to see their changes before saving yours.`);
  if (sent !== existing.version) throw new ConflictError(`${existing.updated_by || "Someone"} saved this form while you were editing. Reload to see their changes, then add yours.`);
  const row = (await caseFileEntriesRepo.update(existing.id, { data, version: existing.version + 1, updated_by: actor.name })) as CaseFileEntryRow;
  await audit(actor, "casefile.save", "case_file", `${adm.id}/${formKey}`, { version: row.version });
  return recordOf(row);
}

/** Admitted patients (or all, or discharged) with how much of their file is filled in. */
export async function listCaseFiles(query: URLSearchParams, actor: Session): Promise<CaseFileListItemDTO[]> {
  requireHospitalId(actor);
  const status = query.get("status") ?? "Admitted";
  const q = (query.get("search") ?? "").toLowerCase().trim();
  const { rows } = await ipdRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const adms = (rows as IpdAdmissionRow[]).filter((a) => (status === "all" || a.status === status) && (!q || `${a.patient_name} ${a.patient_code} ${a.admission_no ?? ""} ${a.bed} ${a.doctor}`.toLowerCase().includes(q)));
  const all = (await caseFileEntriesRepo.listRows(scopeToHospital({ unpaged: true }, actor))).rows as CaseFileEntryRow[];
  return adms.sort((a, b) => b.admission_date.localeCompare(a.admission_date) || b.id - a.id).map((a) => {
    const mine = all.filter((e) => e.admission_id === a.id);
    return {
      admissionId: a.id, ipdNo: a.admission_no ?? `ADM-${a.id}`, patientName: a.patient_name, patientId: a.patient_id, uhid: a.patient_code, age: a.patient_age, ward: a.ward, bed: a.bed, doctor: a.doctor,
      admittedOn: a.admission_date, status: a.status, filled: mine.filter((e) => hasContent(e.data)).length, total: CASE_FILE_FORMS.length,
      updatedAt: mine.map((e) => e.updated_at).sort().pop() ?? null,
    };
  });
}
