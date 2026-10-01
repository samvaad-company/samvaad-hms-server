import { actionRoute, parseId } from "@/server/http/crud";
import { ok } from "@/server/http/response";
import { getHospitalAnalytics } from "@/server/services/hospitals-service";

export const GET = actionRoute("admin", "read", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await getHospitalAnalytics(parseId(id), session));
});
