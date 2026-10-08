import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { lookupPortalPayment } from "@/services/teleconsult-payments";

/**
 * Patient app, straight after checkout: find this transaction and, once it is
 * confirmed, get the appointment details with it.
 *   ?patientId=…&orderId=…  |  &paymentId=…  |  &bookingId=…
 * → { found, booking, payment, consultation }   (found:false until it exists for this patient)
 */
export const GET = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  const q = new URL(req.url).searchParams;
  const bookingId = Number(q.get("bookingId"));
  return ok(
    await lookupPortalPayment(portalPatientId(q.get("patientId")), {
      orderId: q.get("orderId"),
      paymentId: q.get("paymentId"),
      bookingId: Number.isInteger(bookingId) && bookingId > 0 ? bookingId : null,
    }),
  );
});
