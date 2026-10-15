import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { convertEnquiry } from "@/services/enquiries-service";

export const POST = actionRoute("enquiries", "write", async (req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await convertEnquiry(parseId(id), await readJson(req), session));
});
