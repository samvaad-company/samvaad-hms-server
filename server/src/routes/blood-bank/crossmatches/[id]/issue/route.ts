import { actionRoute, parseId } from "@/http/crud";
import { created } from "@/http/response";
import { issueFromCrossmatch } from "@/services/bloodbank-flow-service";

export const POST = actionRoute("bloodbank", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return created(await issueFromCrossmatch(parseId(id), session));
});
