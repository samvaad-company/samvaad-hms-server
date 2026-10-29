import { noContent } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { fileDocument } from "@/services/mrd-documents-service";

/** { folderId } — put an existing document in a folder, or { folderId: null } to take it out. */
export const POST = actionRoute("mrd", "write", async (req, ctx, session) => {
  await fileDocument(parseId((await ctx.params).id), await readJson(req).catch(() => ({})), session);
  return noContent();
});
