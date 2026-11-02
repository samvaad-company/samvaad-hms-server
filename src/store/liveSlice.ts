/**
 * Live appointments: what the server pushes over the event stream (see components/live/LiveAppointmentsListener).
 *
 * The list is the dashboards' head start: an appointment that was just made is shown at once, from here, while the normal
 * queries (the API cache) fetch the full picture. Anything the server later returns replaces it — the dashboards merge by id,
 * so nothing is counted twice. Pure (no network, no clock), so it can be tested on its own.
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AppointmentDTO } from "@/types/api";

export type LiveConnection = "idle" | "connecting" | "live" | "reconnecting";

export interface LiveState {
  connection: LiveConnection;
  /** Appointments pushed by the server this session, newest first. */
  appointments: AppointmentDTO[];
  /** How many arrived since the person last looked at them. */
  unseen: number;
  /** When the last one arrived (ISO). */
  lastEventAt: string | null;
}

/** Enough for a busy morning; older ones are in the API's own lists anyway. */
export const LIVE_APPOINTMENTS_CAP = 50;

export const initialLiveState: LiveState = { connection: "idle", appointments: [], unseen: 0, lastEventAt: null };

const slice = createSlice({
  name: "live",
  initialState: initialLiveState,
  reducers: {
    connectionChanged(state, a: PayloadAction<LiveConnection>) {
      state.connection = a.payload;
    },
    /** A new appointment arrived. The same appointment arriving again (a reconnect, a repeat) is kept once, with its newest data. */
    appointmentReceived(state, a: PayloadAction<{ appointment: AppointmentDTO; at: string }>) {
      const { appointment, at } = a.payload;
      const existing = state.appointments.findIndex((x) => x.id === appointment.id);
      if (existing >= 0) {
        state.appointments[existing] = appointment;
        return;
      }
      state.appointments.unshift(appointment);
      if (state.appointments.length > LIVE_APPOINTMENTS_CAP) state.appointments.length = LIVE_APPOINTMENTS_CAP;
      state.unseen += 1;
      state.lastEventAt = at;
    },
    appointmentsSeen(state) {
      state.unseen = 0;
    },
    /** Sign-out: nothing from this person's hospital stays in memory. */
    liveCleared() {
      return initialLiveState;
    },
  },
});

export const { connectionChanged, appointmentReceived, appointmentsSeen, liveCleared } = slice.actions;
export const liveReducer = slice.reducer;
export default liveReducer;
