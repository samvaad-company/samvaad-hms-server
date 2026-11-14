/** One issued combined bill, as it was issued. */
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import { getCombinedBill } from "@/services/combined-bill-service";

export const GET = withRoute(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requirePermission("billing", "read");
  return ok(await getCombinedBill(parseId((await ctx.params).id), session));
});
