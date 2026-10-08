import { actionRoute, parseId } from "@/http/crud";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { validate } from "@/lib/validation";
import { transferBed } from "@/services/ipd-service";

const schema = { bedId: { type: "number", required: true, min: 1 } } as const;

export const POST = actionRoute("ipd", "write", async (req, ctx, session) => {
  const { id } = await ctx.params;
  const { bedId } = validate(schema, await readJson(req));
  return ok(await transferBed(parseId(id), bedId, session));
});
