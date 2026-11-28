"use client";

/**
 * Who to write a prescription for: today's appointments and OPD patients. A doctor sees only their own (the server already limits
 * what a doctor can read), the front desk and admin see every doctor's. Only an admin also gets the "All patients" tab.
 */
import { useMemo, useState } from "react";
import { CalendarClock, Search, Stethoscope, X } from "lucide-react";
import { useList } from "@/lib/api/hooks";
import { todayIso } from "@/lib/dates";
import { SearchSelect } from "@/components/shared/SearchSelect";
import type { AppointmentDTO, OpdRecordDTO, PatientDTO, PrescriptionDTO } from "@/types/api";

interface Entry {
  key: string;
  patientId: number;
  name: string;
  age: number;
  doctorId: number | null;
  doctor: string;
  when: string;
  source: "Appointment" | "OPD";
  status: string;
  reason: string;
}

const tone: Record<string, string> = {
  "In Consultation": "bg-[#dffff3] text-[#0b7a47]", Waiting: "bg-[#fff2d6] text-[#8a5300]", Upcoming: "bg-[#e3efff] text-[#0a5fc4]",
  Completed: "bg-[color:var(--subtle)] text-[color:var(--ink-soft)]", "Checked In": "bg-[#fff2d6] text-[#8a5300]",
};

