"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import {
  ArrowLeft, Calendar, Clock, User, Stethoscope, FileText, Tag,
  CheckCircle2, CalendarClock, XCircle, RotateCcw, CalendarPlus,
} from "lucide-react";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import type { AppointmentDTO, DoctorDTO, PrescriptionDTO, PatientDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AbhaBadge } from "@/components/shared/AbhaBadge";
import { ScribePanel } from "@/components/scribe/ScribePanel";
import { Modal } from "@/components/shared/Modal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import Link from "next/link";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM",
  "12:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM",
  "5:00 PM", "5:30 PM", "6:00 PM",
];

/** Display string ("8 Nov 2025") → <input type=date> value (yyyy-mm-dd). */
function toInputDate(display: string): string {
  const d = new Date(display);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** <input type=date> value → display string matching the rest of the app. */
function toDisplayDate(input: string): string {
  if (!input) return "";
  const [y, m, d] = input.split("-").map(Number);
  if (!y || !m || !d) return input;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: "1px solid #f0f0f0" }}>
      <div className="w-8 h-8 rounded-[8px] bg-[#f6f6f6] flex items-center justify-center shrink-0 mt-[2px]">
        <Icon size={15} strokeWidth={1.5} className="text-[#57575f]" />
      </div>
      <div className="flex-1">
        <div className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider mb-[2px]">{label}</div>
        <div className="text-[14px] font-normal text-[#11111c]">{value}</div>
      </div>
    </div>
  );
}

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const canWrite = can("appointments", "write");
  const { item: appt, loading, reload } = useItem<AppointmentDTO>(`/appointments/${id}`);
  useBreadcrumb("/appointments", "Appointments", appt ? `${appt.patientName} — ${formatDate(appt.date)}` : "Appointment");
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  const { items: prescriptions } = useList<PrescriptionDTO>("/prescriptions", { all: true });
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { run, loading: acting } = useMutation();

  const [modal, setModal] = useState<null | "reschedule" | "followup">(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [form, setForm] = useState({ date: "", time: "", doctorId: "", reason: "" });
  const setF = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const setStatus = (status: string) =>
    run(() => api.patch(`/appointments/${id}`, { status })).then(reload);

  if (loading) {
    return <div className={`${tw.gutterX} py-20 text-center text-[#57575f]`}>Loading…</div>;
  }
  if (!appt) {
    return (
      <div className={`${tw.gutterX} py-20 text-center text-[#57575f]`}>
        Appointment not found.{" "}
        <Link href="/appointments" className="text-[#009598] underline">Back to Appointments</Link>
      </div>
    );
  }

  const doctor = doctors.find(d => d.name === appt.doctor);
  const relatedRx = prescriptions.find(p => p.patientName === appt.patientName);
  const patientRec = patients.find(p => p.name === appt.patientName);

  const isActive = appt.status === "Upcoming" || appt.status === "Today";
  const doctorOptions = doctors.map(d => ({ value: String(d.id), label: d.name }));
  const timeOptions = (SLOTS.includes(form.time) || !form.time ? SLOTS : [form.time, ...SLOTS])
    .map(t => ({ value: t, label: t }));

  function openReschedule() {
    setForm({
      date: toInputDate(appt!.date),
      time: appt!.time,
      doctorId: String(appt!.doctorId ?? doctor?.id ?? ""),
      reason: appt!.reason,
    });
    setModal("reschedule");
  }
  function openFollowup() {
    setForm({
      date: "",
      time: "",
      doctorId: String(appt!.doctorId ?? doctor?.id ?? ""),
      reason: `Follow-up: ${appt!.reason}`,
    });
    setModal("followup");
  }

  async function saveReschedule() {
    await run(() =>
      api.patch(`/appointments/${id}`, {
        date: toDisplayDate(form.date) || appt!.date,
        time: form.time || appt!.time,
        doctorId: form.doctorId ? Number(form.doctorId) : undefined,
        // Bringing a closed appointment back onto the calendar re-opens it.
        status: appt!.status === "Completed" || appt!.status === "Cancelled" ? "Upcoming" : appt!.status,
      }),
    );
    setModal(null);
    reload();
  }

  async function createFollowup() {
    const created = await run(() =>
      api.post<AppointmentDTO>("/appointments", {
        patientId: appt!.patientId ?? patientRec?.id ?? undefined,
        patientName: appt!.patientName,
        patientAge: appt!.patientAge,
        doctorId: form.doctorId ? Number(form.doctorId) : undefined,
        date: toDisplayDate(form.date),
        time: form.time,
        type: "Booked",
        reason: form.reason,
        status: "Upcoming",
      }),
    );
    setModal(null);
    if (created?.id) router.push(`/appointments/${created.id}`);
  }

  async function doCancel() {
    await run(() => api.patch(`/appointments/${id}`, { status: "Cancelled" }));
    setConfirmCancel(false);
    reload();
  }

  const btnPrimary = "text-[13px] font-normal text-white bg-[#009598] px-4 py-2 rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50 inline-flex items-center gap-2";
  const btnOutline = "text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-4 py-2 rounded-full hover:bg-[#f6f6f6] transition-colors disabled:opacity-50 inline-flex items-center gap-2";
  const btnDanger = "text-[13px] font-normal text-[#ff0004] border border-[#ffd6d7] px-4 py-2 rounded-full hover:bg-[#ffe9e9] transition-colors disabled:opacity-50 inline-flex items-center gap-2";

  return (
    <>
      {/* Top bar */}
      <div className={`${tw.gutterX} py-5 flex items-center gap-4`} style={{ borderBottom: "1px solid #dedee1" }}>
        <Link href="/appointments" className="p-2 rounded-[8px] text-[#57575f] hover:bg-[#f6f6f6] hover:text-[#11111c] transition-colors">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </Link>
        <div className="flex-1">
          <div className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">Appointment Details</div>
          <div className="text-[17px] font-medium text-[#11111c] leading-tight">{appt.patientName}</div>
        </div>
        <StatusBadge status={appt.status} />
        <div className="flex items-center gap-2">
          {canWrite && isActive && (
            <>
              <button onClick={() => setStatus("Completed")} disabled={acting} className={btnPrimary}>
                <CheckCircle2 size={15} /> Mark Completed
              </button>
              <button onClick={openReschedule} disabled={acting} className={btnOutline}>
                <CalendarClock size={15} /> Reschedule
              </button>
              <button onClick={() => setConfirmCancel(true)} disabled={acting} className={btnDanger}>
                <XCircle size={15} /> Cancel
              </button>
            </>
          )}
          {canWrite && appt.status === "Completed" && (
            <>
              <button onClick={openFollowup} disabled={acting} className={btnPrimary}>
                <CalendarPlus size={15} /> Book Follow-up
              </button>
              <button onClick={() => setStatus("Upcoming")} disabled={acting} className={btnOutline}>
                <RotateCcw size={15} /> Reopen
              </button>
            </>
          )}
          {canWrite && appt.status === "Cancelled" && (
            <>
              <button onClick={openReschedule} disabled={acting} className={btnPrimary}>
                <CalendarClock size={15} /> Reschedule
              </button>
              <button onClick={() => setStatus("Upcoming")} disabled={acting} className={btnOutline}>
                <RotateCcw size={15} /> Restore
              </button>
            </>
          )}
        </div>
      </div>

      <div className={`${tw.gutterX} py-6 grid gap-6`} style={{ gridTemplateColumns: "1fr 340px" }}>
        {/* Left — main details */}
        <div className="flex flex-col gap-6">
          {/* Appointment info card */}
          <div className={`${tw.surface.card} ${tw.radius.card} p-6`}>
            <div className="text-[14px] font-medium text-[#11111c] mb-4">Appointment Information</div>
            <InfoRow icon={User}        label="Patient"      value={`${appt.patientName} · ${appt.patientAge} years old`} />
            <div className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid #f0f0f0" }}>
              <div className="w-8 h-8 shrink-0" />
              <AbhaBadge abhaId={patientRec?.abhaId} />
            </div>
            <InfoRow icon={Stethoscope} label="Doctor"       value={appt.doctor} />
            <InfoRow icon={Calendar}    label="Date"         value={formatDate(appt.date)} />
            <InfoRow icon={Clock}       label="Time"         value={appt.time} />
            <InfoRow icon={Tag}         label="Type"         value={appt.type} />
            <div className="py-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-[8px] bg-[#f6f6f6] flex items-center justify-center shrink-0 mt-[2px]">
                  <FileText size={15} strokeWidth={1.5} className="text-[#57575f]" />
                </div>
                <div className="flex-1">
                  <div className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider mb-[2px]">Chief Complaint / Reason</div>
                  <div className="text-[14px] font-normal text-[#11111c]">{appt.reason}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Related prescription */}
          {relatedRx && (
            <div className={`${tw.surface.card} ${tw.radius.card} p-6`}>
              <div className="text-[14px] font-medium text-[#11111c] mb-4">Related Prescription</div>
              <div className="flex items-center justify-between p-4 rounded-[10px] bg-[#f6f6f6]">
                <div>
                  <div className="text-[13px] font-medium text-[#11111c]">{relatedRx.rxNumber}</div>
                  <div className="text-[12px] font-light text-[#57575f] mt-[2px]">
                    {relatedRx.diagnosis} · {relatedRx.medicineCount} medicines · {relatedRx.date}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={relatedRx.status} />
                  <Link href={`/prescriptions/${relatedRx.id}`}
                    className="text-[12px] font-medium text-[#009598] hover:underline">
                    View →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* AI consultation scribe */}
          <ScribePanel
            appointmentId={appt.id}
            patientName={appt.patientName}
            doctorName={appt.doctor}
            doctorId={doctor?.id ?? null}
            patientId={patientRec?.id ?? null}
          />
        </div>

        {/* Right — doctor info */}
        {doctor && (
          <div className={`${tw.surface.card} ${tw.radius.card} p-6 flex flex-col gap-4 self-start`}>
            <div className="text-[14px] font-medium text-[#11111c]">Attending Doctor</div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#009598] flex items-center justify-center shrink-0">
                <span className="text-white text-[16px] font-medium">
                  {doctor.name.replace("Dr. ", "").split(" ").map(n => n[0]).join("").slice(0,2)}
                </span>
              </div>
              <div>
                <div className="text-[14px] font-medium text-[#11111c]">{doctor.name}</div>
                <div className="text-[12px] font-light text-[#57575f]">{doctor.specialty}</div>
              </div>
            </div>
            <div className="h-px bg-[#f0f0f0]" />
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-[#57575f]">Department</span>
                <span className="text-[#11111c]">{doctor.department}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#57575f]">Experience</span>
                <span className="text-[#11111c]">{doctor.experience}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#57575f]">Phone</span>
                <span className="text-[#11111c]">{doctor.phone}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#57575f]">Status</span>
                <StatusBadge status={doctor.status} />
              </div>
            </div>
            <Link href={`/doctors/${doctor.id}`}
              className="mt-2 text-[13px] font-medium text-[#009598] hover:underline text-center">
              View Full Profile →
            </Link>
          </div>
        )}
      </div>

      {/* Reschedule / Follow-up modal */}
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "followup" ? "Book Follow-up Appointment" : "Reschedule Appointment"}
        width={520}
        footer={
          <>
            <button onClick={() => setModal(null)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">
              Cancel
            </button>
            <button
              onClick={modal === "followup" ? createFollowup : saveReschedule}
              disabled={acting || !form.date || !form.time}
              className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50"
            >
              {acting ? "Saving…" : modal === "followup" ? "Book Appointment" : "Save New Time"}
            </button>
          </>
        }
      >
        <div className="mb-3 text-[12px] text-[#57575f]">
          {appt.patientName} · {appt.patientAge} yrs
          {modal === "reschedule" && (
            <span className="text-[#57575f]"> — currently {formatDate(appt.date)} at {appt.time}</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Date *"><FormInput type="date" value={form.date} onChange={v => setF("date", v)} /></FormRow>
          <FormRow label="Time Slot *"><FormSelect placeholder="Select slot" value={form.time} onChange={v => setF("time", v)} options={timeOptions} /></FormRow>
          <FormRow label="Doctor"><FormSelect placeholder="Select doctor" value={form.doctorId} onChange={v => setF("doctorId", v)} options={doctorOptions} /></FormRow>
          {modal === "followup" && (
            <FormRow label="Reason"><FormInput placeholder="Reason for follow-up" value={form.reason} onChange={v => setF("reason", v)} /></FormRow>
          )}
        </div>
      </Modal>

      {/* Cancel confirmation */}
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this appointment?"
        message={`This will mark ${appt.patientName}'s appointment on ${formatDate(appt.date)} at ${appt.time} as Cancelled. You can reschedule or restore it afterwards.`}
        confirmLabel="Cancel Appointment"
        cancelLabel="Keep it"
        loading={acting}
        onConfirm={doCancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </>
  );
}
