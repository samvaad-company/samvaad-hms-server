/** Receiving a purchase order adds its quantities to pharmacy stock. */
import { actionRoute, parseId } from "@/server/http/crud";
import { ok } from "@/server/http/response";
import { receivePurchaseOrder } from "@/server/services/pharmacy-orders-service";

export const POST = actionRoute("pharmacy", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await receivePurchaseOrder(parseId(id), session));
});
