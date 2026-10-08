import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { getPatientAppointment } from "@/services/appointment-scheduling-service";

/** Patient app: one of the patient's appointments, with whether and why it can or can't be rescheduled. ?patientId=… */
export const GET = withRoute(async (req: ApiRequest, ctx: { params: Promise<{ id: string }> }) => {
  requirePortalKey(req);
  const { id } = await ctx.params;
  return ok(await getPatientAppointment(parseId(id), portalPatientId(new URL(req.url).searchParams.get("patientId"))));
});
