import { type ApiRequest, ApiResponse } from "@/http/web";
import { withRoute } from "@/http/handler";
import { requirePermission } from "@/auth/server";
import { hospitalIsOpen } from "@/auth/tenant-gate";
import { subscribe } from "@/lib/event-bus";
import { requireHospitalId } from "@/services/hospital-scope";
import { ForbiddenError } from "@/lib/errors";
import { receivesLiveAppointments } from "@shared/lib/live/roles";

/** A comment line every so often keeps proxies from closing a quiet connection. */
const HEARTBEAT_MS = 20_000;
/** The stream ends on its own after this; the browser reconnects at once, which signs it in again (a stale session or a paused hospital can't hold one open). */
const MAX_LIFETIME_MS = 25 * 60_000;

/**
 * Server-Sent Events for the dashboards: `GET /api/events/stream`.
 *
 *   event: ready                 once, when the stream is open (the client reloads what it shows, to cover any gap)
 *   event: appointment.created   { id, type, hospitalId, doctorId, at, data: <the appointment, as GET /api/appointments returns it> }
 *   : ping                       heartbeat
 *
 * Only the hospital admin, the front desk and doctors may open it. They get their own hospital's events and nothing else; a
 * doctor is sent only the appointments made for that doctor (matched by doctor id).
 */
export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("appointments", "read");
  if (!receivesLiveAppointments(session.role)) throw new ForbiddenError("Live appointment events go to the hospital admin, the front desk and doctors");
  const hospitalId = requireHospitalId(session);
  // A doctor is sent only appointments with their own doctor id; a doctor login that isn't linked to a doctor record is sent none.
  const doctorOnly = session.role === "Doctor";
  const ownDoctor = doctorOnly ? session.doctorId ?? -1 : null;
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(chunk)); } catch { cleanup(); }
      };
      const off = subscribe((e) => {
        if (e.hospitalId !== hospitalId) return;
        if (ownDoctor != null && e.doctorId !== ownDoctor) return;
        send(`id: ${e.id}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
      });
      const beat = setInterval(() => {
        void hospitalIsOpen(hospitalId).then((open) => (open ? send(": ping\n\n") : cleanup()));
      }, HEARTBEAT_MS);
      const lifetime = setTimeout(() => cleanup(), MAX_LIFETIME_MS);
      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(beat);
        clearTimeout(lifetime);
        off();
        try { controller.close(); } catch { /* already closed */ }
      };
      req.signal.addEventListener("abort", () => cleanup());
      send(`retry: 5000\n\nevent: ready\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
    },
    cancel() { cleanup(); },
  });

  return new ApiResponse(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no", // nginx: don't hold the stream back
    },
  });
});
