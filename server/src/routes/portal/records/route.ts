import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { portalRecords } from "@/services/portal-records-service";
import { NO_STORE, pageParams } from "@/services/portal-common";

/** Patient app: the patient's lab and radiology reports and documents. ?patientId=…&kind=all|lab|radiology|document&page=1&pageSize=20 */
export const GET = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  const q = new URL(req.url, "http://localhost").searchParams;
  const { page, pageSize } = pageParams(q);
  const kind = ["lab", "radiology", "document"].includes(q.get("kind") ?? "") ? q.get("kind")! : "all";
  return ok(await portalRecords(portalPatientId(q.get("patientId")), kind, page, pageSize), NO_STORE);
});
