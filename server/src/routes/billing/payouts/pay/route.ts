import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { requirePermission } from "@/auth/server";
import { payPayouts } from "@/services/payouts-service";

/** { ids: number[] } — mark pending payouts as paid out today. */
export const POST = withRoute(async (req) => {
  const session = await requirePermission("billing", "write");
  return ok(await payPayouts(await readJson(req), session));
});
