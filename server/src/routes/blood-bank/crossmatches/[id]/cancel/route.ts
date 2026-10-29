import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { cancelCrossmatch } from "@/services/bloodbank-flow-service";

export const POST = actionRoute("bloodbank", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await cancelCrossmatch(parseId(id), session));
});
