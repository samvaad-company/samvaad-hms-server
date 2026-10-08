import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { getDashboardStats } from "@/services/dashboard-service";

/** Cross-module summary counts for the landing overview. */
export const GET = withRoute(async () => {
  const session = await requireSession();
  return ok(await getDashboardStats(session));
});
