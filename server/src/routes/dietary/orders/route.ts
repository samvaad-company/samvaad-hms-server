import { withRoute } from "@/http/handler";
import { ok, created } from "@/http/response";
import { readJson } from "@/http/query";
import { requirePermission } from "@/auth/server";
import { createOrder, listOrders } from "@/services/dietary-service";

/** ?wardId=&status=Active|Stopped */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("ipd", "read");
  const q = new URL(req.url).searchParams;
  return ok(await listOrders({ wardId: q.get("wardId") ? Number(q.get("wardId")) : undefined, status: q.get("status") || undefined }, session));
});

/** { admissionId, dietTypeId, meals?, instructions? } — a patient's new diet order; it replaces their current one. */
export const POST = withRoute(async (req) => {
  const session = await requirePermission("ipd", "write");
  return created(await createOrder(await readJson(req), session));
});
