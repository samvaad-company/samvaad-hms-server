import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requireSession } from "@/auth/server";
import { rescheduleAppointment } from "@/services/appointment-scheduling-service";

/**
 * Move an appointment to another time: body `{ "date": "YYYY-MM-DD", "time": "HH:mm" }`. Allowed for reception/admin,
 * the appointment's own doctor, and (for video consultations) the tele-caller. The new time has to be one of the
 * doctor's open slots for that kind of visit; the same doctor, mode and rules as booking.
 */
export const POST = withRoute(async (req: ApiRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return ok(await rescheduleAppointment(parseId(id), body, session));
});
