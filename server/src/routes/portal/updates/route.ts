import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { portalUpdates } from "@/services/portal-updates-service";
import { NO_STORE } from "@/services/portal-common";

/**
 * Patient app: what has happened to the patient (new prescription, report ready, bill, appointment change, follow-up due, awareness), newest first.
 * ?patientId=…[&since=ISO][&limit=50]. Mark items read with POST /api/portal/notifications/read.
 */
export const GET = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  const q = new URL(req.url, "http://localhost").searchParams;
  const limit = Math.min(100, Math.max(1, Math.floor(Number(q.get("limit"))) || 50));
  return ok(await portalUpdates(portalPatientId(q.get("patientId")), q.get("since"), limit), NO_STORE);
});
