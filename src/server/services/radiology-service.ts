/**
 * Radiology service — imaging orders and scan/report lifecycle transitions.
 */
import { radiologyRepo, patientsRepo } from "@/server/repositories";
import { toRadiologyDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { type RadiologyTestRow } from "@/server/db/tables";
import { NotFoundError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { displayDate } from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { type RadiologyStatus } from "@/types";

const createSchema = {
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  patientAge: { type: "number", required: false, min: 0, max: 200, default: 0 },
  testName: { type: "string", required: true, min: 2, max: 160 },
  amount: { type: "number", required: false, min: 0, default: 0 },
} as const;

export const RADIOLOGY_LIST_CONFIG = {
  searchColumns: ["patient_name", "test_name"],
  filterable: ["status", "scan_status", "report_status"],
  sortable: ["test_date", "patient_name", "amount", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listRadiology(options: QueryOptions) {
  return radiologyRepo.list(options);
}

export async function getRadiology(id: number) {
  const t = await radiologyRepo.get(id);
  if (!t) throw new NotFoundError("Radiology test");
  return t;
}

export async function createRadiology(input: unknown, actor: Session) {
  const data = validate(createSchema, input);
  let patientName = data.patientName;
  let patientAge = data.patientAge ?? 0;
  if (data.patientId) {
    const p = await patientsRepo.getRow(data.patientId);
    if (p) {
      patientName = p.name;
      patientAge = p.age;
    }
  }
  const row = await radiologyRepo.create({
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
  await audit(actor, "create", "radiology", row.id);
  return toRadiologyDTO(row as RadiologyTestRow);
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
