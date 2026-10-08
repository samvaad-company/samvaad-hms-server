import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { parseId } from "@/http/crud";
import { getPortalBookingSynced } from "@/services/teleconsult-payments";

/** Patient app: status of one booking (poll after paying until it's confirmed). */
export const GET = withRoute(async (req: ApiRequest, ctx: { params: Promise<{ id: string }> }) => {
  requirePortalKey(req);
  const { id } = await ctx.params;
  const patientId = portalPatientId(new URL(req.url).searchParams.get("patientId"));
  return ok(await getPortalBookingSynced(parseId(id), patientId));
});
