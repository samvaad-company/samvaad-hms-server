import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { cancelForPatient } from "@/services/portal-appointments-service";
import { NO_STORE } from "@/services/portal-common";

/**
 * Patient app: the patient cancels their own appointment. Body `{ patientId, reason? }`. Only upcoming ones, and not once it starts within
 * an hour (the message says to call the hospital). A paid video consultation is refunded by the same rule staff use.
 */
export const POST = withRoute(async (req: ApiRequest, ctx: { params: Promise<{ id: string }> }) => {
  requirePortalKey(req);
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return ok(await cancelForPatient(parseId(id), portalPatientId(body.patientId), body), NO_STORE);
});
