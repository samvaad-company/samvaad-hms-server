import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { getRadiologyPatientDetail } from "@/services/radiology-service";

/** Fetch the fuller patient detail behind one radiology study. */
export const GET = actionRoute("radiology", "read", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await getRadiologyPatientDetail(parseId(id), session));
});
