import { actionRoute, parseId } from "@/server/http/crud";
import { readJson } from "@/server/http/query";
import { ok } from "@/server/http/response";
import { validate } from "@/server/lib/validation";
import { restockItem } from "@/server/services/pharmacy-service";

const schema = { quantity: { type: "number", required: true, min: 1 } } as const;

export const POST = actionRoute("pharmacy", "write", async (req, ctx, session) => {
  const { id } = await ctx.params;
  const { quantity } = validate(schema, await readJson(req));
  return ok(await restockItem(parseId(id), quantity, session));
});
