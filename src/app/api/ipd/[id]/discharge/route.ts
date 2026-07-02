import { actionRoute, parseId } from "@/server/http/crud";
import { ok } from "@/server/http/response";
import { dischargePatient } from "@/server/services/ipd-service";

export const POST = actionRoute("ipd", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await dischargePatient(parseId(id), session));
});
