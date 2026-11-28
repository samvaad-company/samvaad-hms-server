import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { portalPrescription } from "@/services/portal-prescriptions-service";
import { NO_STORE } from "@/services/portal-common";

/**
 * Patient app: one prescription as the data for the half prescription (patient copy). ?patientId=…[&lang=English|Hindi|Gujarati]
 * Never includes the complaint, history, examination or investigations. 404 when it is not this patient's.
 */
export const GET = withRoute(async (req: ApiRequest, ctx: { params: Promise<{ id: string }> }) => {
  requirePortalKey(req);
  const q = new URL(req.url, "http://localhost").searchParams;
  return ok(await portalPrescription(parseId((await ctx.params).id), portalPatientId(q.get("patientId")), q.get("lang")), NO_STORE);
});
