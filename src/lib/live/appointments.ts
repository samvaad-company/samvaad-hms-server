import { useMemo } from "react";
import { useAppSelector } from "@/store";
import type { AppointmentDTO } from "@/types/api";

/**
 * The fetched appointments plus any the server has pushed that the fetch doesn't have yet (newest first, each once).
 * The fetched version of an appointment always wins, so a later edit is never hidden behind its first announcement.
 */
export function mergeLiveAppointments(fetched: AppointmentDTO[], live: AppointmentDTO[]): AppointmentDTO[] {
  if (live.length === 0) return fetched;
  const have = new Set(fetched.map((a) => a.id));
  const extra = live.filter((a) => !have.has(a.id));
  return extra.length === 0 ? fetched : [...extra, ...fetched];
}

/** Pushed appointments for today's date only (`today` is YYYY-MM-DD). */
export function liveForDay(live: AppointmentDTO[], today: string): AppointmentDTO[] {
  return live.filter((a) => a.date === today);
}

/** The appointments the server pushed this session, newest first. */
export function useLiveAppointments(): AppointmentDTO[] {
  return useAppSelector((s) => s.live.appointments);
}

/** `fetched` with the live ones merged in (see `mergeLiveAppointments`); the same array while nothing live is missing from it. */
export function useWithLiveAppointments(fetched: AppointmentDTO[]): AppointmentDTO[] {
  const live = useLiveAppointments();
  return useMemo(() => mergeLiveAppointments(fetched, live), [fetched, live]);
}

/** Ids of the appointments that arrived live — for marking them "New". */
export function useLiveIds(): Set<number> {
  const live = useLiveAppointments();
  return useMemo(() => new Set(live.map((a) => a.id)), [live]);
}
