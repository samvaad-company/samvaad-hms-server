import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getReports } from "@/services/reports-service";

export const GET = withRoute(async () => {
  const session = await requirePermission("reports", "read");
  return ok(await getReports(session));
});
