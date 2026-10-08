import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { activateHospital } from "@/services/hospitals-service";

export const POST = actionRoute("admin", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await activateHospital(parseId(id), session));
});
