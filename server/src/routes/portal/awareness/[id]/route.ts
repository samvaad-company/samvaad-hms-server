/** Patient portal: one programme in full (with its details). Opening it marks it read for this patient. ?patientId=… */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { portalGet } from "@/services/awareness-service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  requirePortalKey(req);
  return ok(await portalGet(portalPatientId(new URL(req.url, "http://localhost").searchParams.get("patientId")), parseId((await ctx.params).id)));
});
