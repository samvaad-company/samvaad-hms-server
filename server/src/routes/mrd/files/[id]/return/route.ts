import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { returnFile } from "@/services/mrd-files-service";

export const POST = actionRoute("mrd", "write", async (req, ctx, session) => {
  const body = await readJson(req).catch(() => ({}));
  return ok(await returnFile(parseId((await ctx.params).id), body, session));
});
