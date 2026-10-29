/**
 * Lab service — test orders and sample/report lifecycle transitions.
 *
 * A test is either kept in-house (lab_center_id null — the default, and the
 * only mode before this) or routed to a lab center the hospital has an
 * Active link with (see hospital-lab-links-service). Once routed, the test
 * becomes a shared record: the ordering hospital and the receiving center
 * can both view it and act on sample/report status, but only the hospital
 * that created the order can delete it.
 */
import {
  labRepo,
  patientsRepo,
  doctorsRepo,
  hospitalsRepo,
  labCentersRepo,
  hospitalLabLinksRepo,
} from "@/repositories";
import { toLabDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { transactional, type UnitOfWork } from "@/db/unit-of-work";
import { TABLES } from "@/db/tables";
import { type LabTestRow } from "@/db/tables";
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { validateNotPast } from "@/lib/field-rules";
import { displayDate, displayTime, isoDate } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToOwnDoctor } from "@/services/doctor-scope";
import { scopeToHospital, requireHospitalId } from "@/services/hospital-scope";
import { canUploadReports } from "@shared/lib/report-upload-roles";
import { type LabStatus } from "@shared/types";
import {
  type LabPatientDetailDTO,
  type LabReportFileDTO,
  type LabTestDTO,
} from "@shared/types/api";
import { nextNumber } from "@/services/id-service";

export const LAB_PRIORITIES = ["Routine", "Urgent", "STAT"] as const;
export const LAB_DISCOUNT_TYPES = ["percent", "amount"] as const;

// ── Dual (hospital or lab-center) ownership ─────────────────────────────────

function isLabOwner(row: LabTestRow, actor: Session): boolean {
  if (actor.role === "Platform Admin") return true;
  if (actor.hospitalId != null) return row.hospital_id === actor.hospitalId;
  if (actor.labCenterId != null) return row.lab_center_id === actor.labCenterId;
  return false;
}

function assertLabAccessible(
  row: LabTestRow | null | undefined,
  actor: Session,
  what = "Lab test",
): asserts row is LabTestRow {
  if (!row || !isLabOwner(row, actor)) throw new NotFoundError(what);
}

/** Only the ordering hospital may delete — a center can act on a test, not erase it. */
function assertHospitalOwner(
  row: LabTestRow | null | undefined,
  actor: Session,
  what = "Lab test",
): asserts row is LabTestRow {
  if (!row) throw new NotFoundError(what);
  if (actor.role === "Platform Admin") return;
  if (row.hospital_id !== actor.hospitalId) throw new NotFoundError(what);
}

function scopeLabList(options: QueryOptions, actor: Session): QueryOptions {
  if (actor.role === "Platform Admin") return options;
  if (actor.hospitalId != null) {
    const scoped = scopeToHospital(options, actor);
    // The hospital's own in-house lab desk works its own queue only — a test
    // routed out to a linked center belongs to that center's worklist, not
    // this one. Every other hospital role (doctors, admins, reception) keeps
    // the full picture regardless of where a test ends up, since they need
    // oversight of their patients' care either way.
    if (actor.role === "Lab Partner") {
      return {
        ...scoped,
        filters: [...(scoped.filters ?? []), { column: "lab_center_id", op: "is", value: null }],
      };
    }
    return scoped;
  }
  if (actor.labCenterId != null) {
    return {
      ...options,
      filters: [
        ...(options.filters ?? []),
        { column: "lab_center_id", op: "eq", value: actor.labCenterId },
      ],
    };
  }
  // Neither a hospital nor a lab-center account — nothing to see.
  return { ...options, filters: [...(options.filters ?? []), { column: "id", op: "eq", value: -1 }] };
}

