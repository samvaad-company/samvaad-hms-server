import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { returnSet } from "@/services/cssd-service";

export const POST = actionRoute("cssd", "write", async (req, ctx, session) => {
  const body = await readJson(req).catch(() => ({}));
  return ok(await returnSet(parseId((await ctx.params).id), body, session));
});
