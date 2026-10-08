import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { videoDoctorsForPatient } from "@/services/teleconsult-service";

/** Patient app: the doctors this patient can book a VIDEO consultation with (those who have turned video on). ?patientId=… */
export const GET = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  return ok(await videoDoctorsForPatient(portalPatientId(new URL(req.url).searchParams.get("patientId"))));
});
