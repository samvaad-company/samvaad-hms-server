import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { createLink } from "@/services/consents-service";

export const POST = actionRoute("consents", "write", async (req, ctx, session) => {
  const body = await readJson(req).catch(() => ({}));
  return ok(await createLink(parseId((await ctx.params).id), body, session));
});
