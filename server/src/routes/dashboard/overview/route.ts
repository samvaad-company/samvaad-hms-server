import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getOverview } from "@/services/overview-service";

/** ?days=7|14|30 — the admin home in one read: today's needs, the week's numbers, footfall, beds, retention and the queues. */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("reports", "read");
  return ok(await getOverview(Number(new URL(req.url).searchParams.get("days")), session));
});
