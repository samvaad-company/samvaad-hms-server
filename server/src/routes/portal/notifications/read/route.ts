/**
 * Patient portal: mark notifications and updates read. Body `{ patientId, ids: [...] }` or `{ patientId, all: true }`.
 * `ids` take awareness programme ids (31 or "aw-31") and update ids ("rx-7", "lab-31", "bill-311", "appt-91", "fu-5"). Returns the fresh bell list.
 */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { portalMarkUpdatesRead } from "@/services/portal-updates-service";

export const POST = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return ok(await portalMarkUpdatesRead(portalPatientId(body.patientId), body));
});
