import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { reopenCase } from "@/services/mrd-coding-service";

export const POST = actionRoute("mrd", "write", async (req, ctx, session) => {
  const body = await readJson(req).catch(() => ({}));
  return ok(await reopenCase(parseId((await ctx.params).id), body, session));
});
