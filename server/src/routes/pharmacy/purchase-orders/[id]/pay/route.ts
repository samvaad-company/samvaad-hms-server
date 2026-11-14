/** A credit purchase bill has been paid to the supplier. */
import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { payPurchaseOrder } from "@/services/pharmacy-orders-service";

export const POST = actionRoute("pharmacy", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await payPurchaseOrder(parseId(id), session));
});
