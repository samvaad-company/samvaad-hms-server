/** Patient portal: mark notifications read. Body `{ patientId, ids: [programme ids] }` or `{ patientId, all: true }`. Returns the fresh list. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { portalMarkRead } from "@/services/awareness-service";

export const POST = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return ok(await portalMarkRead(portalPatientId(body.patientId), body));
});
