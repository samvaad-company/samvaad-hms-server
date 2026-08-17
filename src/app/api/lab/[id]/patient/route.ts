import { actionRoute, parseId } from "@/server/http/crud";
import { ok } from "@/server/http/response";
import { getLabPatientDetail } from "@/server/services/lab-service";

/** Fetch the fuller patient detail behind one lab test. */
export const GET = actionRoute("lab", "read", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await getLabPatientDetail(parseId(id), session));
});
