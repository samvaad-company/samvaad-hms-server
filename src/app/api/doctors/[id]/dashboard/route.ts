import { actionRoute, parseId } from "@/server/http/crud";
import { ok } from "@/server/http/response";
import { getDoctorDashboard } from "@/server/services/doctors-service";

export const GET = actionRoute("doctors", "read", async (_req, ctx) => {
  const { id } = await ctx.params;
  return ok(await getDoctorDashboard(parseId(id)));
});
