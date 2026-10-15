"use client";

/**
 * Appointment details in a panel that slides in from the right (like an event in a calendar):
 * who, when, with whom, why, the patient's basics, video-call and payment details, and the actions
 * the user is allowed to take. Closes with ✕, Esc, or a click outside.
 */
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { X, Calendar, Clock, Stethoscope, FileText, Tag, Phone, Video, IndianRupee, ExternalLink, RotateCcw, User } from "lucide-react";
import { useItem } from "@/lib/api/hooks";
import { formatDate } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { AppointmentDTO, DoctorDTO, PatientDTO } from "@/types/api";

export interface PanelAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  primary?: boolean;
}

function Row({ icon: Icon, label, children }: { icon: typeof Calendar; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-[10px] border-b border-[color:var(--subtle-2)] last:border-0">
      <div className="w-7 h-7 rounded-[8px] bg-[color:var(--subtle)] flex items-center justify-center shrink-0">
        <Icon size={14} strokeWidth={1.5} className="text-[color:var(--ink-soft)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">{label}</div>
        <div className="text-[13px] text-[color:var(--ink)] break-words">{children}</div>
      </div>
    </div>
  );
}

export function AppointmentSidePanel({ appt, doctor, actions, onClose }: {
  appt: AppointmentDTO | null;
  doctor: DoctorDTO | null;
  actions: PanelAction[];
  onClose: () => void;
}) {
  const open = appt !== null;
  const { item: patient } = useItem<PatientDTO>(appt?.patientId ? `/patients/${appt.patientId}` : null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* click-outside catcher (no dimming, so the grid stays readable) */}
      {open && <div className="fixed inset-0 z-[55]" onClick={onClose} aria-hidden />}
      <aside
        role="dialog" aria-modal={open} aria-label="Appointment details" aria-hidden={!open}
        className={`fixed top-0 right-0 bottom-0 z-[60] w-[400px] max-w-[92vw] bg-[color:var(--surface)] border-l border-[color:var(--line)] shadow-2xl flex flex-col transition-transform duration-200 ${open ? "translate-x-0" : "translate-x-full pointer-events-none"}`}
      >
        {appt && (
          <>
            <div className="flex items-start gap-3 px-5 pt-4 pb-3 border-b border-[color:var(--line)]">
              <div className="w-10 h-10 rounded-full bg-[color:var(--brand)] text-white flex items-center justify-center text-[13px] font-medium shrink-0">
                {appt.patientName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] font-medium text-[color:var(--ink)] truncate">{appt.patientName}</h2>
                <p className="text-[12px] text-[color:var(--ink-soft)]">
                  {appt.patientAge}y{patient?.gender ? ` · ${patient.gender}` : ""}{patient?.patientId ? ` · ${patient.patientId}` : ""}
                </p>
                <div className="mt-[6px]"><StatusBadge status={appt.status} /></div>
              </div>
              <button type="button" onClick={onClose} aria-label="Close"
                className="w-8 h-8 -mr-2 rounded-full flex items-center justify-center text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)] cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-2">
              <Row icon={Calendar} label="Date">{formatDate(appt.date)}</Row>
              <Row icon={Clock} label="Time">
                {appt.time}
                {appt.rescheduleCount > 0 && (
                  <span className="block text-[12px] text-[color:var(--ink-soft)] mt-[2px]">
                    <RotateCcw size={11} className="inline -mt-[2px] mr-1" />
                    Rescheduled {appt.rescheduleCount}×{appt.rescheduledFrom ? ` · was ${appt.rescheduledFrom}` : ""}
                  </span>
                )}
              </Row>
              <Row icon={Stethoscope} label="Doctor">
                {appt.doctor}
                {doctor?.specialty && <span className="block text-[12px] text-[color:var(--ink-soft)]">{doctor.specialty}</span>}
              </Row>
              <Row icon={Tag} label="Type">{appt.type}</Row>
              <Row icon={FileText} label="Reason for visit">{appt.reason || "—"}</Row>

              {patient && (
                <Row icon={User} label="Patient">
                  <span className="block">{patient.phone}</span>
                  <span className="block text-[12px] text-[color:var(--ink-soft)]">
                    {[patient.bloodGroup && `Blood group ${patient.bloodGroup}`, patient.allergies.length ? `Allergies: ${patient.allergies.join(", ")}` : "No known allergies"].filter(Boolean).join(" · ")}
                  </span>
                </Row>
              )}
              {!patient && appt.patientId && (
                <Row icon={Phone} label="Patient"><span className="text-[color:var(--ink-soft)]">Loading…</span></Row>
              )}

              {appt.type === "Tele-consult" && (
                <Row icon={Video} label="Video consultation">
                  {appt.videoUrl ? (
                    <a href={appt.videoUrl} target="_blank" rel="noopener noreferrer" className="text-[color:var(--brand)] hover:underline inline-flex items-center gap-1">
                      Join the call <ExternalLink size={12} />
                    </a>
                  ) : <span className="text-[color:var(--ink-soft)]">No link yet</span>}
                  {appt.meetError && <span className="block text-[12px] text-[#ff9000]">{appt.meetError}</span>}
                  {appt.meetWarning && <span className="block text-[12px] text-[#ff9000]">{appt.meetWarning}</span>}
                </Row>
              )}

              {(appt.consultAmount != null || appt.paymentStatus) && (
                <Row icon={IndianRupee} label="Payment">
                  {appt.consultAmount != null ? `₹${appt.consultAmount}` : "—"}
                  {appt.paymentStatus && <span className="ml-2 text-[12px] text-[color:var(--ink-soft)]">{appt.paymentStatus}</span>}
                  {appt.paymentId && <span className="block text-[11px] font-mono text-[color:var(--ink-soft)] truncate">{appt.paymentId}</span>}
                </Row>
              )}
            </div>

            <div className="px-5 py-3 border-t border-[color:var(--line)] flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {actions.map(a => (
                  <button key={a.label} type="button" disabled={a.disabled} onClick={a.onClick}
                    className={`text-[12px] px-3 py-[6px] rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                      a.primary ? "bg-[color:var(--brand)] border-[color:var(--brand)] text-white hover:bg-[color:var(--brand-hover)]"
                        : a.danger ? "border-[#ffc9c9] text-[#ff0004] hover:bg-[#ffe9e9]"
                        : "border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"
                    }`}>
                    {a.label}
                  </button>
                ))}
              </div>
              <Link href={`/appointments/${appt.id}`} className="text-[12px] text-[color:var(--brand)] hover:underline inline-flex items-center gap-1">
                Open full appointment page <ExternalLink size={12} />
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
