import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { resolveDeficiency } from "@/services/mrd-coding-service";

export const POST = actionRoute("mrd", "write", async (_req, ctx, session) => {
  return ok(await resolveDeficiency(parseId((await ctx.params).id), session));
});
