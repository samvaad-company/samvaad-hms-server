import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { followUpEnquiry } from "@/services/enquiries-service";

export const POST = actionRoute("enquiries", "write", async (req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await followUpEnquiry(parseId(id), await readJson(req), session));
});
