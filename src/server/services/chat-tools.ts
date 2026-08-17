/**
 * AI Chat data-lookup tools.
 *
 * Each domain is a thin wrapper around an EXISTING service's list function —
 * the same function the REST API uses — so a tool call gets exactly the same
 * hospital/doctor/dual-ownership scoping as the normal UI, with no new query
 * logic to get wrong. `buildToolsForActor` is the actual access-control
 * boundary: a domain is only ever turned into a Gemini tool declaration (and
 * therefore only ever callable) when `can(actor.role, domain.resource,
 * "read")` — a role that can't read billing never even sees a "query
 * billing" tool exists. `executeTool` re-checks permission server-side
 * before running anything, so the model is never trusted to have only
 * picked from the filtered list it was given.
 */
import { can, type Resource } from "@/server/auth/rbac";
import { type Session } from "@/server/auth/session";
import { type QueryOptions } from "@/server/db/adapter";
import { type ToolDeclaration } from "@/server/services/gemini";

import { listPatients, PATIENT_LIST_CONFIG } from "@/server/services/patients-service";
import { listAppointments, APPOINTMENT_LIST_CONFIG } from "@/server/services/appointments-service";
import { listOpd, OPD_LIST_CONFIG } from "@/server/services/opd-service";
import { listPrescriptions, RX_LIST_CONFIG } from "@/server/services/prescriptions-service";
import { listPharmacy, PHARMACY_LIST_CONFIG } from "@/server/services/pharmacy-service";
import { listLab, LAB_LIST_CONFIG } from "@/server/services/lab-service";
import { listRadiology, RADIOLOGY_LIST_CONFIG } from "@/server/services/radiology-service";
import { listIpd, IPD_LIST_CONFIG } from "@/server/services/ipd-service";
import { listOt, OT_LIST_CONFIG } from "@/server/services/ot-service";
import { listBeds, BEDS_LIST_CONFIG } from "@/server/services/beds-service";
import { listBills, BILLING_LIST_CONFIG } from "@/server/services/billing-service";
import { listStaff, STAFF_LIST_CONFIG } from "@/server/services/staff-service";
import { listItems, ITEMS_LIST_CONFIG } from "@/server/services/inventory-service";
import { listTasks, TASKS_LIST_CONFIG } from "@/server/services/tasks-service";
import { listCalls, CALLS_LIST_CONFIG } from "@/server/services/ambulance-service";
import { listStock, STOCK_LIST_CONFIG } from "@/server/services/bloodbank-service";
import { listClaims, CLAIMS_LIST_CONFIG } from "@/server/services/tpa-service";
import { listDocuments, DOCUMENTS_LIST_CONFIG } from "@/server/services/documents-service";
import { incomeService, expenseService } from "@/server/services/finance-service";
import { getReports } from "@/server/services/reports-service";
import { getDashboardStats } from "@/server/services/dashboard-service";

export interface ChatToolArgs {
  search?: string;
  status?: string;
  limit?: number;
}

export interface ChatDomain {
  name: string;
  /** Omitted = always available (matches the underlying endpoint's own gate, e.g. dashboard summary). */
  resource?: Resource;
  description: string;
  run: (args: ChatToolArgs, actor: Session) => Promise<unknown>;
}

const MAX_ROWS = 25;

function makeListDomain(
  name: string,
  resource: Resource,
  description: string,
  searchColumns: string[],
  list: (options: QueryOptions, actor: Session) => Promise<{ rows: unknown[]; total: number }>,
): ChatDomain {
  return {
    name,
    resource,
    description,
    async run(args, actor) {
      const options: QueryOptions = {
        page: 1,
        pageSize: Math.min(args.limit ?? MAX_ROWS, MAX_ROWS),
        ...(args.search ? { search: { columns: searchColumns, term: args.search } } : {}),
        ...(args.status ? { filters: [{ column: "status", op: "eq" as const, value: args.status }] } : {}),
      };
      const { rows, total } = await list(options, actor);
      return { total, rows };
    },
  };
}

const searchAndStatusParams = {
  type: "OBJECT" as const,
  properties: {
    search: { type: "STRING", description: "Free-text search (name, id, reason, etc.)" },
    status: { type: "STRING", description: "Exact status to filter by, if the user mentioned one" },
    limit: { type: "NUMBER", description: "Max rows to return (default 25, max 25)" },
  },
};

