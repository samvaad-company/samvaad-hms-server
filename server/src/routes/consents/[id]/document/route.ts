import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { consentDocument } from "@/services/consents-service";

export const GET = actionRoute("consents", "read", async (_req, ctx, session) => {
  return ok(await consentDocument(parseId((await ctx.params).id), session));
});
