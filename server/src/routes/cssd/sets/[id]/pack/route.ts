import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { packSet } from "@/services/cssd-service";

export const POST = actionRoute("cssd", "write", async (req, ctx, session) => {
  const body = await readJson(req).catch(() => ({}));
  return ok(await packSet(parseId((await ctx.params).id), body, session));
});
