import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { portalDeleteUpload } from "@/services/portal-records-service";

/** Patient app: the patient removes their own upload, only while it is still waiting for the hospital to look at it. ?patientId=… (id: 12 or doc-12) */
export const DELETE = withRoute(async (req: ApiRequest, ctx: { params: Promise<{ id: string }> }) => {
  requirePortalKey(req);
  await portalDeleteUpload((await ctx.params).id, portalPatientId(new URL(req.url, "http://localhost").searchParams.get("patientId")));
  return ok({ deleted: true });
});
