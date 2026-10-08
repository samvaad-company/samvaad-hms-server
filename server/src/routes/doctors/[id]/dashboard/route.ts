import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { getDoctorDashboard } from "@/services/doctors-service";

export const GET = actionRoute("doctors", "read", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await getDoctorDashboard(parseId(id), session));
});
