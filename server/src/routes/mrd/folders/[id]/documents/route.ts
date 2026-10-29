import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { folderDocuments } from "@/services/mrd-documents-service";

export const GET = actionRoute("mrd", "read", async (_req, ctx, session) => {
  return ok(await folderDocuments(parseId((await ctx.params).id), session));
});
