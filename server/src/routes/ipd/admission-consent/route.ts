/** ?patientId= — is there a signed admission consent ready to admit this patient on? */
import { actionRoute } from "@/http/crud";
import { ok } from "@/http/response";
import { BadRequestError } from "@/lib/errors";
import { admissionConsentStatus } from "@/services/ipd-service";

export const GET = actionRoute("ipd", "read", async (req, _ctx, session) => {
  const patientId = Number(new URL(req.url, "http://localhost").searchParams.get("patientId"));
  if (!Number.isInteger(patientId) || patientId <= 0) throw new BadRequestError("Choose a patient");
  return ok(await admissionConsentStatus(patientId, session));
});
