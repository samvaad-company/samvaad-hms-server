import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { portalAvailability } from "@/services/portal-appointments-service";

/** Patient app: for the date strip, how many open times a doctor has on each of the next days. ?patientId=…&mode=…&from=YYYY-MM-DD&days=14 (at most 31) */
export const GET = withRoute(async (req: ApiRequest, ctx: { params: Promise<{ id: string }> }) => {
  requirePortalKey(req);
  const q = new URL(req.url, "http://localhost").searchParams;
  return ok(await portalAvailability(portalPatientId(q.get("patientId")), parseId((await ctx.params).id), q.get("mode"), q.get("from") ?? "", q.get("days")));
});
