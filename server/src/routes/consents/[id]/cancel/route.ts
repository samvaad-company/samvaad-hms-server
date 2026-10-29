import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { cancelLink } from "@/services/consents-service";

export const POST = actionRoute("consents", "write", async (_req, ctx, session) => {
  return ok(await cancelLink(parseId((await ctx.params).id), session));
});
