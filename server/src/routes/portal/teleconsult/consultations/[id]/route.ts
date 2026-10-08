import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { getPatientConsultation } from "@/services/teleconsult-service";

/** Patient app: one video consultation (id = the appointment id). ?patientId=… */
export const GET = withRoute(async (req: ApiRequest, ctx: { params: Promise<{ id: string }> }) => {
  requirePortalKey(req);
  const { id } = await ctx.params;
  const patientId = portalPatientId(new URL(req.url).searchParams.get("patientId"));
  return ok(await getPatientConsultation(parseId(id), patientId));
});
