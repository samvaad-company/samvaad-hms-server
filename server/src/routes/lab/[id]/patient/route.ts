import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { getLabPatientDetail } from "@/services/lab-service";

/** Fetch the fuller patient detail behind one lab test. */
export const GET = actionRoute("lab", "read", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await getLabPatientDetail(parseId(id), session));
});
