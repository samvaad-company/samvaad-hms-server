import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listRuns, generateRun } from "@/services/hr-payroll-service";

export const GET = withRoute(async () => ok(await listRuns(await requirePermission("payroll", "read"))));

/** { month: "YYYY-MM" } — works out the month's payslips (recalculates a draft). */
export const POST = withRoute(async (req) => {
  const session = await requirePermission("payroll", "write");
  return created(await generateRun(await readJson(req), session));
});
