import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { releaseBed } from "@/services/beds-service";

export const POST = actionRoute("beds", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await releaseBed(parseId(id), session));
});
