/**
 * Lab service — test orders and sample/report lifecycle transitions.
 */
import { labRepo, patientsRepo } from "@/server/repositories";
import { toLabDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { type LabTestRow } from "@/server/db/tables";
import { NotFoundError, BadRequestError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { validateNotPast } from "@/server/lib/field-rules";
import { displayDate, isoDate, nextCode } from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { type LabStatus } from "@/types";

export const LAB_PRIORITIES = ["Routine", "Urgent", "STAT"] as const;

const createSchema = {
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  patientAge: { type: "number", required: false, min: 0, max: 200, default: 0 },
  testName: { type: "string", required: true, min: 2, max: 160 },
  amount: { type: "number", required: false, min: 0, default: 0 },
  discount: { type: "number", required: false, min: 0, default: 0 },
  requestedBy: { type: "string", required: false, max: 120, default: "" },
  priority: { type: "enum", required: false, values: LAB_PRIORITIES, default: "Routine" },
  // Samples cannot be scheduled for a date that has already passed.
  collectionDate: {
    type: "string", required: false, max: 40, default: "",
    custom: validateNotPast("collection date"),
  },
} as const;

export const LAB_LIST_CONFIG = {
  searchColumns: ["patient_name", "test_name", "order_number"],
  filterable: ["status", "sample_status", "report_status", "patient_id", "priority", "order_number"],
  sortable: ["test_date", "patient_name", "amount", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listLab(options: QueryOptions) {
  return labRepo.list(options);
}

export async function getLab(id: number) {
  const t = await labRepo.get(id);
  if (!t) throw new NotFoundError("Lab test");
  return t;
}

/** Next order number, shared by every test booked in one go. */
async function nextOrderNumber(): Promise<string> {
  const { rows } = await labRepo.listRows({ unpaged: true });
  return nextCode(rows.map((r) => r.order_number ?? ""), "LAB-", 4);
}

export async function createLab(input: unknown, actor: Session) {
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
  const row = await labRepo.create({
    order_number: orderNumber,
    patient_id: data.patientId ?? null,
    patient_name: patientName,
    patient_age: patientAge,
    test_name: data.testName,
    requested_by: data.requestedBy,
    priority: data.priority,
    sample_status: "Pending",
    report_status: "Pending",
    test_date: displayDate(),
    collection_date: isoDate(data.collectionDate),
    amount: data.amount,
    discount: data.discount,
    status: "Pending",
  });
  await audit(actor, "create", "lab", row.id, { orderNumber });
  return toLabDTO(row as LabTestRow);
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

  const orderNumber = await nextOrderNumber();
  const created = [];
  for (const t of tests) {
    created.push(
      await createLab(
        { ...body, orderNumber, testName: t.testName, amount: t.amount ?? 0 },
        actor,
      ),
    );
  }
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
  if (!existing) throw new NotFoundError("Lab test");

  const schema = {
    sampleStatus: { type: "enum", required: false, values: ["Pending", "Collected"] },
    reportStatus: { type: "enum", required: false, values: ["Pending", "Ready"] },
    amount: { type: "number", required: false, min: 0 },
    discount: { type: "number", required: false, min: 0 },
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
  if ("priority" in data) patch.priority = data.priority;

  const sample = (patch.sample_status as string) ?? existing.sample_status;
  const report = (patch.report_status as string) ?? existing.report_status;
  patch.status =
    data.status === "Cancelled" ? "Cancelled" : deriveStatus(sample, report);

  const row = await labRepo.update(id, patch);
  await audit(actor, "update", "lab", id, patch);
  return toLabDTO(row as LabTestRow);
}

export async function deleteLab(id: number, actor: Session) {
  const ok = await labRepo.remove(id);
  if (!ok) throw new NotFoundError("Lab test");
  await audit(actor, "delete", "lab", id);
}
