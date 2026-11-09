/** Patient portal: the notifications under the bell for one patient: new and cancelled awareness programmes of the last 45 days. ?patientId=… */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { portalNotifications } from "@/services/awareness-service";

export const GET = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  return ok(await portalNotifications(portalPatientId(new URL(req.url, "http://localhost").searchParams.get("patientId"))));
});
