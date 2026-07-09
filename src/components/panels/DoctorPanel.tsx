"use client";

/**
 * Doctor home panel — personalized via the session's linked doctorId: my OPD
 * queue (with consult actions), my appointments, and my recent prescriptions.
 */
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import type { OpdRecordDTO, AppointmentDTO, PrescriptionDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Users, Clock, CheckCircle, FileText, Calendar,
  FlaskConical, ScanLine, AlertCircle,
} from "lucide-react";
import { tw } from "@/lib/design-system";
import { PanelHeader, StatRow, QuickLinks, WorklistCard, EmptyRow } from "./shared";

export function DoctorPanel() {
  const { user } = useAuth();
  const doctorId = user?.doctorId ?? null;

  const { items: queue, reload } = useList<OpdRecordDTO>("/opd", { all: true });
  const { items: appointments } = useList<AppointmentDTO>("/appointments", { all: true });
  const { items: prescriptions } = useList<PrescriptionDTO>("/prescriptions", { all: true });
  const { run } = useMutation();
  const advance = (opdId: number, status: string) =>
    run(() => api.patch(`/opd/${opdId}`, { status })).then(reload);

  // Personalize when linked; fall back to the hospital-wide view otherwise.
  const linked = doctorId != null;
  const myQueue = linked ? queue.filter(r => r.doctorId === doctorId) : queue;
  const myAppointments = linked ? appointments.filter(a => a.doctorId === doctorId) : appointments;
  const myPrescriptions = linked ? prescriptions.filter(p => p.doctorId === doctorId) : prescriptions;

  const waiting = myQueue.filter(r => r.status === "Waiting");
  const completed = myQueue.filter(r => r.status === "Completed").length;
  const upcoming = myAppointments.filter(a => a.status === "Today" || a.status === "Upcoming");
  const pendingRx = myPrescriptions.filter(p => p.status === "Pending" || p.status === "Draft").length;

  return (
    <>
      <PanelHeader
        name={user?.name ?? "Doctor"}
        subtitle={`Doctor Panel · ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}`}
        badge="OPD Live"
      />

      {!linked && (
        <div className={`${tw.gutterX} mb-5`}>
          <div className="flex items-center gap-3 px-4 py-3 bg-[#fff2e0] border border-[#ff9000]/30 rounded-[10px]">
            <AlertCircle size={16} className="text-[#ff9000] shrink-0" />
            <p className="text-[13px] text-[#11111c]">
              This account isn&apos;t linked to a doctor profile yet — showing the hospital-wide view.
              Ask an administrator to link your login to your doctor record.
            </p>
          </div>
        </div>
      )}

      <StatRow stats={[
        { icon: Users,       label: "My Queue Today",   value: String(myQueue.length),      color: "text-[#11111c]", bg: "bg-[#f0f0f0]" },
        { icon: Clock,       label: "Waiting",          value: String(waiting.length),      color: "text-[#ff9000]", bg: "bg-[#fff2e0]" },
        { icon: CheckCircle, label: "Completed",        value: String(completed),           color: "text-[#00955c]", bg: "bg-[#dffff3]" },
        { icon: Calendar,    label: "My Appointments",  value: String(upcoming.length),     color: "text-[#007cff]", bg: "bg-[#d6eaff]" },
        { icon: FileText,    label: "Pending Rx",       value: String(pendingRx),           color: "text-[#009598]", bg: "bg-[#e8f7f7]" },
      ]} />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className="flex gap-5 items-start">
          {/* My queue */}
          <WorklistCard title="My OPD Queue" action={{ label: "Full queue", href: "/opd" }}>
            <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
              {myQueue.length === 0 ? (
                <EmptyRow text="No patients in your queue." />
              ) : myQueue.map(row => (
                <div key={row.id} className="flex items-center justify-between gap-3 px-5 h-[62px] border-t border-[#f0f0f0] hover:bg-[#fafafa] transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-[15px] font-medium text-[#009598] w-[52px] shrink-0">{row.tokenNumber}</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.patientName}</span>
                      <span className="text-[11px] font-light text-[#57575f]">{row.patientAge} yrs · Check-in {row.checkInTime}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={row.status} />
                    {row.status === "Waiting" ? (
                      <button onClick={() => advance(row.id, "In Consultation")}
                        className="text-[12px] font-medium text-white bg-[#009598] px-4 py-[6px] rounded-full hover:bg-[#007f82] transition-colors whitespace-nowrap">
                        Begin
                      </button>
                    ) : row.status === "In Consultation" ? (
                      <button onClick={() => advance(row.id, "Completed")}
                        className="text-[12px] font-medium text-[#007cff] bg-[#d6eaff] px-4 py-[6px] rounded-full hover:bg-[#b8dcff] transition-colors whitespace-nowrap">
                        Complete →
                      </button>
                    ) : (
                      <span className="text-[12px] font-light text-[#57575f]">Done</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </WorklistCard>

          {/* Right column */}
          <div className="flex flex-col gap-4 shrink-0" style={{ width: 380 }}>
            <WorklistCard title="My Appointments" action={{ label: "All", href: "/appointments" }}>
              <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
                {upcoming.length === 0 ? (
                  <EmptyRow text="No upcoming appointments." />
                ) : upcoming.slice(0, 6).map(a => (
                  <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[#f0f0f0]">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-medium text-[#11111c] truncate">{a.patientName}</span>
                      <span className="text-[11px] font-light text-[#57575f]">{a.date} · {a.time}</span>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            </WorklistCard>

            <WorklistCard title="Recent Prescriptions" action={{ label: "All", href: "/prescriptions" }}>
              <div className="overflow-y-auto" style={{ maxHeight: 160 }}>
                {myPrescriptions.length === 0 ? (
                  <EmptyRow text="No prescriptions yet." />
                ) : myPrescriptions.slice(-4).reverse().map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[#f0f0f0]">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-medium text-[#11111c] truncate">{p.patientName}</span>
                      <span className="text-[11px] font-light text-[#57575f]">{p.rxNumber} · {p.diagnosis}</span>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            </WorklistCard>

            <QuickLinks links={[
              { href: "/prescriptions/new", label: "Write Prescription", description: "New Rx for a patient", icon: FileText },
              { href: "/lab",               label: "Order Lab Test",     description: "Book pathology tests",  icon: FlaskConical },
              { href: "/radiology",         label: "Order Imaging",      description: "X-Ray, CT, MRI, USG",   icon: ScanLine },
              { href: "/patients",          label: "My Patients",        description: "Search patient records", icon: Users },
            ]} />
          </div>
        </div>
      </div>
    </>
  );
}
