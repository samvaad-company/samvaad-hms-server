import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { portalProfile } from "@/services/portal-profile-service";
import { NO_STORE } from "@/services/portal-common";

/** Patient app: the patient's own details. ?patientId=… */
export const GET = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  return ok(await portalProfile(portalPatientId(new URL(req.url, "http://localhost").searchParams.get("patientId"))), NO_STORE);
});
