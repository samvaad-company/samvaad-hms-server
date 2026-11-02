/**
 * An in-process publish/subscribe bus for live events (a new appointment, …) that the dashboards listen to over
 * Server-Sent Events (routes/events/stream). Subscribers are the open dashboard connections of THIS process; events created
 * by another API process reach them through the database change feed (services/change-watcher.ts), which publishes here too.
 * The same event can arrive twice that way (once straight from the code that made it, once from the change feed), so an event
 * is delivered only once per key within a couple of minutes.
 */
export interface LiveEvent<T = unknown> {
  /** Unique within this process; the SSE `id:` line. */
  id: string;
  type: "appointment.created";
  hospitalId: number;
  /** The doctor the event concerns, so a doctor's dashboard can be sent only their own. */
  doctorId: number | null;
  at: string;
  data: T;
}

type Listener = (event: LiveEvent) => void;

const listeners = new Set<Listener>();
const seen = new Map<string, number>();
const DEDUPE_MS = 2 * 60_000;
let counter = 0;

/** Deliver `event` to every subscriber, once per `dedupeKey`. Returns false if it was a repeat. */
export function publish<T>(event: Omit<LiveEvent<T>, "id" | "at">, dedupeKey: string): boolean {
  const now = Date.now();
  if (seen.size > 2000) for (const [k, at] of seen) if (now - at > DEDUPE_MS) seen.delete(k);
  const last = seen.get(dedupeKey);
  if (last !== undefined && now - last < DEDUPE_MS) return false;
  seen.set(dedupeKey, now);
  const full: LiveEvent = { ...event, id: `${now.toString(36)}-${(++counter).toString(36)}`, at: new Date(now).toISOString() };
  for (const l of [...listeners]) {
    try { l(full); } catch { /* one broken connection must not stop the others */ }
  }
  return true;
}

/** Listen to every event; returns the function that stops listening. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscriberCount(): number {
  return listeners.size;
}
