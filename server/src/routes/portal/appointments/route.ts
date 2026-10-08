import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { created } from "@/http/response";
import { requirePortalKey } from "@/auth/portal";
import { createPortalAppointment } from "@/services/appointment-scheduling-service";

/**
 * Patient app: book an IN-PERSON appointment. Body `{ patientId, doctorId, date: "YYYY-MM-DD", time: "HH:mm", reason }`.
 * Checked against the doctor's schedule (in-person slots only, per-hour quota) — so a full hour or a video-only
 * time is refused with a message to show the patient.
 */
export const POST = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  const body = await req.json().catch(() => ({}));
  return created(await createPortalAppointment(body));
});
