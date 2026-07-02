import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { getReports } from "@/server/services/reports-service";

export const GET = withRoute(async () => {
  await requirePermission("reports", "read");
  return ok(await getReports());
});
