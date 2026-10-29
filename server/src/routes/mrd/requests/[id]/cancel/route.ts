import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { cancelRequest } from "@/services/mrd-files-service";

export const POST = actionRoute("mrd", "write", async (_req, ctx, session) => {
  return ok(await cancelRequest(parseId((await ctx.params).id), session));
});
