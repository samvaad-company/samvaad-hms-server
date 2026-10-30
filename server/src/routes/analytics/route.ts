import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getAnalytics } from "@/services/analytics-service";

/** ?range=day|week|month — trends (period so far vs the one before) plus today's figures. */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("reports", "read");
  return ok(await getAnalytics(new URL(req.url).searchParams.get("range") ?? "day", session));
});
