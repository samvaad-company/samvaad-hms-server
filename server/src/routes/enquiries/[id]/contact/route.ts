import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { logEnquiryContact } from "@/services/enquiries-service";

export const POST = actionRoute("enquiries", "write", async (req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await logEnquiryContact(parseId(id), await readJson(req), session));
});
