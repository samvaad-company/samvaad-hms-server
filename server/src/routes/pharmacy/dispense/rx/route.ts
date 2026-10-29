import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { BadRequestError } from "@/lib/errors";
import { requirePermission } from "@/auth/server";
import { patientRx } from "@/services/dispense-service";

/** ?patientId= — the patient's prescriptions not yet dispensed, matched to stock. */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("pharmacy", "read");
  const patientId = Number(new URL(req.url).searchParams.get("patientId"));
  if (!Number.isInteger(patientId) || patientId <= 0) throw new BadRequestError("patientId is required");
  return ok(await patientRx(patientId, session));
});
