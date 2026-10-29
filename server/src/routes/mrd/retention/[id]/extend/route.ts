import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { extendRetention } from "@/services/mrd-documents-service";

export const POST = actionRoute("mrd", "write", async (req, ctx, session) => {
  const body = await readJson(req).catch(() => ({}));
  return ok(await extendRetention(parseId((await ctx.params).id), body, session));
});
