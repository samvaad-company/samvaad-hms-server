/**
 * Radiology service — imaging orders and scan/report lifecycle transitions.
 */
import { radiologyRepo, patientsRepo } from "@/server/repositories";
import { toRadiologyDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { transactional, type UnitOfWork } from "@/server/db/unit-of-work";
import { TABLES } from "@/server/db/tables";
import { type RadiologyTestRow } from "@/server/db/tables";
import { NotFoundError, BadRequestError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { displayDate, displayTime, nextCode } from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { scopeToOwnPatients } from "@/server/services/doctor-scope";
import { type RadiologyStatus } from "@/types";
import { type RadiologyReportFileDTO } from "@/types/api";

const createSchema = {
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  patientAge: { type: "number", required: false, min: 0, max: 200, default: 0 },
  testName: { type: "string", required: true, min: 2, max: 160 },
  amount: { type: "number", required: false, min: 0, default: 0 },
} as const;

export const RADIOLOGY_LIST_CONFIG = {
  searchColumns: ["patient_name", "test_name"],
  filterable: ["status", "scan_status", "report_status", "patient_id", "order_number"],
  sortable: ["test_date", "patient_name", "amount", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listRadiology(options: QueryOptions, actor: Session) {
  return radiologyRepo.list(await scopeToOwnPatients(options, actor));
}

export async function getRadiology(id: number) {
  const t = await radiologyRepo.get(id);
  if (!t) throw new NotFoundError("Radiology test");
  return t;
}

/** Next order number, shared by every study ordered in one go. */
async function nextOrderNumber(): Promise<string> {
  const { rows } = await radiologyRepo.listRows({ unpaged: true });
  return nextCode(rows.map((r) => r.order_number ?? ""), "RAD-", 4);
}

export async function createRadiology(input: unknown, actor: Session, uow?: UnitOfWork) {
  const data = validate(createSchema, input);
  const orderNumber =
    (input as { orderNumber?: string })?.orderNumber || (await nextOrderNumber());
  let patientName = data.patientName;
  let patientAge = data.patientAge ?? 0;
  if (data.patientId) {
    const p = await patientsRepo.getRow(data.patientId);
    if (p) {
      patientName = p.name;
      patientAge = p.age;
    }
  }
  const create = uow
    ? (v: Record<string, unknown>) => uow.insert<RadiologyTestRow>(TABLES.radiologyTests, v)
    : (v: Record<string, unknown>) => radiologyRepo.create(v);
  const row = await create({
    order_number: orderNumber,
    patient_id: data.patientId ?? null,
    patient_name: patientName,
    patient_age: patientAge,
    test_name: data.testName,
    scan_status: "Pending",
    report_status: "Pending",
    test_date: displayDate(),
    amount: data.amount,
    status: "Pending",
  });
  await audit(actor, "create", "radiology", row.id, { orderNumber });
  return toRadiologyDTO(row as RadiologyTestRow);
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
  const orderNumber = await nextOrderNumber();
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
  if (!existing) throw new NotFoundError("Radiology test");

  const schema = {
    scanStatus: { type: "enum", required: false, values: ["Pending", "Done"] },
    reportStatus: { type: "enum", required: false, values: ["Pending", "Ready"] },
    amount: { type: "number", required: false, min: 0 },
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

  const scan = (patch.scan_status as string) ?? existing.scan_status;
  const report = (patch.report_status as string) ?? existing.report_status;
  patch.status =
    data.status === "Cancelled" ? "Cancelled" : deriveStatus(scan, report);

  const row = await radiologyRepo.update(id, patch);
  await audit(actor, "update", "radiology", id, patch);
  return toRadiologyDTO(row as RadiologyTestRow);
}

export async function deleteRadiology(id: number, actor: Session) {
  const ok = await radiologyRepo.remove(id);
  if (!ok) throw new NotFoundError("Radiology test");
  await audit(actor, "delete", "radiology", id);
}

// ── Report documents ─────────────────────────────────────────────────────────

/** ~7 MB of base64 ≈ 5 MB file — a sane cap for PDFs / scan images. */
const MAX_REPORT_DATAURL_CHARS = 7_000_000;
const ALLOWED_MIME = /^data:(application\/pdf|image\/(png|jpe?g|webp));base64,/;

/**
 * Attach an uploaded report document (PDF or image, sent as a data URL) to a
 * study. Marks the scan done and the report ready, and records who uploaded it
 * — for partner centres that is the centre's own login, so the main hospital
 * sees the source at a glance.
 */
export async function uploadRadiologyReport(
  id: number,
  input: unknown,
  actor: Session,
) {
  const existing = await radiologyRepo.getRow(id);
  if (!existing) throw new NotFoundError("Radiology test");

  const body = (input ?? {}) as { fileName?: string; dataUrl?: string; note?: string };
  const fileName = String(body.fileName ?? "").trim();
  const dataUrl = String(body.dataUrl ?? "");
  const note = String(body.note ?? "").trim();

  if (!fileName) throw new BadRequestError("fileName is required");
  if (!ALLOWED_MIME.test(dataUrl)) {
    throw new BadRequestError("Report must be a PDF, PNG, JPEG, or WebP file");
  }
  if (dataUrl.length > MAX_REPORT_DATAURL_CHARS) {
    throw new BadRequestError("Report file is too large (max ~5 MB)");
  }

  const row = await radiologyRepo.update(id, {
    report_file: dataUrl,
    report_file_name: fileName,
    report_note: note || null,
    report_uploaded_by: actor.name,
    report_uploaded_at: `${displayDate()}, ${displayTime()}`,
    scan_status: "Done",
    report_status: "Ready",
    status: "Report Ready",
  });
  await audit(actor, "upload-report", "radiology", id, { fileName });
  return toRadiologyDTO(row as RadiologyTestRow);
}

/** Fetch the uploaded report document for viewing/downloading. */
export async function getRadiologyReportFile(
  id: number,
): Promise<RadiologyReportFileDTO> {
  const row = await radiologyRepo.getRow(id);
  if (!row) throw new NotFoundError("Radiology test");
  if (!row.report_file) throw new NotFoundError("Report document");
  return {
    fileName: row.report_file_name ?? "report",
    dataUrl: row.report_file,
    note: row.report_note ?? null,
    uploadedBy: row.report_uploaded_by ?? null,
    uploadedAt: row.report_uploaded_at ?? null,
  };
}
