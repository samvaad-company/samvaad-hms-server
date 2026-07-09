import { actionRoute, parseId } from "@/server/http/crud";
import { readJson } from "@/server/http/query";
import { ok } from "@/server/http/response";
import { restockItem } from "@/server/services/inventory-service";

export const POST = actionRoute("inventory", "write", async (req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await restockItem(parseId(id), await readJson(req), session));
});
