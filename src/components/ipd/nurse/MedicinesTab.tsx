"use client";

/**
 * Today's medicine round: every scheduled dose for patients on the ward, with what became of it. A dose is due
 * from an hour before its time to an hour after; later than that it counts as missed. A nurse gives it, or holds
 * it with a reason.
 */
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput } from "@/components/shared/FormRow";
import type { DoseSlotDTO, DoseState } from "@/types/api";
import { btn, clock, Empty, PatientCell, useAutoRefresh, type WardPatient, done } from "@/components/ipd/nurse/shared";

const ORDER: Record<DoseState, number> = { missed: 0, due: 1, upcoming: 2, held: 3, given: 4 };
const STATE_STYLE: Record<DoseState, string> = {
  missed: "border-[#f4a3ac] bg-[#ffe3e5] text-[#b3001b]",
  due: "border-[#f3cf7d] bg-[#fff2d6] text-[#8a5300]",
  upcoming: "border-[color:var(--line)] text-[color:var(--ink-soft)]",
  held: "border-[#f3cf7d] bg-[#fff6dd] text-[#8a5300]",
  given: "border-[#9fe3c6] bg-[#dffff3] text-[#0b7a47]",
};
const LABEL: Record<DoseState, string> = { missed: "Missed", due: "Due", upcoming: "Upcoming", held: "Held", given: "Given" };

const shiftDay = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const todayLocal = () => new Date().toLocaleDateString("en-CA");

export function MedicinesTab({ patients, canWrite }: { patients: WardPatient[]; canWrite: boolean }) {
  const [date, setDate] = useState(todayLocal());
  const { items: slots, reload } = useList<DoseSlotDTO>("/ipd/nurse/doses", { date });
  const [filter, setFilter] = useState<DoseState | "All">("All");
  const [holding, setHolding] = useState<DoseSlotDTO | null>(null);
  const [reason, setReason] = useState("");
  const { run, loading, error, reset } = useMutation();
  useAutoRefresh(reload);

  const byId = new Map(patients.map((p) => [p.adm.id, p.adm]));
  const mine = slots.filter((s) => byId.has(s.admissionId));
  const shown = (filter === "All" ? mine : mine.filter((s) => s.state === filter))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.scheduledAt.localeCompare(b.scheduledAt));
  const count = (s: DoseState) => mine.filter((x) => x.state === s).length;

  async function give(s: DoseSlotDTO) {
    if (!(await done(run(() => api.post("/ipd/nurse/doses", { medicationId: s.medicationId, scheduledAt: s.scheduledAt, status: "Given" }))))) return;
    reload();
  }
  async function hold() {
    if (!holding) return;
    if (!(await done(run(() => api.post("/ipd/nurse/doses", { medicationId: holding.medicationId, scheduledAt: holding.scheduledAt, status: "Held", note: reason.trim() }))))) return;
    setHolding(null); setReason("");
    reload();
  }

  return (
    <div className="p-5">
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="inline-flex items-center gap-1">
          <button onClick={() => setDate(shiftDay(date, -1))} aria-label="Previous day" className={`${btn.base} ${btn.ghost} !px-2`}><ChevronLeft size={14} /></button>
          <span className="min-w-[120px] text-center text-[13px] font-medium text-[color:var(--ink)]">
            {date === todayLocal() ? "Today" : new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
          </span>
          <button onClick={() => setDate(shiftDay(date, 1))} aria-label="Next day" className={`${btn.base} ${btn.ghost} !px-2`}><ChevronRight size={14} /></button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["All", "missed", "due", "upcoming", "held", "given"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={`inline-flex items-center gap-[5px] h-[26px] px-3 rounded-full border text-[12px] cursor-pointer ${filter === f ? "bg-[color:var(--ink)] border-[color:var(--ink)] text-[color:var(--surface)]" : "bg-[color:var(--surface)] border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>
              {f === "All" ? "All" : LABEL[f]} <span className="font-mono text-[11px] opacity-70">{f === "All" ? mine.length : count(f)}</span>
            </button>
          ))}
        </div>
        <span className="ml-auto text-[12px] text-[color:var(--ink-soft)]">Doses follow each order&apos;s frequency (OD, BD, TDS, QID); as-needed orders are not scheduled.</span>
      </div>
      {error && <p role="alert" className="mb-3 text-[12px] text-[#c8001a]">{error.message}</p>}
      {shown.length === 0 ? <Empty>{mine.length === 0 ? "No scheduled doses for this day." : "No doses in this group."}</Empty> : (
        <div className="rounded-[10px] border border-[color:var(--line)] overflow-hidden">
          {shown.map((s) => {
            const adm = byId.get(s.admissionId);
            return (
              <div key={s.key} className="flex items-center gap-4 px-4 py-[10px] border-b border-[color:var(--line)] last:border-b-0 bg-[color:var(--surface)]">
                <span className="w-[72px] shrink-0 font-mono text-[13px] font-medium text-[color:var(--ink)]">{clock(s.scheduledAt)}</span>
                <div className="w-[220px] shrink-0">{adm && <PatientCell adm={adm} />}</div>
                <div className="min-w-0 flex-1 leading-[18px]">
                  <p className="truncate text-[14px] text-[color:var(--ink)]">{s.medicineName}</p>
                  <p className="truncate text-[12px] text-[color:var(--ink-soft)]">{[s.dosage, s.route].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="w-[190px] shrink-0 text-right">
                  <span className={`inline-flex items-center rounded-full border px-[10px] text-[12px] font-medium ${STATE_STYLE[s.state]}`}>{LABEL[s.state]}</span>
                  {s.givenBy && <p className="mt-[2px] text-[11px] text-[color:var(--ink-soft)]">{s.givenBy}{s.givenAt ? ` · ${clock(s.givenAt)}` : ""}</p>}
                  {s.state === "held" && s.note && <p className="text-[11px] text-[color:var(--ink-soft)] truncate">{s.note}</p>}
                </div>
                <div className="w-[130px] shrink-0 flex justify-end gap-2">
                  {canWrite && (s.state === "due" || s.state === "missed" || s.state === "upcoming") && (
                    <>
                      <button onClick={() => give(s)} disabled={loading} className={`${btn.base} ${s.state === "upcoming" ? btn.ghost : btn.solid}`}>Give</button>
                      <button onClick={() => { setHolding(s); setReason(""); reset(); }} className={`${btn.base} ${btn.ghost}`}>Hold</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!holding} onClose={() => setHolding(null)} title={holding ? `Hold ${holding.medicineName}` : ""} width={440}
        footer={<>
          <button onClick={() => setHolding(null)} className="text-[13px] text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
          <button onClick={hold} disabled={loading || reason.trim().length < 2} className="text-[13px] text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">{loading ? "Saving…" : "Hold dose"}</button>
        </>}>
        <FormRow label="Why is it being held?" required hint="This goes on the patient's chart and raises an alert for the next nurse."><FormInput placeholder="e.g. Nil by mouth for procedure" value={reason} onChange={setReason} /></FormRow>
      </Modal>
    </div>
  );
}
