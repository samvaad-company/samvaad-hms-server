import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { portalBill } from "@/services/portal-bills-service";
import { NO_STORE } from "@/services/portal-common";

/** Patient app: one bill with its lines. ?patientId=… (404 when it is not this patient's) */
export const GET = withRoute(async (req: ApiRequest, ctx: { params: Promise<{ id: string }> }) => {
  requirePortalKey(req);
  return ok(await portalBill(parseId((await ctx.params).id), portalPatientId(new URL(req.url, "http://localhost").searchParams.get("patientId"))), NO_STORE);
});
