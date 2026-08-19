/**
 * Radiology service — imaging orders and scan/report lifecycle transitions.
 *
 * A study is either kept in-house (radiology_center_id null — the default,
 * and the only mode before this) or routed to a radiology center the
 * hospital has an Active link with (see hospital-radiology-links-service).
 * Once routed, the study becomes a shared record: the ordering hospital and
 * the receiving center can both view it and act on scan/report status, but
 * only the hospital that created the order can delete it.
 */
import {
  radiologyRepo,
  patientsRepo,
  doctorsRepo,
  hospitalsRepo,
  radiologyCentersRepo,
  hospitalRadiologyLinksRepo,
} from "@/server/repositories";
import { toRadiologyDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { transactional, type UnitOfWork } from "@/server/db/unit-of-work";
import { TABLES } from "@/server/db/tables";
import { type RadiologyTestRow } from "@/server/db/tables";
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { displayDate, displayTime, nextCode } from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { scopeToOwnDoctor } from "@/server/services/doctor-scope";
import { scopeToHospital, requireHospitalId } from "@/server/services/hospital-scope";
import { canUploadReports } from "@/lib/report-upload-roles";
import { type RadiologyStatus } from "@/types";
import {
  type RadiologyPatientDetailDTO,
  type RadiologyReportFileDTO,
  type RadiologyTestDTO,
} from "@/types/api";

// ── Dual (hospital or radiology-center) ownership ───────────────────────────

function isRadiologyOwner(row: RadiologyTestRow, actor: Session): boolean {
  if (actor.role === "Platform Admin") return true;
  if (actor.hospitalId != null) return row.hospital_id === actor.hospitalId;
  if (actor.radiologyCenterId != null) return row.radiology_center_id === actor.radiologyCenterId;
  return false;
}

function assertRadiologyAccessible(
  row: RadiologyTestRow | null | undefined,
  actor: Session,
  what = "Radiology test",
): asserts row is RadiologyTestRow {
  if (!row || !isRadiologyOwner(row, actor)) throw new NotFoundError(what);
}

/** Only the ordering hospital may delete — a center can act on a study, not erase it. */
function assertHospitalOwner(
  row: RadiologyTestRow | null | undefined,
  actor: Session,
  what = "Radiology test",
): asserts row is RadiologyTestRow {
  if (!row) throw new NotFoundError(what);
  if (actor.role === "Platform Admin") return;
  if (row.hospital_id !== actor.hospitalId) throw new NotFoundError(what);
}

function scopeRadiologyList(options: QueryOptions, actor: Session): QueryOptions {
  if (actor.role === "Platform Admin") return options;
  if (actor.hospitalId != null) {
    const scoped = scopeToHospital(options, actor);
    // The hospital's own in-house radiology desk works its own queue only —
    // a study routed out to a linked center belongs to that center's
    // worklist, not this one. Every other hospital role (doctors, admins,
    // reception) keeps the full picture regardless of where a study ends up,
    // since they need oversight of their patients' care either way.
    if (actor.role === "Radiology Partner") {
      return {
        ...scoped,
        filters: [...(scoped.filters ?? []), { column: "radiology_center_id", op: "is", value: null }],
      };
    }
    return scoped;
  }
  if (actor.radiologyCenterId != null) {
    return {
      ...options,
      filters: [
        ...(options.filters ?? []),
        { column: "radiology_center_id", op: "eq", value: actor.radiologyCenterId },
      ],
    };
  }
  // Neither a hospital nor a radiology-center account — nothing to see.
  return { ...options, filters: [...(options.filters ?? []), { column: "id", op: "eq", value: -1 }] };
}

/** Join in the hospital/center display names a plain row → DTO mapper can't fetch. */
export async function enrichRadiology(rows: RadiologyTestRow[]): Promise<RadiologyTestDTO[]> {
  const hospitalIds = [...new Set(rows.map((r) => r.hospital_id))];
  const centerIds = [...new Set(rows.map((r) => r.radiology_center_id).filter((v): v is number => v != null))];
  const [hospitals, centers] = await Promise.all([
    Promise.all(hospitalIds.map((id) => hospitalsRepo.getRow(id))),
    Promise.all(centerIds.map((id) => radiologyCentersRepo.getRow(id))),
  ]);
  const hospitalName = new Map(hospitals.filter((h) => h != null).map((h) => [h.id, h.name]));
  const centerName = new Map(centers.filter((c) => c != null).map((c) => [c.id, c.name]));

  return rows.map((r) => ({
    ...toRadiologyDTO(r),
    hospitalName: hospitalName.get(r.hospital_id) ?? null,
    radiologyCenterName: r.radiology_center_id != null ? (centerName.get(r.radiology_center_id) ?? null) : null,
  }));
}

export const DISCOUNT_TYPES = ["percent", "amount"] as const;

const createSchema = {
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  patientAge: { type: "number", required: false, min: 0, max: 200, default: 0 },
  testName: { type: "string", required: true, min: 2, max: 160 },
  // The study's price is the routed-to center's call, not the hospital's —
  // only a discount the doctor grants is captured here, not a fixed amount.
  amount: { type: "number", required: false, min: 0, default: 0 },
  discount: { type: "number", required: false, min: 0, default: 0 },
  discountType: { type: "enum", required: false, values: DISCOUNT_TYPES, default: "amount" },
  doctorId: { type: "number", required: false },
  doctor: { type: "string", required: false, max: 120, default: "" },
  /** Route the study to a linked center instead of keeping it in-house. */
  radiologyCenterId: { type: "number", required: false },
} as const;

export const RADIOLOGY_LIST_CONFIG = {
  searchColumns: ["patient_name", "test_name"],
  filterable: ["status", "scan_status", "report_status", "patient_id", "order_number"],
  sortable: ["test_date", "patient_name", "amount", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listRadiology(options: QueryOptions, actor: Session) {
  // Unlike lab tests, a radiology test carries its own referring `doctor_id`
  // — scope a Doctor actor to that directly (as every other doctor-owned
  // resource does) rather than indirectly via the patient's assigned doctor,
  // which left tests invisible to the very doctor who ordered them whenever
  // the patient had no (or a different) doctor set on their profile.
  const scoped = scopeRadiologyList(scopeToOwnDoctor(options, actor, "doctor_id"), actor);
  const { rows, total } = await radiologyRepo.listRows(scoped);
  return { rows: await enrichRadiology(rows), total };
}

export async function getRadiology(id: number, actor: Session) {
  const row = await radiologyRepo.getRow(id);
  assertRadiologyAccessible(row, actor, "Radiology test");
  const [enriched] = await enrichRadiology([row]);
  return enriched;
}

/**
 * Fuller patient detail for one study — a referred-in patient's own hospital
 * chart is otherwise off-limits to a radiology-center account (no `patients`
 * permission), but the demographics behind a study routed to them is fair
 * game since the study itself already grants access.
 */
export async function getRadiologyPatientDetail(
  id: number,
  actor: Session,
): Promise<RadiologyPatientDetailDTO> {
  const row = await radiologyRepo.getRow(id);
  assertRadiologyAccessible(row, actor, "Radiology test");
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
  const { rows } = await hospitalRadiologyLinksRepo.listRows({
    unpaged: true,
    filters: [
      { column: "hospital_id", op: "eq", value: hospitalId },
      { column: "status", op: "eq", value: "Active" },
    ],
  });
  const centers = await Promise.all(rows.map((r) => radiologyCentersRepo.getRow(r.radiology_center_id)));
  return centers.filter((c) => c != null).map((c) => ({ id: c.id, name: c.name }));
}

/** Next order number, shared by every study ordered in one go. */
async function nextOrderNumber(actor: Session): Promise<string> {
  const { rows } = await radiologyRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  return nextCode(rows.map((r) => r.order_number ?? ""), "RAD-", 4);
}

export async function createRadiology(input: unknown, actor: Session, uow?: UnitOfWork) {
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

  let radiologyCenterId: number | null = null;
  if (data.radiologyCenterId) {
    const link = await hospitalRadiologyLinksRepo.findRow([
      { column: "hospital_id", op: "eq", value: hospitalId },
      { column: "radiology_center_id", op: "eq", value: data.radiologyCenterId },
      { column: "status", op: "eq", value: "Active" },
    ]);
    if (!link) throw new ConflictError("Not linked to this radiology center");
    radiologyCenterId = data.radiologyCenterId;
  }

  const create = uow
    ? (v: Record<string, unknown>) => uow.insert<RadiologyTestRow>(TABLES.radiologyTests, v)
    : (v: Record<string, unknown>) => radiologyRepo.create(v);
  const row = await create({
    hospital_id: hospitalId,
    order_number: orderNumber,
    patient_id: data.patientId ?? null,
    patient_name: patientName,
    patient_age: patientAge,
    test_name: data.testName,
    scan_status: "Pending",
    report_status: "Pending",
    test_date: displayDate(),
    amount: data.amount,
    discount: data.discount,
    discount_type: data.discountType,
    status: "Pending",
    doctor_id: data.doctorId ?? null,
    doctor: doctorName,
    radiology_center_id: radiologyCenterId,
  });
  await audit(actor, "create", "radiology", row.id, { orderNumber, radiologyCenterId });
  const [enriched] = await enrichRadiology([row as RadiologyTestRow]);
  return enriched;
}

/**
 * Order several studies for one patient as a single order.
 *
 * Selecting two studies previously created two unrelated rows, which read as
 * two separate patient entries.
 */
export async function createRadiologyOrder(input: unknown, actor: Session) {
  const body = (input ?? {}) as { tests?: { testName: string; amount?: number }[] };
  const tests = (body.tests ?? []).filter((t) => t?.testName?.trim());
  if (tests.length === 0) {
    throw new BadRequestError("Select at least one study");
  }
  const orderNumber = await nextOrderNumber(actor);
  // The whole order lands or none of it does — a failure partway through
  // previously left a half-booked order behind.
  const created = await transactional("radiology.order", async (uow) => {
    const rows = [];
    for (const t of tests) {
      rows.push(
        await createRadiology(
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

/** Derive the headline status from scan + report states. */
function deriveStatus(scan: string, report: string): RadiologyStatus {
  if (report === "Ready") return "Report Ready";
  if (scan === "Done") return "Scan Done";
  return "Pending";
}

export async function updateRadiology(id: number, input: unknown, actor: Session) {
  const existing = await radiologyRepo.getRow(id);
  assertRadiologyAccessible(existing, actor, "Radiology test");

  const schema = {
    scanStatus: { type: "enum", required: false, values: ["Pending", "Done"] },
    reportStatus: { type: "enum", required: false, values: ["Pending", "Ready"] },
    amount: { type: "number", required: false, min: 0 },
    discount: { type: "number", required: false, min: 0 },
    discountType: { type: "enum", required: false, values: DISCOUNT_TYPES },
    status: {
      type: "enum",
      required: false,
      values: ["Pending", "Scan Done", "Report Ready", "Cancelled"],
    },
  } as const;
  const data = validatePartial(schema, input);

  const patch: Record<string, unknown> = {};
  if ("scanStatus" in data) patch.scan_status = data.scanStatus;
  if ("reportStatus" in data) patch.report_status = data.reportStatus;
  if ("amount" in data) patch.amount = data.amount;
  if ("discount" in data) patch.discount = data.discount;
  if ("discountType" in data) patch.discount_type = data.discountType;

  const scan = (patch.scan_status as string) ?? existing.scan_status;
  const report = (patch.report_status as string) ?? existing.report_status;
  patch.status =
    data.status === "Cancelled" ? "Cancelled" : deriveStatus(scan, report);

  const row = await radiologyRepo.update(id, patch);
  await audit(actor, "update", "radiology", id, patch);
  const [enriched] = await enrichRadiology([row as RadiologyTestRow]);
  return enriched;
}

export async function deleteRadiology(id: number, actor: Session) {
  const existing = await radiologyRepo.getRow(id);
  assertHospitalOwner(existing, actor, "Radiology test");
  await radiologyRepo.remove(id);
  await audit(actor, "delete", "radiology", id);
}

// ── Report documents ─────────────────────────────────────────────────────────

/** ~7 MB of base64 ≈ 5 MB file — a sane cap for PDFs / scan images. */
const FIREBASE_STORAGE_URL = /^https:\/\/(firebasestorage\.googleapis\.com|storage\.googleapis\.com)\//;

/**
 * Attach a report document to a study. The file itself was already uploaded
 * straight from the browser to Firebase Storage (see uploadReportFile in
 * lib/firebase/client.ts) — this just records the resulting download URL, so
 * only the roles Storage Security Rules actually let upload can get this far
 * with a real URL. Re-checked here too, server-side, since a URL could in
 * principle be submitted directly without going through Storage at all.
 * Marks the scan done and the report ready, and records who uploaded it — for
 * a linked center that is the center's own login, so the ordering hospital
 * sees the source at a glance.
 */
export async function uploadRadiologyReport(
  id: number,
  input: unknown,
  actor: Session,
) {
  if (!canUploadReports(actor.role)) {
    throw new ForbiddenError("Only lab/radiology report handlers can upload reports");
  }

  const existing = await radiologyRepo.getRow(id);
  assertRadiologyAccessible(existing, actor, "Radiology test");

  const body = (input ?? {}) as { fileName?: string; fileUrl?: string; note?: string };
  const fileName = String(body.fileName ?? "").trim();
  const fileUrl = String(body.fileUrl ?? "").trim();
  const note = String(body.note ?? "").trim();

  if (!fileName) throw new BadRequestError("fileName is required");
  if (!FIREBASE_STORAGE_URL.test(fileUrl)) {
    throw new BadRequestError("fileUrl must be a Firebase Storage download URL");
  }

  const row = await radiologyRepo.update(id, {
    report_file: fileUrl,
    report_file_name: fileName,
    report_note: note || null,
    report_uploaded_by: actor.name,
    report_uploaded_at: `${displayDate()}, ${displayTime()}`,
    scan_status: "Done",
    report_status: "Ready",
    status: "Report Ready",
  });
  await audit(actor, "upload-report", "radiology", id, { fileName });
  const [enriched] = await enrichRadiology([row as RadiologyTestRow]);
  return enriched;
}

/** Fetch the uploaded report document's URL for viewing/downloading. */
export async function getRadiologyReportFile(
  id: number,
  actor: Session,
): Promise<RadiologyReportFileDTO> {
  const row = await radiologyRepo.getRow(id);
  assertRadiologyAccessible(row, actor, "Radiology test");
  if (!row.report_file) throw new NotFoundError("Report document");
  return {
    fileName: row.report_file_name ?? "report",
    fileUrl: row.report_file,
    note: row.report_note ?? null,
    uploadedBy: row.report_uploaded_by ?? null,
    uploadedAt: row.report_uploaded_at ?? null,
  };
}
