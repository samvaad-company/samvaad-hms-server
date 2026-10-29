import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { startReview } from "@/services/mrd-coding-service";

export const POST = actionRoute("mrd", "write", async (_req, ctx, session) => {
  return ok(await startReview(parseId((await ctx.params).id), session));
});
