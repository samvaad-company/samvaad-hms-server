import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { BadRequestError } from "@/lib/errors";
import { createBookingLink } from "@/services/teleconsult-service";

/** Tele-caller / admin: make a signed booking link (valid 7 days) for one patient. */
export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("teleconsult", "write");
  const body = (await req.json().catch(() => ({}))) as { patientId?: unknown };
  const patientId = Number(body.patientId);
  if (!Number.isInteger(patientId) || patientId < 1) throw new BadRequestError("Choose a patient");
  return created(await createBookingLink(patientId, session));
});