/** Join in the hospital/center display names a plain row → DTO mapper can't fetch. */
export async function enrichLab(rows: LabTestRow[]): Promise<LabTestDTO[]> {
  const hospitalIds = [...new Set(rows.map((r) => r.hospital_id))];
  const centerIds = [...new Set(rows.map((r) => r.lab_center_id).filter((v): v is number => v != null))];
  const patientIds = [...new Set(rows.map((r) => r.patient_id).filter((v): v is number => v != null))];
  const [hospitals, centers, patients] = await Promise.all([
    Promise.all(hospitalIds.map((id) => hospitalsRepo.getRow(id))),
    Promise.all(centerIds.map((id) => labCentersRepo.getRow(id))),
    Promise.all(patientIds.map((id) => patientsRepo.getRow(id))),
  ]);
  const patientCode = new Map(patients.filter((p) => p != null).map((p) => [p.id, p.patient_code]));
  const hospitalName = new Map(hospitals.filter((h) => h != null).map((h) => [h.id, h.name]));
  const centerName = new Map(centers.filter((c) => c != null).map((c) => [c.id, c.name]));

  return rows.map((r) => ({
    ...toLabDTO(r),
    patientCode: r.patient_id != null ? (patientCode.get(r.patient_id) ?? null) : null,
    hospitalName: hospitalName.get(r.hospital_id) ?? null,
    labCenterName: r.lab_center_id != null ? (centerName.get(r.lab_center_id) ?? null) : null,
  }));
}

const createSchema = {
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  patientAge: { type: "number", required: false, min: 0, max: 200, default: 0 },
  testName: { type: "string", required: true, min: 2, max: 160 },
  // The test's price is the routed-to center's call, not the hospital's —
  // only a discount the doctor grants is captured here, not a fixed amount.
  amount: { type: "number", required: false, min: 0, default: 0 },
  discount: { type: "number", required: false, min: 0, default: 0 },
  discountType: { type: "enum", required: false, values: LAB_DISCOUNT_TYPES, default: "amount" },
  requestedBy: { type: "string", required: false, max: 120, default: "" },
  doctorId: { type: "number", required: false },
  doctor: { type: "string", required: false, max: 120, default: "" },
  priority: { type: "enum", required: false, values: LAB_PRIORITIES, default: "Routine" },
  // Samples cannot be scheduled for a date that has already passed.
  collectionDate: {
    type: "string", required: false, max: 40, default: "",
    custom: validateNotPast("collection date"),
  },
  /** Route the test to a linked center instead of keeping it in-house. */
  labCenterId: { type: "number", required: false },
} as const;

