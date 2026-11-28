import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { portalUpdateRequests } from "@/services/portal-profile-service";
import { NO_STORE } from "@/services/portal-common";

/** Patient app: the patient's own change requests and their status. ?patientId=… */
export const GET = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  return ok(await portalUpdateRequests(portalPatientId(new URL(req.url, "http://localhost").searchParams.get("patientId"))), NO_STORE);
});
