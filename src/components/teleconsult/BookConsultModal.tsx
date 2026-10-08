"use client";

/** Tele-caller / admin books a paid video consultation on a patient's behalf. */
import { useMemo, useState } from "react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormRow, FormSelect, FormTextarea } from "@/components/shared/FormRow";
import { PatientPicker } from "@/components/shared/PatientPicker";
import { todayIso } from "@/lib/dates";
import { SlotPicker } from "@/components/scheduling/SlotPicker";
import type { DoctorDTO, PatientDTO, TeleconsultConfigDTO } from "@/types/api";

export function BookConsultModal({
  open, onClose, onBooked, config,
}: {
  open: boolean;
  onClose: () => void;
  onBooked: () => void;
  config: TeleconsultConfigDTO | null;
}) {
  const { user } = useAuth();
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  const { run, loading } = useMutation();
  const isAdmin = user?.role === "Super Admin" || user?.role === "Platform Admin";

  const blank = { patientId: "", doctorId: "", date: "", time: "", reason: "", paymentMode: "cash", reference: "" };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [slotsKey, setSlotsKey] = useState(0);
  /** Only doctors who have turned video on (and the hospital allows it) can be booked for one. */
  const videoDoctors = doctors.filter(d => d.videoEnabled && d.status !== "On Leave");
  const set = (k: keyof typeof blank, v: string) =>
    setForm(prev => ({ ...prev, [k]: v, ...(k === "doctorId" || k === "date" ? { time: "" } : {}) }));

  const fee = form.paymentMode === "waived" ? 0 : config?.price ?? 0;
  const modes = useMemo(() => [
    { value: "cash", label: "Cash" }, { value: "upi", label: "UPI" }, { value: "card", label: "Card" },
    ...(isAdmin ? [{ value: "waived", label: "Fee waived" }] : []),
  ], [isAdmin]);
  const ready = form.patientId && form.doctorId && form.date && form.time && form.reason.trim().length >= 2;

  async function submit() {
    setError(null);
    try {
      await run(() => api.post("/teleconsult/bookings", {
        patientId: Number(form.patientId), doctorId: Number(form.doctorId), date: form.date, time: form.time,
        reason: form.reason, paymentMode: form.paymentMode, reference: form.reference || undefined,
      }));
      setForm(blank);
      onBooked();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't book this consultation.");
      setSlotsKey(k => k + 1); // the time may just have gone: show the list as it is now
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Book video consultation" width={560}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-[#57575f]">Fee: <b className="text-[#11111c]">₹{fee.toLocaleString("en-IN")}</b></span>
          <div className="flex gap-3">
            <button onClick={onClose} className="text-[13px] text-[#57575f] px-4 py-[8px] rounded-full border border-[#dedee1] cursor-pointer">Cancel</button>
            <button onClick={submit} disabled={!ready || loading}
              className="text-[13px] text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] disabled:opacity-50 cursor-pointer">
              {loading ? "Booking…" : "Book consultation"}
            </button>
          </div>
        </div>
      }>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <FormRow label="Patient" required>
            <PatientPicker patients={patients} value={form.patientId} onChange={(id) => set("patientId", id)} />
          </FormRow>
        </div>
        <FormRow label="Doctor" required>
          <FormSelect placeholder="Select doctor" value={form.doctorId} onChange={v => set("doctorId", v)}
            options={videoDoctors.map(d => ({ value: String(d.id), label: `${d.name} — ${d.specialty}` }))} />
          {videoDoctors.length === 0 && <p className="text-[11px] text-[#ff9000] mt-1">No doctor has turned on video consultations yet — each doctor does this under My Schedule.</p>}
        </FormRow>
        <FormRow label="Payment collected by" required>
          <FormSelect value={form.paymentMode} onChange={v => set("paymentMode", v)} options={modes} />
        </FormRow>
        <FormRow label="Date" required>
          <FormInput type="date" min={todayIso()} value={form.date} onChange={v => set("date", v)} />
        </FormRow>
        <div className="col-span-2">
          <SlotPicker doctorId={form.doctorId} date={form.date} mode="video" value={form.time}
            onChange={(v) => set("time", v)} refreshKey={slotsKey} label="Video consultation times" />
        </div>
        <div className="col-span-2">
          <FormRow label="Reason" required>
            <FormTextarea rows={2} placeholder="Reason for the consultation" value={form.reason} onChange={v => set("reason", v)} />
          </FormRow>
        </div>
        {form.paymentMode !== "waived" && (
          <div className="col-span-2">
            <FormRow label="Payment reference" hint="Optional — receipt or UPI transaction id">
              <FormInput value={form.reference} onChange={v => set("reference", v)} />
            </FormRow>
          </div>
        )}
        {error && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error}</div>}
      </div>
    </Modal>
  );
}
