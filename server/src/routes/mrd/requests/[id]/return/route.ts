import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { markRequestReturned } from "@/services/mrd-files-service";

export const POST = actionRoute("mrd", "write", async (_req, ctx, session) => {
  return ok(await markRequestReturned(parseId((await ctx.params).id), session));
});
