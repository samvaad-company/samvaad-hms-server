"use client";

/**
 * Keeps one live connection to the server (GET /api/events/stream, Server-Sent Events) for as long as a person who can see
 * appointments is signed in. A new appointment made by anyone in the hospital — a doctor's own, if this is a doctor — arrives
 * here within a moment: it goes into the Redux store (store/liveSlice) so the dashboards show it at once, a notification pops up
 * (components/live/LiveToasts) for everyone but the person who made it, and every query on screen is refreshed so counts and lists
 * catch up with the server.
 *
 * The browser reconnects by itself after a dropped connection (the server asks it to wait 5 s). Anything that happened while the
 * connection was down is picked up by the refresh that follows every reconnect.
 */
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAppDispatch } from "@/store";
import { invalidateAll } from "@/store/cacheSlice";
import { appointmentReceived, connectionChanged, liveCleared } from "@/store/liveSlice";
import { receivesLiveAppointments } from "@/lib/live/roles";
import type { AppointmentDTO } from "@/types/api";

type LiveSource = "staff" | "patient-app" | "whatsapp" | "video-consult" | "other";

/** The notification's "who/what": empty when unknown. */
function viaText(source: LiveSource, by: { name: string } | null): string {
  if (source === "staff") return by ? `booked by ${by.name}` : "booked at the desk";
  if (source === "patient-app") return "via the patient app";
  if (source === "whatsapp") return "via WhatsApp";
  if (source === "video-consult") return "video consultation";
  return "";
}

const STREAM_URL = "/api/events/stream";
/** If the browser gives up (a refused connection ends the stream for good), try again after this long, doubling up to the cap. */
const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 60_000;

export function LiveAppointmentsListener() {
  const { user, can } = useAuth();
  const dispatch = useAppDispatch();
  // Only the hospital admin, the front desk and doctors are sent these (the server enforces it too, and sends a doctor only their own).
  const listens = !!user && can("appointments") && receivesLiveAppointments(user.role);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!listens || typeof EventSource === "undefined") return;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let delay = RETRY_MIN_MS;
    let connectedBefore = false;
    let stopped = false;

    const open = () => {
      if (stopped) return;
      dispatch(connectionChanged(connectedBefore ? "reconnecting" : "connecting"));
      es = new EventSource(STREAM_URL);

      es.addEventListener("ready", () => {
        delay = RETRY_MIN_MS;
        dispatch(connectionChanged("live"));
        // After a drop, whatever happened meanwhile is fetched; the very first connection has nothing to catch up on.
        if (connectedBefore) dispatch(invalidateAll());
        connectedBefore = true;
      });

      es.addEventListener("appointment.created", (ev) => {
        try {
          const event = JSON.parse((ev as MessageEvent<string>).data) as { at: string; source?: LiveSource; by?: { userId: number; name: string } | null; data: AppointmentDTO };
          // The person who just made it is looking at it already; everyone else is told.
          const madeByMe = event.by != null && event.by.userId === userId;
          dispatch(appointmentReceived({ appointment: event.data, at: event.at, ...(madeByMe ? {} : { notify: { via: viaText(event.source ?? "other", event.by ?? null) } }) }));
          dispatch(invalidateAll());
        } catch {
          /* a malformed event is ignored; the next refresh shows the truth */
        }
      });

      es.onerror = () => {
        dispatch(connectionChanged("reconnecting"));
        // CONNECTING: the browser is already retrying. CLOSED: it gave up (server said no, e.g. the session ended) — we retry, slowly.
        if (es && es.readyState === EventSource.CLOSED) {
          es.close();
          es = null;
          retry = setTimeout(open, delay);
          delay = Math.min(delay * 2, RETRY_MAX_MS);
        }
      };
    };

    // The browser knows when the network goes away before an open stream does (a laptop waking up, a phone changing network).
    const onOffline = () => {
      clearTimeout(retry);
      es?.close();
      es = null;
      dispatch(connectionChanged("reconnecting"));
    };
    const onOnline = () => {
      if (es) return;
      clearTimeout(retry);
      delay = RETRY_MIN_MS;
      open();
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    open();
    return () => {
      stopped = true;
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      clearTimeout(retry);
      es?.close();
      dispatch(connectionChanged("idle"));
    };
  }, [listens, userId, dispatch]);

  // Signing out (or in as someone else) must not leave the last person's hospital in memory: when the person changes, what was pushed to the last one goes.
  useEffect(() => () => { dispatch(liveCleared()); }, [userId, dispatch]);

  return null;
}
