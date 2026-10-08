import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { recordDonation } from "@/services/bloodbank-service";

export const POST = actionRoute("bloodbank", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await recordDonation(parseId(id), session));
});
