import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listSalaries } from "@/services/hr-payroll-service";

export const GET = withRoute(async () => ok(await listSalaries(await requirePermission("payroll", "read"))));
