import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { rescheduleForPatient } from "@/services/appointment-scheduling-service";

/**
 * Patient app: the patient moves their own appointment (in-person or video). Body `{ patientId, date, time }`.
 * Same doctor, same kind of visit, one of that doctor's open slots. Refused when it starts within an hour or has
 * already been moved three times — the message says to call the hospital.
 */
export const POST = withRoute(async (req: ApiRequest, ctx: { params: Promise<{ id: string }> }) => {
  requirePortalKey(req);
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return ok(await rescheduleForPatient(parseId(id), portalPatientId(body.patientId), body));
});
