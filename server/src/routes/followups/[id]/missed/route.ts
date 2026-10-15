import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { markFollowUpMissed } from "@/services/followups-service";

export const POST = actionRoute("followups", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await markFollowUpMissed(parseId(id), session));
});
