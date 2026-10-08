/** Receiving a purchase order adds its quantities to pharmacy stock. */
import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { receivePurchaseOrder } from "@/services/pharmacy-orders-service";

export const POST = actionRoute("pharmacy", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await receivePurchaseOrder(parseId(id), session));
});
