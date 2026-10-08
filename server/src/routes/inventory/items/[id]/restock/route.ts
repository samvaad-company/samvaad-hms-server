import { actionRoute, parseId } from "@/http/crud";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { restockItem } from "@/services/inventory-service";

export const POST = actionRoute("inventory", "write", async (req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await restockItem(parseId(id), await readJson(req), session));
});
