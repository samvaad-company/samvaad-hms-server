import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { listPatientConsultations } from "@/services/teleconsult-service";

/** Patient app: this patient's video consultations with status and video link. ?patientId=… */
export const GET = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  const patientId = portalPatientId(new URL(req.url).searchParams.get("patientId"));
  return ok(await listPatientConsultations(patientId));
});
