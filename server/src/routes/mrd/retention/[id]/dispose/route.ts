import { noContent } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { disposeDocument } from "@/services/mrd-documents-service";

export const POST = actionRoute("mrd", "write", async (req, ctx, session) => {
  await disposeDocument(parseId((await ctx.params).id), await readJson(req).catch(() => ({})), session);
  return noContent();
});
