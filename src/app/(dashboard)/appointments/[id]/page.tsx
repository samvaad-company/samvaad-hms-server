"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import {
  ArrowLeft, Calendar, Clock, User, Stethoscope, FileText, Tag,
  CheckCircle2, CalendarClock, XCircle, RotateCcw, CalendarPlus, ScanLine,
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
import { ConsultLinkActions } from "@/components/teleconsult/ConsultLinkActions";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import { SlotPicker } from "@/components/scheduling/SlotPicker";
import Link from "next/link";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** <input type=date> value → display string matching the rest of the app. */
function toDisplayDate(input: string): string {
  if (!input) return "";
  const [y, m, d] = input.split("-").map(Number);
  if (!y || !m || !d) return input;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: "1px solid var(--subtle-2)" }}>
      <div className="w-8 h-8 rounded-[8px] bg-[color:var(--subtle)] flex items-center justify-center shrink-0 mt-[2px]">
        <Icon size={15} strokeWidth={1.5} className="text-[color:var(--ink-soft)]" />
      </div>
      <div className="flex-1">
        <div className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-[2px]">{label}</div>
        <div className="text-[14px] font-normal text-[color:var(--ink)]">{value}</div>
      </div>
    </div>
  );
}

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can, user } = useAuth();
  const canWrite = can("appointments", "write");
  const canOrderRadiology = can("radiology", "write");
  const { item: appt, loading, reload } = useItem<AppointmentDTO>(`/appointments/${id}`);
  useBreadcrumb("/appointments", "Appointments", appt ? `${appt.patientName} — ${formatDate(appt.date)}` : "Appointment");
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  const { items: prescriptions } = useList<PrescriptionDTO>("/prescriptions", { all: true });
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { run, loading: acting } = useMutation();

  const [modal, setModal] = useState<null | "reschedule" | "followup">(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [form, setForm] = useState({ date: "", time: "", timeLabel: "", doctorId: "", reason: "" });
  const [moveError, setMoveError] = useState<string | null>(null);
  const [slotsKey, setSlotsKey] = useState(0);
  const setF = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const setStatus = (status: string) =>
    run(() => api.patch(`/appointments/${id}`, { status })).then(reload);

  if (loading) {
    return <div className={`${tw.gutterX} py-20 text-center text-[color:var(--ink-soft)]`}>Loading…</div>;
  }
  if (!appt) {
    return (
      <div className={`${tw.gutterX} py-20 text-center text-[color:var(--ink-soft)]`}>
        Appointment not found.{" "}
        <Link href="/appointments" className="text-[color:var(--brand)] underline">Back to Appointments</Link>
      </div>
    );
  }

  const doctor = doctors.find(d => d.name === appt.doctor);
  const relatedRx = prescriptions.find(p => p.patientName === appt.patientName);
  const patientRec = patients.find(p => p.name === appt.patientName);

  const isActive = appt.status === "Upcoming" || appt.status === "Today";
  const doctorOptions = doctors.map(d => ({ value: String(d.id), label: d.name }));
  const isVideo = appt.type === "Tele-consult";
  // Reception/admin, the appointment's own doctor, and — for video consultations — the tele-caller may move it.
  const canMove = canWrite || (user?.role === "Doctor" && user.doctorId != null && user.doctorId === appt.doctorId) || (isVideo && can("teleconsult", "write"));

  function openReschedule() {
    setForm({
      date: "",
      time: "",
      timeLabel: "",
      doctorId: String(appt!.doctorId ?? doctor?.id ?? ""),
      reason: appt!.reason,
    });
    setMoveError(null);
    setModal("reschedule");
  }
  function openFollowup() {
    setForm({
      date: "",
      time: "",
      timeLabel: "",
      doctorId: String(appt!.doctorId ?? doctor?.id ?? ""),
      reason: `Follow-up: ${appt!.reason}`,
    });
    setMoveError(null);
    setModal("followup");
  }

  async function saveReschedule() {
    setMoveError(null);
    try {
      if (isActive) {
        // Same doctor and kind of visit, to one of that doctor's open times; the server applies the doctor's rules.
        await run(() => api.post(`/appointments/${id}/reschedule`, { date: form.date, time: form.time }));
      } else {
        // Bringing a closed appointment back onto the calendar re-opens it (still checked against the doctor's schedule).
        await run(() =>
          api.patch(`/appointments/${id}`, {
            date: toDisplayDate(form.date),
            time: form.timeLabel,
            doctorId: form.doctorId ? Number(form.doctorId) : undefined,
            status: "Upcoming",
          }),
        );
      }
      setModal(null);
      reload();
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : "Couldn't reschedule.");
      setSlotsKey(k => k + 1);
    }
  }

  async function createFollowup() {
    setMoveError(null);
    try {
      const created = await run(() =>
        api.post<AppointmentDTO>("/appointments", {
          patientId: appt!.patientId ?? patientRec?.id ?? undefined,
          patientName: appt!.patientName,
          patientAge: appt!.patientAge,
          doctorId: form.doctorId ? Number(form.doctorId) : undefined,
          date: toDisplayDate(form.date),
          time: form.timeLabel,
          type: "Booked",
          reason: form.reason,
          status: "Upcoming",
        }),
      );
      setModal(null);
      if (created?.id) router.push(`/appointments/${created.id}`);
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : "Couldn't book the follow-up.");
      setSlotsKey(k => k + 1);
    }
  }

  async function doCancel() {
    await run(() => api.patch(`/appointments/${id}`, { status: "Cancelled" }));
    setConfirmCancel(false);
    reload();
  }

  const btnPrimary = "text-[13px] font-normal text-white bg-[color:var(--brand)] px-4 py-2 rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50 inline-flex items-center gap-2";
  const btnOutline = "text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-4 py-2 rounded-full hover:bg-[color:var(--subtle)] transition-colors disabled:opacity-50 inline-flex items-center gap-2";
  const btnDanger = "text-[13px] font-normal text-[#ff0004] border border-[#ffd6d7] px-4 py-2 rounded-full hover:bg-[#ffe9e9] transition-colors disabled:opacity-50 inline-flex items-center gap-2";

  return (
    <>
      {/* Top bar */}
      <div className={`${tw.gutterX} py-5 flex items-center gap-4`} style={{ borderBottom: "1px solid var(--line)" }}>
        <Link href="/appointments" className="p-2 rounded-[8px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)] transition-colors">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </Link>
        <div className="flex-1">
          <div className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Appointment Details</div>
          <div className="text-[17px] font-medium text-[color:var(--ink)] leading-tight">{appt.patientName}</div>
        </div>
        <StatusBadge status={appt.status} />
        <div className="flex items-center gap-2">
          {canOrderRadiology && isActive && appt.patientId && (
            <button
              onClick={() => router.push(`/radiology?patientId=${appt.patientId}${appt.doctorId ? `&doctorId=${appt.doctorId}` : ""}`)}
              className={btnOutline}
            >
              <ScanLine size={15} /> Send to Radiology
            </button>
          )}
          {canWrite && isActive && (
            <button onClick={() => setStatus("Completed")} disabled={acting} className={btnPrimary}>
              <CheckCircle2 size={15} /> Mark Completed
            </button>
          )}
          {canMove && isActive && (
            <button onClick={openReschedule} disabled={acting} className={btnOutline}>
              <CalendarClock size={15} /> Reschedule
            </button>
          )}
          {canWrite && isActive && (
            <button onClick={() => setConfirmCancel(true)} disabled={acting} className={btnDanger}>
              <XCircle size={15} /> Cancel
            </button>
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
            <div className="text-[14px] font-medium text-[color:var(--ink)] mb-4">Appointment Information</div>
            <InfoRow icon={User}        label="Patient"      value={`${appt.patientName} · ${appt.patientAge} years old`} />
            <div className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid var(--subtle-2)" }}>
              <div className="w-8 h-8 shrink-0" />
              <AbhaBadge abhaId={patientRec?.abhaId} />
            </div>
            <InfoRow icon={Stethoscope} label="Doctor"       value={appt.doctor} />
            <InfoRow icon={Calendar}    label="Date"         value={formatDate(appt.date)} />
            <InfoRow icon={Clock}       label="Time"         value={appt.rescheduleCount > 0 ? `${appt.time} · rescheduled ${appt.rescheduleCount}×${appt.rescheduledFrom ? ` (was ${appt.rescheduledFrom})` : ""}` : appt.time} />
            <InfoRow icon={Tag}         label="Type"         value={appt.type} />
            <div className="py-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-[8px] bg-[color:var(--subtle)] flex items-center justify-center shrink-0 mt-[2px]">
                  <FileText size={15} strokeWidth={1.5} className="text-[color:var(--ink-soft)]" />
                </div>
                <div className="flex-1">
                  <div className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-[2px]">Chief Complaint / Reason</div>
                  <div className="text-[14px] font-normal text-[color:var(--ink)]">{appt.reason}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Video consultation */}
          {appt.type === "Tele-consult" && (
            <div className={`${tw.surface.card} ${tw.radius.card} p-6`}>
              <div className="text-[14px] font-medium text-[color:var(--ink)] mb-1">Video Consultation</div>
              <p className="text-[12px] font-light text-[color:var(--ink-soft)] mb-4">
                {appt.consultAmount != null ? `Fee ₹${appt.consultAmount.toLocaleString("en-IN")}` : "Fee —"}
                {appt.paymentStatus ? ` · ${appt.paymentStatus}` : ""}
                {appt.meetError && !appt.videoUrl ? ` · ${appt.meetError}` : ""}
                {appt.meetAccess && appt.videoUrl ? ` · Join access: ${({ OPEN: "anyone with the link", TRUSTED: "ask to join", RESTRICTED: "invitees only", "calendar-default": "invited guests only (Google default)" } as Record<string, string>)[appt.meetAccess] ?? appt.meetAccess}` : ""}
              </p>
              {(appt.paymentId || appt.orderId) && (
                <p className="text-[11px] font-light text-[color:var(--ink-soft)] mb-4 break-all">
                  {appt.paymentId && <>Payment <span className="text-[color:var(--ink)]">{appt.paymentId}</span></>}
                  {appt.paymentId && appt.orderId && " · "}
                  {appt.orderId && <>Order <span className="text-[color:var(--ink)]">{appt.orderId}</span></>}
                </p>
              )}
              <ConsultLinkActions appt={appt} canWrite={can("teleconsult", "write")} onChanged={reload} />
            </div>
          )}

          {/* Related prescription */}
          {relatedRx && (
            <div className={`${tw.surface.card} ${tw.radius.card} p-6`}>
              <div className="text-[14px] font-medium text-[color:var(--ink)] mb-4">Related Prescription</div>
              <div className="flex items-center justify-between p-4 rounded-[10px] bg-[color:var(--subtle)]">
                <div>
                  <div className="text-[13px] font-medium text-[color:var(--ink)]">{relatedRx.rxNumber}</div>
                  <div className="text-[12px] font-light text-[color:var(--ink-soft)] mt-[2px]">
                    {relatedRx.diagnosis} · {relatedRx.medicineCount} medicines · {relatedRx.date}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={relatedRx.status} />
                  <Link href={`/prescriptions/${relatedRx.id}`}
                    className="text-[12px] font-medium text-[color:var(--brand)] hover:underline">
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
            <div className="text-[14px] font-medium text-[color:var(--ink)]">Attending Doctor</div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[color:var(--brand)] flex items-center justify-center shrink-0">
                <span className="text-white text-[16px] font-medium">
                  {doctor.name.replace("Dr. ", "").split(" ").map(n => n[0]).join("").slice(0,2)}
                </span>
              </div>
              <div>
                <div className="text-[14px] font-medium text-[color:var(--ink)]">{doctor.name}</div>
                <div className="text-[12px] font-light text-[color:var(--ink-soft)]">{doctor.specialty}</div>
              </div>
            </div>
            <div className="h-px bg-[color:var(--subtle-2)]" />
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-[color:var(--ink-soft)]">Department</span>
                <span className="text-[color:var(--ink)]">{doctor.department}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[color:var(--ink-soft)]">Experience</span>
                <span className="text-[color:var(--ink)]">{doctor.experience}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[color:var(--ink-soft)]">Phone</span>
                <span className="text-[color:var(--ink)]">{doctor.phone}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[color:var(--ink-soft)]">Status</span>
                <StatusBadge status={doctor.status} />
              </div>
            </div>
            <Link href={`/doctors/${doctor.id}`}
              className="mt-2 text-[13px] font-medium text-[color:var(--brand)] hover:underline text-center">
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
            <button onClick={() => setModal(null)} className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">
              Cancel
            </button>
            <button
              onClick={modal === "followup" ? createFollowup : saveReschedule}
              disabled={acting || !form.date || !form.time}
              className="text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50"
            >
              {acting ? "Saving…" : modal === "followup" ? "Book Appointment" : "Save New Time"}
            </button>
          </>
        }
      >
        <div className="mb-3 text-[12px] text-[color:var(--ink-soft)]">
          {appt.patientName} · {appt.patientAge} yrs
          {modal === "reschedule" && (
            <span className="text-[color:var(--ink-soft)]"> — currently {formatDate(appt.date)} at {appt.time}</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormRow label="Date *"><FormInput type="date" value={form.date} min={new Date().toLocaleDateString("en-CA")} onChange={v => { setF("date", v); setF("time", ""); setF("timeLabel", ""); }} /></FormRow>
          {modal === "followup" ? (
            <FormRow label="Doctor"><FormSelect placeholder="Select doctor" value={form.doctorId} onChange={v => { setF("doctorId", v); setF("time", ""); setF("timeLabel", ""); }} options={doctorOptions} /></FormRow>
          ) : (
            <FormRow label="Doctor"><p className="h-[42px] flex items-center text-[14px] text-[color:var(--ink)]">{appt.doctor}</p></FormRow>
          )}
          {modal === "followup" && (
            <div className="col-span-2"><FormRow label="Reason"><FormInput placeholder="Reason for follow-up" value={form.reason} onChange={v => setF("reason", v)} /></FormRow></div>
          )}
        </div>
        <SlotPicker
          doctorId={modal === "followup" ? form.doctorId : appt.doctorId}
          date={form.date}
          mode={modal === "followup" ? "in_person" : isVideo ? "video" : "in_person"}
          value={form.time}
          onChange={(v, label) => { setF("time", v); setF("timeLabel", label); }}
          excludeAppointmentId={modal === "reschedule" ? appt.id : undefined}
          refreshKey={slotsKey}
          label={isVideo && modal === "reschedule" ? "Video consultation times" : "Available times"}
        />
        {moveError && <p className="mt-3 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{moveError}</p>}
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
