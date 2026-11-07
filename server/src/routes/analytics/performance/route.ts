import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getPerformance } from "@/services/performance-service";

/**
 * ?from=YYYY-MM-DD&to=YYYY-MM-DD&compare=previous|year|none&interval=day|week|month&doctorId=&billType=&visitType=
 * How the hospital is doing and growing over the chosen period.
 */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("reports", "read");
  return ok(await getPerformance(new URL(req.url, "http://localhost").searchParams, session));
});
