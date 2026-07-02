import { actionRoute, parseId } from "@/server/http/crud";
import { readJson } from "@/server/http/query";
import { ok } from "@/server/http/response";
import { validate } from "@/server/lib/validation";
import { transferBed } from "@/server/services/ipd-service";

const schema = { bedId: { type: "number", required: true, min: 1 } } as const;

export const POST = actionRoute("ipd", "write", async (req, ctx, session) => {
  const { id } = await ctx.params;
  const { bedId } = validate(schema, await readJson(req));
  return ok(await transferBed(parseId(id), bedId, session));
});
