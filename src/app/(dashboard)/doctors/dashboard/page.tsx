"use client";

import { tw } from "@/lib/design-system";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import type { OpdRecordDTO, DoctorDTO, BillDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Users, CheckCircle, XCircle, Clock, DollarSign, Stethoscope } from "lucide-react";

/** Most frequent non-empty value, used for "top reason". */
function mostCommon(values: string[]): string {
  const tally = new Map<string, number>();
  for (const v of values) {
    const k = v.trim();
    if (k) tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  let best = "—";
  let n = 0;
  for (const [k, c] of tally) if (c > n) { best = k; n = c; }
  return best;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DoctorDashboardPage() {
  const { user } = useAuth();
  const { items: allQueue, reload } = useList<OpdRecordDTO>("/opd", { all: true });
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  const { items: bills } = useList<BillDTO>("/billing", { all: true });
  const { run } = useMutation();
  const advance = (opdId: number, status: string) =>
    run(() => api.patch(`/opd/${opdId}`, { status })).then(reload);

  // Show the signed-in doctor's own dashboard. Admin/desk users who aren't
  // linked to a doctor record fall back to the first doctor currently in OPD.
  const TODAY_DOCTOR =
    (user?.doctorId ? doctors.find(d => d.id === user.doctorId) : undefined) ??
    doctors.find(d => d.status === "In OPD") ??
    doctors[0] ?? { id: 0, name: "Doctor", specialty: "—", department: "—" };

  // Only this doctor's patients — previously every doctor's queue was shown.
  const queue = TODAY_DOCTOR.id
    ? allQueue.filter(r => r.doctorId === TODAY_DOCTOR.id)
    : allQueue;

  const waiting = queue.filter(r => r.status === "Waiting").length;
  const completed = queue.filter(r => r.status === "Completed").length;
  const inConsult = queue.filter(r => r.status === "In Consultation").length;

  const patientNames = new Set(queue.map(r => r.patientName));
  const revenue = bills
    .filter(b => patientNames.has(b.patientName) && b.status === "Paid")
    .reduce((sum, b) => sum + b.total, 0);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "short", year: "numeric",
  });

  const TODAY_STATS = [
    { icon: Users,       label: "Total Today",    value: String(queue.length), color: "text-[#11111c]",  bg: "bg-[#f0f0f0]" },
    { icon: Clock,       label: "Waiting",        value: String(waiting),      color: "text-[#ff9000]",  bg: "bg-[#fff2e0]" },
    { icon: CheckCircle, label: "Completed",      value: String(completed),    color: "text-[#00955c]",  bg: "bg-[#dffff3]" },
    { icon: XCircle,     label: "In Consultation",value: String(inConsult),    color: "text-[#007cff]",  bg: "bg-[#d6eaff]" },
    { icon: DollarSign,  label: "Revenue (Paid)", value: `₹${revenue.toLocaleString("en-IN")}`, color: "text-[#007cff]", bg: "bg-[#d6eaff]" },
  ];

  const QUICK_STATS = [
    { label: "Vitals Recorded", value: `${queue.filter(r => r.vitalsRecorded).length}/${queue.length}` },
    { label: "Next Patient",    value: queue.find(r => r.status === "Waiting")?.patientName ?? "—" },
    { label: "Top Reason",      value: mostCommon(queue.map(r => r.reason)) },
    { label: "Urgent / Emergency", value: String(queue.filter(r => r.priority !== "Normal").length) },
  ];

  return (
    <>
      {/* Header */}
      <div className={`${tw.gutterX} mb-5`}>
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-[26px] font-medium text-[#11111c]">Good morning, {TODAY_DOCTOR.name} 👋</h1>
            <p className="text-[14px] font-light text-[#57575f]">{TODAY_DOCTOR.specialty} · {TODAY_DOCTOR.department} · {today}</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-[#dffff3] rounded-full">
            <div className="w-2 h-2 bg-[#00955c] rounded-full animate-pulse" />
            <span className="text-[13px] font-medium text-[#00955c]">OPD Live</span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className={`${tw.gutterX} mb-5`}>
        <div className="flex gap-4">
          {TODAY_STATS.map((s, i) => (
            <div key={i} className={`${tw.surface.card} ${tw.radius.card} flex-1 p-5 flex flex-col gap-3`}>
              <div className={`w-9 h-9 rounded-[8px] ${s.bg} flex items-center justify-center`}>
                <s.icon size={16} className={s.color} strokeWidth={1.5} />
              </div>
              <span className={`text-[28px] font-medium leading-none ${s.color}`}>{s.value}</span>
              <span className="text-[12px] font-normal text-[#57575f]">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Queue + Quick stats */}
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className="flex gap-5">
          {/* Patient queue */}
          <div className={`flex-1 ${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
            <div className="px-5 pt-5 pb-0">
              <h2 className="text-[15px] font-medium text-[#11111c]">Today's Patient Queue</h2>
            </div>
            {/* Table header */}
            <div className="relative h-10 bg-[#f2f3f3] mt-3" style={{ minWidth: 700 }}>
              {[{ l: "Token #", x: 20 }, { l: "Patient", x: 90 }, { l: "Wait Time", x: 300 }, { l: "Vitals", x: 450 }, { l: "Status", x: 590 }, { l: "Action", x: 760 }].map(c => (
                <span key={c.l} className="absolute top-1/2 -translate-y-1/2 text-[13px] font-medium text-[#11111c] whitespace-nowrap" style={{ left: c.x }}>{c.l}</span>
              ))}
            </div>
            {/* Rows */}
            <div className="overflow-y-auto" style={{ maxHeight: 440 }}>
              {queue.map(row => (
                <div key={row.id} className="relative flex items-center h-[64px] border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa] transition-colors" style={{ minWidth: 700 }}>
                  <span className="absolute text-[16px] font-medium text-[#009598]" style={{ left: 20 }}>{row.tokenNumber}</span>
                  <div className="absolute flex flex-col" style={{ left: 90 }}>
                    <span className="text-[14px] font-medium text-[#11111c] whitespace-nowrap">{row.patientName}</span>
                    <span className="text-[11px] font-light text-[#57575f]">{row.patientAge} yrs · Check-in {row.checkInTime}</span>
                  </div>
                  <span className={`absolute text-[13px] font-normal ${row.waitTime !== "—" ? "text-[#ff9000]" : "text-[#57575f]"}`} style={{ left: 300 }}>{row.waitTime !== "—" ? row.waitTime : "—"}</span>
                  <span className={`absolute inline-flex px-[8px] py-[3px] rounded-full text-[11px] font-normal ${row.vitalsRecorded ? "bg-[#dffff3] text-[#00955c]" : "bg-[#fff2e0] text-[#ff9000]"}`} style={{ left: 450 }}>
                    {row.vitalsRecorded ? "Recorded" : "Pending"}
                  </span>
                  <div className="absolute" style={{ left: 590 }}><StatusBadge status={row.status} /></div>
                  <div className="absolute" style={{ left: 760 }}>
                    {row.status === "Waiting" ? (
                      <button onClick={() => advance(row.id, "In Consultation")} className="text-[12px] font-medium text-white bg-[#009598] px-4 py-[6px] rounded-full hover:bg-[#007f82] transition-colors whitespace-nowrap">
                        Begin Consultation
                      </button>
                    ) : row.status === "In Consultation" ? (
                      <button onClick={() => advance(row.id, "Completed")} className="text-[12px] font-medium text-[#007cff] bg-[#d6eaff] px-4 py-[6px] rounded-full hover:bg-[#b8dcff] transition-colors whitespace-nowrap">
                        Complete →
                      </button>
                    ) : (
                      <span className="text-[12px] font-light text-[#57575f]">Done</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats sidebar */}
          <div className="flex flex-col gap-4 shrink-0" style={{ width: 240 }}>
            <div className={`${tw.surface.card} ${tw.radius.card} p-5`}>
              <div className="flex items-center gap-2 mb-4">
                <Stethoscope size={15} className="text-[#009598]" strokeWidth={1.5} />
                <h3 className="text-[13px] font-medium text-[#11111c]">Quick Stats</h3>
              </div>
              <div className="flex flex-col gap-4">
                {QUICK_STATS.map(s => (
                  <div key={s.label}>
                    <p className="text-[10px] font-medium text-[#57575f] uppercase tracking-wider mb-[3px]">{s.label}</p>
                    <p className="text-[15px] font-medium text-[#11111c]">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Today's schedule note */}
            <div className={`${tw.surface.card} ${tw.radius.card} p-5`}>
              <h3 className="text-[13px] font-medium text-[#11111c] mb-3">OPD Hours</h3>
              <div className="flex flex-col gap-2 text-[12px] font-normal text-[#57575f]">
                <div className="flex justify-between">
                  <span>Morning</span><span className="text-[#11111c]">9:00 AM – 1:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span>Evening</span><span className="text-[#11111c]">4:00 PM – 8:00 PM</span>
                </div>
                <div className="border-t border-[#f0f0f0] pt-2 mt-1 flex justify-between">
                  <span>Slots</span><span className="text-[#11111c]">18 / 24 booked</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
