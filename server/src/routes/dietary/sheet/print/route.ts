import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getSheetPrint } from "@/services/dietary-service";

/** ?date=&wardId= — the kitchen sheet laid out for printing. */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("ipd", "read");
  const q = new URL(req.url).searchParams;
  return ok(await getSheetPrint({ date: q.get("date") || undefined, wardId: q.get("wardId") ? Number(q.get("wardId")) : undefined }, session));
});
