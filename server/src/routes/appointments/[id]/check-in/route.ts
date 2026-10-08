/** Issues an OPD token for a booked appointment. */
import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { checkInAppointment } from "@/services/appointments-service";

export const POST = actionRoute("appointments", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await checkInAppointment(parseId(id), session));
});
