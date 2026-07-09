import { actionRoute, parseId } from "@/server/http/crud";
import { ok } from "@/server/http/response";
import { recordDonation } from "@/server/services/bloodbank-service";

export const POST = actionRoute("bloodbank", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await recordDonation(parseId(id), session));
});
