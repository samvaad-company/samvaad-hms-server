import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requireSession } from "@/server/auth/server";
import { getDashboardStats } from "@/server/services/dashboard-service";

/** Cross-module summary counts for the landing overview. */
export const GET = withRoute(async () => {
  const session = await requireSession();
  return ok(await getDashboardStats(session));
});
