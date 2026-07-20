import { actionRoute, parseId } from "@/server/http/crud";
import { readJson } from "@/server/http/query";
import { ok, noContent } from "@/server/http/response";
import { updateWard, deleteWard } from "@/server/services/wards-service";

export const PATCH = actionRoute("beds", "write", async (req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await updateWard(parseId(id), await readJson(req), session));
});

export const DELETE = actionRoute("beds", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  await deleteWard(parseId(id), session);
  return noContent();
});
