import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { portalBills } from "@/services/portal-bills-service";
import { NO_STORE, pageParams } from "@/services/portal-common";

/**
 * Patient app: the patient's bills with the pending total. ?patientId=…&status=pending|paid|all&page=1&pageSize=20
 * `due` is the amount still to pay on a Pending bill and null when it isn't known (a Partial bill: the HMS stores no amount paid).
 */
export const GET = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  const q = new URL(req.url, "http://localhost").searchParams;
  const { page, pageSize } = pageParams(q);
  return ok(await portalBills(portalPatientId(q.get("patientId")), q.get("status") ?? "all", page, pageSize), NO_STORE);
});
