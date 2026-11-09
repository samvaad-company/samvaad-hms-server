/**
 * Patient portal: the awareness programmes this patient may see (their hospital's, and those hospitals posted for all patients), newest first.
 * ?patientId=… [&scope=upcoming|past|all] [&category=…] [&search=…] [&page=1] [&pageSize=20]
 */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { portalList } from "@/services/awareness-service";

export const GET = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  const q = new URL(req.url, "http://localhost").searchParams;
  return ok(await portalList(portalPatientId(q.get("patientId")), q));
});
