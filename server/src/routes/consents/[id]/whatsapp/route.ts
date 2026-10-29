import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { sendConsentWhatsApp } from "@/services/consents-service";

/** { phone? } — (re)send the live signing link to the patient on WhatsApp. */
export const POST = actionRoute("consents", "write", async (req, ctx, session) => {
  const body = await readJson(req).catch(() => ({}));
  return ok(await sendConsentWhatsApp(parseId((await ctx.params).id), body, session));
});
