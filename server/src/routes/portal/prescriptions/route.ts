import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { portalPrescriptions } from "@/services/portal-prescriptions-service";
import { NO_STORE, pageParams } from "@/services/portal-common";

/** Patient app: the patient's prescriptions, newest first (drafts are not shown). ?patientId=…&page=1&pageSize=20 */
export const GET = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  const q = new URL(req.url, "http://localhost").searchParams;
  const { page, pageSize } = pageParams(q);
  return ok(await portalPrescriptions(portalPatientId(q.get("patientId")), page, pageSize), NO_STORE);
});
