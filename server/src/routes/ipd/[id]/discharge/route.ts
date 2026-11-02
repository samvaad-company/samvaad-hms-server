import { actionRoute, parseId } from "@/http/crud";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { dischargePatient } from "@/services/ipd-service";

export const POST = actionRoute("ipd", "write", async (req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await dischargePatient(parseId(id), session, await readJson(req)));
});