export const LAB_LIST_CONFIG = {
  searchColumns: ["patient_name", "test_name", "order_number"],
  filterable: ["status", "sample_status", "report_status", "patient_id", "priority", "order_number"],
  sortable: ["test_date", "patient_name", "amount", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listLab(options: QueryOptions, actor: Session) {
  // Scope a Doctor actor to tests they personally referred (their own
  // `doctor_id` on the row), matching every other doctor-owned resource,
  // rather than indirectly via the patient's assigned doctor.
  const scoped = scopeLabList(scopeToOwnDoctor(options, actor, "doctor_id"), actor);
  const { rows, total } = await labRepo.listRows(scoped);
  return { rows: await enrichLab(rows), total };
}

export async function getLab(id: number, actor: Session) {
  const row = await labRepo.getRow(id);
  assertLabAccessible(row, actor, "Lab test");
  const [enriched] = await enrichLab([row]);
  return enriched;
}

/**
 * Fuller patient detail for one test — a referred-in patient's own hospital
 * chart is otherwise off-limits to a lab-center account (no `patients`
 * permission), but the demographics behind a test routed to them is fair
 * game since the test itself already grants access.
 */
export async function getLabPatientDetail(
  id: number,
  actor: Session,
): Promise<LabPatientDetailDTO> {
  const row = await labRepo.getRow(id);
  assertLabAccessible(row, actor, "Lab test");
  if (!row.patient_id) throw new NotFoundError("Patient");
  const patient = await patientsRepo.getRow(row.patient_id);
  if (!patient || patient.hospital_id !== row.hospital_id) throw new NotFoundError("Patient");
  return {
    id: patient.id,
    name: patient.name,
    patientCode: patient.patient_code,
    age: patient.age,
    gender: patient.gender,
    phone: patient.phone,
    email: patient.email,
    bloodGroup: patient.blood_group,
    dob: patient.dob,
    address: patient.address,
    city: patient.city,
    state: patient.state,
    pincode: patient.pincode,
    allergies: patient.allergies,
    chronicConditions: patient.chronic_conditions,
  };
}

/** Centers an actor's own hospital can route new orders to. */
export async function listRoutableCenters(actor: Session) {
  const hospitalId = requireHospitalId(actor);
  const { rows } = await hospitalLabLinksRepo.listRows({
    unpaged: true,
    filters: [
      { column: "hospital_id", op: "eq", value: hospitalId },
      { column: "status", op: "eq", value: "Active" },
    ],
  });
  const centers = await Promise.all(rows.map((r) => labCentersRepo.getRow(r.lab_center_id)));
  return centers.filter((c) => c != null).map((c) => ({ id: c.id, name: c.name }));
}

/** Next order number, shared by every test booked in one go. */
async function nextOrderNumber(actor: Session): Promise<string> {
  const { rows } = await labRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  return nextNumber("lab_order", actor, rows.map((r) => r.order_number ?? ""), { prefix: "LAB-", pad: 4 });
}

export async function createLab(input: unknown, actor: Session, uow?: UnitOfWork) {
  const data = validate(createSchema, input);
  const hospitalId = requireHospitalId(actor);
  const orderNumber =
    (input as { orderNumber?: string })?.orderNumber || (await nextOrderNumber(actor));

  let patientName = data.patientName;
  let patientAge = data.patientAge ?? 0;
  if (data.patientId) {
    const p = await patientsRepo.getRow(data.patientId);
    if (p) {
      patientName = p.name;
      patientAge = p.age;
    }
  }

  let doctorName = data.doctor ?? "";
  if (data.doctorId) {
    const d = await doctorsRepo.getRow(data.doctorId);
    if (d && d.hospital_id === hospitalId) doctorName = d.name;
  }

  let labCenterId: number | null = null;
  if (data.labCenterId) {
    const link = await hospitalLabLinksRepo.findRow([
      { column: "hospital_id", op: "eq", value: hospitalId },
      { column: "lab_center_id", op: "eq", value: data.labCenterId },
      { column: "status", op: "eq", value: "Active" },
    ]);
    if (!link) throw new ConflictError("Not linked to this lab center");
    labCenterId = data.labCenterId;
  }

  const create = uow
    ? (v: Record<string, unknown>) => uow.insert<LabTestRow>(TABLES.labTests, v)
    : (v: Record<string, unknown>) => labRepo.create(v);
  const row = await create({
    hospital_id: hospitalId,
    order_number: orderNumber,
    patient_id: data.patientId ?? null,
    patient_name: patientName,
    patient_age: patientAge,
    test_name: data.testName,
    requested_by: data.requestedBy,
    doctor_id: data.doctorId ?? null,
    doctor: doctorName,
    priority: data.priority,
    sample_status: "Pending",
    report_status: "Pending",
    test_date: displayDate(),
    collection_date: isoDate(data.collectionDate),
    amount: data.amount,
    discount: data.discount,
    discount_type: data.discountType,
    status: "Pending",
    lab_center_id: labCenterId,
  });
  await audit(actor, "create", "lab", row.id, { orderNumber, labCenterId });
  const [enriched] = await enrichLab([row as LabTestRow]);
  return enriched;
}

/**
 * Book several tests for one patient as a single order.
 *
 * Booking three tests previously issued three unrelated rows, which read as
 * three separate patient entries. They now share one order number so the
 * booking stays recognisable as one visit.
 */
export async function createLabOrder(input: unknown, actor: Session) {
  const body = (input ?? {}) as { tests?: { testName: string; amount?: number }[] };
  const tests = (body.tests ?? []).filter((t) => t?.testName?.trim());
  if (tests.length === 0) {
    throw new BadRequestError("Select at least one test");
  }

  const orderNumber = await nextOrderNumber(actor);
  // The whole order lands or none of it does — a failure partway through
  // previously left a half-booked order behind.
  const created = await transactional("lab.order", async (uow) => {
    const rows = [];
    for (const t of tests) {
      rows.push(
        await createLab(
          { ...body, orderNumber, testName: t.testName, amount: t.amount ?? 0 },
          actor,
          uow,
        ),
      );
    }
    return rows;
  });
  return { orderNumber, tests: created };
}

/** Derive the headline status from sample + report states. */
function deriveStatus(sample: string, report: string): LabStatus {
  if (report === "Ready") return "Report Ready";
  if (sample === "Collected") return "Sample Collected";
  return "Pending";
}

export async function updateLab(id: number, input: unknown, actor: Session) {
  const existing = await labRepo.getRow(id);
  assertLabAccessible(existing, actor, "Lab test");

  const schema = {
    sampleStatus: { type: "enum", required: false, values: ["Pending", "Collected"] },
    reportStatus: { type: "enum", required: false, values: ["Pending", "Ready"] },
    amount: { type: "number", required: false, min: 0 },
    discount: { type: "number", required: false, min: 0 },
    discountType: { type: "enum", required: false, values: LAB_DISCOUNT_TYPES },
    priority: { type: "enum", required: false, values: LAB_PRIORITIES },
    status: {
      type: "enum",
      required: false,
      values: ["Pending", "Sample Collected", "Report Ready", "Cancelled"],
    },
  } as const;
  const data = validatePartial(schema, input);

  const patch: Record<string, unknown> = {};
  if ("sampleStatus" in data) patch.sample_status = data.sampleStatus;
  if ("reportStatus" in data) patch.report_status = data.reportStatus;
  if ("amount" in data) patch.amount = data.amount;
  if ("discount" in data) patch.discount = data.discount;
  if ("discountType" in data) patch.discount_type = data.discountType;
  if ("priority" in data) patch.priority = data.priority;

  const sample = (patch.sample_status as string) ?? existing.sample_status;
  const report = (patch.report_status as string) ?? existing.report_status;
  patch.status =
    data.status === "Cancelled" ? "Cancelled" : deriveStatus(sample, report);

  const row = await labRepo.update(id, patch);
  await audit(actor, "update", "lab", id, patch);
  const [enriched] = await enrichLab([row as LabTestRow]);
  return enriched;
}

export async function deleteLab(id: number, actor: Session) {
  const existing = await labRepo.getRow(id);
  assertHospitalOwner(existing, actor, "Lab test");
  await labRepo.remove(id);
  await audit(actor, "delete", "lab", id);
}

// ── Report documents ─────────────────────────────────────────────────────────

const FIREBASE_STORAGE_URL = /^https:\/\/(firebasestorage\.googleapis\.com|storage\.googleapis\.com)\//;

/**
 * Attach a report document to a test. The file itself was already uploaded
 * straight from the browser to Firebase Storage (see uploadReportFile in
 * lib/firebase/client.ts) — this just records the resulting download URL, so
 * only the roles Storage Security Rules actually let upload can get this far
 * with a real URL. Re-checked here too, server-side, since a URL could in
 * principle be submitted directly without going through Storage at all.
 * Marks the sample collected and the report ready, and records who uploaded
 * it — for a linked center that is the center's own login, so the ordering
 * hospital sees the source at a glance.
 */
export async function uploadLabReport(
  id: number,
  input: unknown,
  actor: Session,
) {
  if (!canUploadReports(actor.role)) {
    throw new ForbiddenError("Only lab/radiology report handlers can upload reports");
  }

  const existing = await labRepo.getRow(id);
  assertLabAccessible(existing, actor, "Lab test");

  const body = (input ?? {}) as { fileName?: string; fileUrl?: string; note?: string };
  const fileName = String(body.fileName ?? "").trim();
  const fileUrl = String(body.fileUrl ?? "").trim();
  const note = String(body.note ?? "").trim();

  if (!fileName) throw new BadRequestError("fileName is required");
  if (!FIREBASE_STORAGE_URL.test(fileUrl)) {
    throw new BadRequestError("fileUrl must be a Firebase Storage download URL");
  }

  const row = await labRepo.update(id, {
    report_file: fileUrl,
    report_file_name: fileName,
    report_note: note || null,
    report_uploaded_by: actor.name,
    report_uploaded_at: `${displayDate()}, ${displayTime()}`,
    sample_status: "Collected",
    report_status: "Ready",
    status: "Report Ready",
  });
  await audit(actor, "upload-report", "lab", id, { fileName });
  const [enriched] = await enrichLab([row as LabTestRow]);
  return enriched;
}

/** Fetch the uploaded report document's URL for viewing/downloading. */
export async function getLabReportFile(
  id: number,
  actor: Session,
): Promise<LabReportFileDTO> {
  const row = await labRepo.getRow(id);
  assertLabAccessible(row, actor, "Lab test");
  if (!row.report_file) throw new NotFoundError("Report document");
  return {
    fileName: row.report_file_name ?? "report",
    fileUrl: row.report_file,
    note: row.report_note ?? null,
    uploadedBy: row.report_uploaded_by ?? null,
    uploadedAt: row.report_uploaded_at ?? null,
  };
}
