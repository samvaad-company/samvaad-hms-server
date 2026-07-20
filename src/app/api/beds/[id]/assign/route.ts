import { actionRoute, parseId } from "@/server/http/crud";
import { readJson } from "@/server/http/query";
import { ok } from "@/server/http/response";
import { assignBed } from "@/server/services/beds-service";

export const POST = actionRoute("beds", "write", async (req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await assignBed(parseId(id), await readJson(req), session));
});
