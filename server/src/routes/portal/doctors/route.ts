import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { portalDoctors } from "@/services/portal-appointments-service";

/** Patient app: the doctors the patient can book, with their weekly hours and next open time. ?patientId=…&mode=in_person|video */
export const GET = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  const q = new URL(req.url, "http://localhost").searchParams;
  return ok(await portalDoctors(portalPatientId(q.get("patientId")), q.get("mode")));
});