export const CHAT_DOMAINS: ChatDomain[] = [
  makeListDomain("query_patients", "patients", "Search/list patients registered at this hospital.", PATIENT_LIST_CONFIG.searchColumns, listPatients),
  makeListDomain("query_appointments", "appointments", "Search/list appointments.", APPOINTMENT_LIST_CONFIG.searchColumns, listAppointments),
  makeListDomain("query_opd", "opd", "Search/list OPD (outpatient) visits/queue.", OPD_LIST_CONFIG.searchColumns, listOpd),
  makeListDomain("query_prescriptions", "prescriptions", "Search/list prescriptions.", RX_LIST_CONFIG.searchColumns, listPrescriptions),
  makeListDomain("query_pharmacy", "pharmacy", "Search/list pharmacy stock items.", PHARMACY_LIST_CONFIG.searchColumns, listPharmacy),
  makeListDomain("query_lab", "lab", "Search/list lab test orders (in-house and routed to partner labs).", LAB_LIST_CONFIG.searchColumns, listLab),
  makeListDomain("query_radiology", "radiology", "Search/list radiology studies (in-house and routed to partner centers).", RADIOLOGY_LIST_CONFIG.searchColumns, listRadiology),
  makeListDomain("query_ipd", "ipd", "Search/list IPD (in-patient) admissions.", IPD_LIST_CONFIG.searchColumns, listIpd),
  makeListDomain("query_ot", "ot", "Search/list operation theatre schedules.", OT_LIST_CONFIG.searchColumns, listOt),
  makeListDomain("query_beds", "beds", "Search/list beds and their occupancy status.", BEDS_LIST_CONFIG.searchColumns, listBeds),
  makeListDomain("query_billing", "billing", "Search/list patient bills.", BILLING_LIST_CONFIG.searchColumns, listBills),
  makeListDomain("query_staff", "staff", "Search/list hospital staff.", STAFF_LIST_CONFIG.searchColumns, listStaff),
  makeListDomain("query_inventory", "inventory", "Search/list inventory items and stock levels.", ITEMS_LIST_CONFIG.searchColumns, listItems),
  makeListDomain("query_tasks", "tasks", "Search/list the staff task board.", TASKS_LIST_CONFIG.searchColumns, listTasks),
  makeListDomain("query_ambulance_calls", "ambulance", "Search/list ambulance call logs.", CALLS_LIST_CONFIG.searchColumns, listCalls),
  makeListDomain("query_blood_stock", "bloodbank", "Search/list blood bank stock by group/component.", STOCK_LIST_CONFIG.searchColumns, listStock),
  makeListDomain("query_tpa_claims", "tpa", "Search/list TPA/insurance claims.", CLAIMS_LIST_CONFIG.searchColumns, listClaims),
  makeListDomain("query_documents", "documents", "Search/list uploaded documents.", DOCUMENTS_LIST_CONFIG.searchColumns, listDocuments),
  makeListDomain("query_finance_income", "finance", "Search/list finance income entries.", ["category", "description", "invoice_number"], incomeService.list),
  makeListDomain("query_finance_expense", "finance", "Search/list finance expense entries.", ["category", "description", "invoice_number"], expenseService.list),
  {
    name: "get_reports_summary",
    resource: "reports",
    description: "Get aggregate operational/financial report figures for this hospital.",
    async run(_args, actor) {
      return getReports(actor);
    },
  },
  {
    name: "get_dashboard_summary",
    description: "Get headline dashboard counts (patients, today's appointments, OPD waiting, beds available, pending bills, low stock, pending labs, revenue).",
    async run(_args, actor) {
      return getDashboardStats(actor);
    },
  },
];

/** Domains this actor's role may use, turned into Gemini tool declarations. */
export function buildToolsForActor(actor: Session): ToolDeclaration[] {
  return availableDomains(actor).map((d) => ({
    name: d.name,
    description: d.description,
    parameters: d.name.startsWith("query_") ? searchAndStatusParams : { type: "OBJECT" as const, properties: {} },
  }));
}

function availableDomains(actor: Session): ChatDomain[] {
  return CHAT_DOMAINS.filter((d) => !d.resource || can(actor.role, d.resource, "read"));
}

/** Executes a tool call, re-checking permission server-side regardless of what the model was offered. */
export async function executeTool(
  name: string,
  args: ChatToolArgs,
  actor: Session,
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  const domain = CHAT_DOMAINS.find((d) => d.name === name);
  if (!domain) return { ok: false, error: `Unknown tool: ${name}` };
  if (domain.resource && !can(actor.role, domain.resource, "read")) {
    return { ok: false, error: "You don't have permission to view this data." };
  }
  try {
    const result = await domain.run(args, actor);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
