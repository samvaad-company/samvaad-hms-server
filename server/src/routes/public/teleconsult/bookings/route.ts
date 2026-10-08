import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { created } from "@/http/response";
import { createPortalBooking, resolveBookingLink } from "@/services/teleconsult-service";

/**
 * Start a booking from the public page. Whose booking it is, and which hospital,
 * come from the signed token — never from the body — and the fee from the hospital.
 */
export const POST = withRoute(async (req: ApiRequest) => {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { patientId } = await resolveBookingLink(typeof body.token === "string" ? body.token : null);
  return created(await createPortalBooking({ ...body, patientId }, "link"));
});
