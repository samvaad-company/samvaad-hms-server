import { actionRoute, parseId } from "@/http/crud";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { validate } from "@/lib/validation";
import { restockItem } from "@/services/pharmacy-service";

const schema = { quantity: { type: "number", required: true, min: 1 } } as const;

export const POST = actionRoute("pharmacy", "write", async (req, ctx, session) => {
  const { id } = await ctx.params;
  const { quantity } = validate(schema, await readJson(req));
  return ok(await restockItem(parseId(id), quantity, session));
});
