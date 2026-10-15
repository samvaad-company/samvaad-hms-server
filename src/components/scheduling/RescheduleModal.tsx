"use client";

/**
 * Move an upcoming appointment (video or in person) to another of the doctor's
 * open times. The server applies the doctor's hours and per-hour limit and, for
 * a video consultation, moves the calendar entry too — the Meet link stays valid.
 * Mount it fresh for each appointment (render it conditionally) so the form starts empty.
 */
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput } from "@/components/shared/FormRow";
import { SlotPicker } from "@/components/scheduling/SlotPicker";
import type { AppointmentDTO } from "@/types/api";

export function RescheduleModal({
  appt, open, onClose, onMoved,
}: {
  appt: AppointmentDTO;
  open: boolean;
  onClose: () => void;
  onMoved: () => void;
}) {
  const { run, loading } = useMutation();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [slotsKey, setSlotsKey] = useState(0);
  const isVideo = appt.type === "Tele-consult";

  async function save() {
    setError(null);
    try {
      await run(() => api.post(`/appointments/${appt.id}/reschedule`, { date, time }));
      onMoved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reschedule.");
      setSlotsKey(k => k + 1); // the time may have just been taken
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Reschedule — ${appt.patientName}`} width={560}
      footer={
        <>
          <button onClick={onClose} className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
          <button onClick={save} disabled={loading || !date || !time}
            className="text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
            {loading ? "Moving…" : "Move appointment"}
          </button>
        </>
      }
    >
      <p className="text-[13px] text-[color:var(--ink-soft)] mb-4">
        Currently <span className="text-[color:var(--ink)]">{appt.date} at {appt.time}</span>.
        {isVideo && " The video link stays the same and the calendar invite moves with it."}
      </p>
      <div className="mb-4">
        <FormRow label="New date *">
          <FormInput type="date" value={date} min={new Date().toLocaleDateString("en-CA")} onChange={v => { setDate(v); setTime(""); }} />
        </FormRow>
      </div>
      <SlotPicker
        doctorId={appt.doctorId}
        date={date}
        mode={isVideo ? "video" : "in_person"}
        value={time}
        onChange={v => setTime(v)}
        excludeAppointmentId={appt.id}
        refreshKey={slotsKey}
        label={isVideo ? "Video consultation times" : "Available times"}
      />
      {error && <p className="mt-3 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error}</p>}
    </Modal>
  );
}
