import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { created } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { createUpdateRequest } from "@/services/portal-profile-service";

/**
 * Patient app: ask the hospital to change the patient's details. Body `{ patientId, changes }` where `changes` may only hold phone, email,
 * address, city, state, pincode, emergencyName, emergencyRelation, emergencyPhone, allergies[], chronicConditions[].
 * Nothing changes in the record until the front desk applies it.
 */
export const POST = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return created(await createUpdateRequest(portalPatientId(body.patientId), body.changes));
});
