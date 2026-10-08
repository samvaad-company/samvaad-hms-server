import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { patientsRepo } from "@/repositories";
import { NotFoundError } from "@/lib/errors";
import { teleconsultConfig } from "@/services/teleconsult-service";

/** Patient app: is video consultation on for this patient's hospital, and at what fee? */
export const GET = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  const patient = await patientsRepo.getRow(portalPatientId(new URL(req.url).searchParams.get("patientId")));
  if (!patient) throw new NotFoundError("Patient");
  const cfg = await teleconsultConfig(patient.hospital_id);
  return ok({
    hospitalId: patient.hospital_id,
    enabled: cfg.enabled && cfg.price != null,
    price: cfg.price,
    currency: cfg.currency,
    paymentMode: cfg.gatewayMode,
  });
});
