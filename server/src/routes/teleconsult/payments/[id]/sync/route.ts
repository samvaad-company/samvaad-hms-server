import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { syncBookingForStaff } from "@/services/teleconsult-payments";

/** Staff: re-check a booking's payment with the gateway now (id = booking id). */
export const POST = actionRoute("teleconsult", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await syncBookingForStaff(parseId(id), session));
});
