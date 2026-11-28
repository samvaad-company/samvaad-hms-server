import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { created, ok } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { createPortalAppointment } from "@/services/appointment-scheduling-service";
import { listPatientAppointments } from "@/services/portal-appointments-service";
import { NO_STORE, pageParams } from "@/services/portal-common";

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

/** Patient app: the patient's appointments, in person and video. ?patientId=…&scope=upcoming|past|all&page=1&pageSize=20 */
export const GET = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  const q = new URL(req.url, "http://localhost").searchParams;
  const { page, pageSize } = pageParams(q);
  return ok(await listPatientAppointments(portalPatientId(q.get("patientId")), q.get("scope") ?? "all", page, pageSize), NO_STORE);
});