export function TodayPatientPicker({ patientId, patients, canPickAny, isDoctor = false, onSelect }: {
  patientId: string;
  patients: PatientDTO[];
  /** Admin only: the tab with every patient. */
  canPickAny: boolean;
  /** A doctor account: also gets "My patients", every patient they have seen (the server only returns their own). */
  isDoctor?: boolean;
  onSelect: (patientId: string, doctorId: number | null) => void;
}) {
  const today = todayIso();
  const { items: appts, loading: l1 } = useList<AppointmentDTO>("/appointments", { all: true, appointment_date: today });
  const { items: opd, loading: l2 } = useList<OpdRecordDTO>("/opd", { all: true });
  const { items: myAppts } = useList<AppointmentDTO>(isDoctor ? "/appointments" : null, { all: true });
  const { items: myRx } = useList<PrescriptionDTO>(isDoctor ? "/prescriptions" : null, { all: true });
  const [tab, setTab] = useState<"today" | "mine" | "all">("today");
  const [mq, setMq] = useState("");
  const [q, setQ] = useState("");

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const a of appts) {
      if (a.patientId == null || a.status === "Cancelled") continue;
      out.push({ key: `a${a.id}`, patientId: a.patientId, name: a.patientName, age: a.patientAge, doctorId: a.doctorId, doctor: a.doctor, when: a.time, source: "Appointment", status: a.status, reason: a.reason });
    }
    for (const o of opd) {
      // The queue is today's; a visit with a recorded check-in must be from today.
      if (o.patientId == null || (o.checkInAt && o.checkInAt.slice(0, 10) !== today)) continue;
      out.push({ key: `o${o.id}`, patientId: o.patientId, name: o.patientName, age: o.patientAge, doctorId: o.doctorId, doctor: o.doctor, when: o.tokenNumber, source: "OPD", status: o.status, reason: o.reason });
    }
    return out.sort((x, y) => x.name.localeCompare(y.name));
  }, [appts, opd, today]);

  // Everyone this doctor has had an appointment, OPD visit or prescription with, newest first, each once.
  const mine = useMemo(() => {
    if (!isDoctor) return [] as { id: number; name: string; age: number; last: string }[];
    const seen = new Map<number, { id: number; name: string; age: number; last: string }>();
    const add = (id: number | null | undefined, name: string, age: number, last: string) => {
      if (id == null) return;
      const cur = seen.get(id);
      if (!cur || last > cur.last) seen.set(id, { id, name, age, last });
    };
    for (const a of myAppts) add(a.patientId, a.patientName, a.patientAge, a.date ?? "");
    for (const o of opd) add(o.patientId, o.patientName, o.patientAge, o.checkInAt ?? "");
    for (const r of myRx) add(r.patientId, r.patientName, r.patientAge, r.date ?? "");
    return [...seen.values()].sort((x, y) => x.name.localeCompare(y.name));
  }, [isDoctor, myAppts, opd, myRx]);
  const mterm = mq.trim().toLowerCase();
  const myShown = mine.filter((m) => !mterm || m.name.toLowerCase().includes(mterm));

  const term = q.trim().toLowerCase();
  const shown = entries.filter((e) => !term || e.name.toLowerCase().includes(term) || e.doctor.toLowerCase().includes(term) || e.when.toLowerCase().includes(term));
  const chosen = patients.find((p) => String(p.id) === patientId);

  const tabBtn = (id: "today" | "mine" | "all", label: string) => (
    <button type="button" onClick={() => setTab(id)} aria-pressed={tab === id}
      className={`cursor-pointer rounded-[6px] px-3 py-[6px] text-[12px] ${tab === id ? "bg-[color:var(--surface)] font-semibold text-[color:var(--brand)] shadow-sm" : "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"}`}>{label}</button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex gap-1 rounded-[8px] bg-[color:var(--subtle)] p-1" role="tablist">
          {tabBtn("today", `Today's patients${entries.length ? ` (${entries.length})` : ""}`)}
          {isDoctor && tabBtn("mine", `My patients${mine.length ? ` (${mine.length})` : ""}`)}
          {canPickAny && tabBtn("all", "All patients")}
        </div>
        {chosen && (
          <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--brand-soft)] px-3 py-[4px] text-[12px] text-[color:var(--brand)]">
            <b>{chosen.name}</b><span className="text-[color:var(--ink-soft)]">{chosen.patientId ?? ""}</span>
            <button type="button" aria-label="Clear patient" onClick={() => onSelect("", null)} className="cursor-pointer"><X size={13} /></button>
          </span>
        )}
      </div>

      {tab === "mine" && isDoctor ? (
        <>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
            <input value={mq} onChange={(e) => setMq(e.target.value)} placeholder="Search your patients…"
              className="h-[36px] w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] pl-[34px] pr-3 text-[13px] focus:border-[color:var(--brand)] focus:outline-none" />
          </div>
          {myShown.length === 0 ? (
            <p className="rounded-[8px] border border-dashed border-[color:var(--line)] px-4 py-6 text-center text-[13px] text-[color:var(--ink-soft)]">{mine.length === 0 ? "No patients of yours yet." : "No one matches."}</p>
          ) : (
            <div className="grid max-h-[260px] grid-cols-1 gap-2 overflow-auto sm:grid-cols-2 xl:grid-cols-3">
              {myShown.map((m) => (
                <button key={m.id} type="button" onClick={() => onSelect(String(m.id), null)} aria-pressed={String(m.id) === patientId}
                  className={`flex cursor-pointer flex-col gap-1 rounded-[10px] border px-3 py-2 text-left transition-colors ${String(m.id) === patientId ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)]" : "border-[color:var(--line)] hover:bg-[color:var(--subtle)]"}`}>
                  <span className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{m.name}</span>
                  <span className="text-[11px] text-[color:var(--ink-soft)]">{m.age ? `${m.age} yrs` : ""}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : tab === "all" && canPickAny ? (
        <SearchSelect placeholder="Search any patient…" value={patientId} onChange={(v) => onSelect(v, null)}
          options={patients.map((p) => ({ value: String(p.id), patientId: p.id, label: p.name, hint: `${p.patientId ?? ""} · ${p.phone}` }))} />
      ) : (
        <>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search today's patients, token or doctor…"
              className="h-[36px] w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] pl-[34px] pr-3 text-[13px] focus:border-[color:var(--brand)] focus:outline-none" />
          </div>
          {shown.length === 0 ? (
            <p className="rounded-[8px] border border-dashed border-[color:var(--line)] px-4 py-6 text-center text-[13px] text-[color:var(--ink-soft)]">
              {l1 || l2 ? "Loading today's patients…" : entries.length === 0 ? `No appointments or OPD patients today${canPickAny ? ". Use the All patients tab to pick anyone." : "."}` : "No one matches."}
            </p>
          ) : (
            <div className="grid max-h-[260px] grid-cols-1 gap-2 overflow-auto sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((e) => {
                const on = String(e.patientId) === patientId;
                return (
                  <button key={e.key} type="button" onClick={() => onSelect(String(e.patientId), e.doctorId)} aria-pressed={on}
                    className={`flex cursor-pointer flex-col gap-1 rounded-[10px] border px-3 py-2 text-left transition-colors ${on ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)]" : "border-[color:var(--line)] hover:bg-[color:var(--subtle)]"}`}>
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[color:var(--ink)]">{e.name}</span>
                      <span className={`rounded-full px-2 py-[1px] text-[10px] ${tone[e.status] ?? "bg-[color:var(--subtle)] text-[color:var(--ink-soft)]"}`}>{e.status}</span>
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-[color:var(--ink-soft)]">
                      {e.source === "Appointment" ? <CalendarClock size={12} /> : <Stethoscope size={12} />}{e.source} · {e.when}{e.age ? ` · ${e.age} yrs` : ""}
                    </span>
                    <span className="truncate text-[11px] text-[color:var(--ink-soft)]">{e.doctor}{e.reason ? ` · ${e.reason}` : ""}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
