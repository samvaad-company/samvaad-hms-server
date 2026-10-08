import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { getHospital } from "@/services/hospitals-service";

export const GET = actionRoute("admin", "read", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await getHospital(parseId(id), session));
});
