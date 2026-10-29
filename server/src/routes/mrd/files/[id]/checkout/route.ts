import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { checkoutFile } from "@/services/mrd-files-service";

export const POST = actionRoute("mrd", "write", async (req, ctx, session) => {
  const body = await readJson(req).catch(() => ({}));
  return ok(await checkoutFile(parseId((await ctx.params).id), body, session));
});
