import { actionRoute, parseId } from "@/http/crud";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { assignBed } from "@/services/beds-service";

export const POST = actionRoute("beds", "write", async (req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await assignBed(parseId(id), await readJson(req), session));
});
