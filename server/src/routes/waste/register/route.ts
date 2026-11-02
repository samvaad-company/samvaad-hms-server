import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getRegister } from "@/services/waste-ic-service";

/** ?from=&to= — the period's collection and disposal entries, for printing. */
export const GET = withRoute(async (req) => {
  const q = new URL(req.url).searchParams;
  return ok(await getRegister({ from: q.get("from") || undefined, to: q.get("to") || undefined }, await requirePermission("cssd", "read")));
});
