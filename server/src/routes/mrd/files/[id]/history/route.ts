import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { fileHistory } from "@/services/mrd-files-service";

export const GET = actionRoute("mrd", "read", async (_req, ctx, session) => {
  return ok(await fileHistory(parseId((await ctx.params).id), session));
});
