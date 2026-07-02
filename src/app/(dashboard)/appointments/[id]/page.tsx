"use client";

import { useParams, useRouter } from "next/navigation";
import { tw } from "@/lib/design-system";
import { ArrowLeft, Calendar, Clock, User, Stethoscope, FileText, Tag } from "lucide-react";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import type { AppointmentDTO, DoctorDTO, PrescriptionDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import Link from "next/link";

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
  const { item: appt, loading, reload } = useItem<AppointmentDTO>(`/appointments/${id}`);
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  const { items: prescriptions } = useList<PrescriptionDTO>("/prescriptions", { all: true });
  const { run, loading: acting } = useMutation();

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

  const statusActions: Record<string, { label: string; color: string; onClick: () => void }[]> = {
    "Today":     [{ label: "Mark Complete", color: "#009598", onClick: () => setStatus("Completed") }, { label: "Cancel", color: "#ff0004", onClick: () => setStatus("Cancelled") }],
    "Upcoming":  [{ label: "Reschedule", color: "#007cff", onClick: () => router.push("/appointments/new") }, { label: "Cancel", color: "#ff0004", onClick: () => setStatus("Cancelled") }],
    "Completed": [{ label: "Book Follow-up", color: "#009598", onClick: () => router.push("/appointments/new") }],
    "Cancelled": [{ label: "Rebook", color: "#009598", onClick: () => setStatus("Upcoming") }],
  };

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
          {(statusActions[appt.status] ?? []).map(a => (
            <button key={a.label} onClick={a.onClick} disabled={acting}
              className="text-[13px] font-normal text-white px-4 py-2 rounded-full transition-colors disabled:opacity-50"
              style={{ background: a.color }}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`${tw.gutterX} py-6 grid gap-6`} style={{ gridTemplateColumns: "1fr 340px" }}>
        {/* Left — main details */}
        <div className="flex flex-col gap-6">
          {/* Appointment info card */}
          <div className={`${tw.surface.card} ${tw.radius.card} p-6`}>
            <div className="text-[14px] font-medium text-[#11111c] mb-4">Appointment Information</div>
            <InfoRow icon={User}        label="Patient"      value={`${appt.patientName} · ${appt.patientAge} years old`} />
            <InfoRow icon={Stethoscope} label="Doctor"       value={appt.doctor} />
            <InfoRow icon={Calendar}    label="Date"         value={appt.date} />
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
    </>
  );
}
