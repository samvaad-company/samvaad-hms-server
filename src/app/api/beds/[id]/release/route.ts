import { actionRoute, parseId } from "@/server/http/crud";
import { ok } from "@/server/http/response";
import { releaseBed } from "@/server/services/beds-service";

export const POST = actionRoute("beds", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await releaseBed(parseId(id), session));
});
