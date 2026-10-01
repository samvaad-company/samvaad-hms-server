import { actionRoute, parseId } from "@/server/http/crud";
import { ok } from "@/server/http/response";
import { pauseHospital } from "@/server/services/hospitals-service";

export const POST = actionRoute("admin", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await pauseHospital(parseId(id), session));
});
