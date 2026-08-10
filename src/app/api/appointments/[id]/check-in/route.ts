/** Issues an OPD token for a booked appointment. */
import { actionRoute, parseId } from "@/server/http/crud";
import { ok } from "@/server/http/response";
import { checkInAppointment } from "@/server/services/appointments-service";

export const POST = actionRoute("appointments", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await checkInAppointment(parseId(id), session));
});
