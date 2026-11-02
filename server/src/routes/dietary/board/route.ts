import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getBoard } from "@/services/dietary-service";

/** ?date=&wardId= — the ward's active diet orders for the day, and where its kitchen sheet has got to. */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("ipd", "read");
  const q = new URL(req.url).searchParams;
  return ok(await getBoard({ date: q.get("date") || undefined, wardId: q.get("wardId") ? Number(q.get("wardId")) : undefined }, session));
});
