"use client";

/**
 * OPD vitals log. A patient's vitals can be taken as many times as needed, in a visit or across a day: every reading is kept with
 * its time and who took it. `AddVitalsModal` adds a new reading to a visit; `VitalsHistory` lists them, newest first, by day.
 */
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import type { OpdVitalDTO } from "@/types/api";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput } from "@/components/shared/FormRow";

const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

/** "120/80 · 72 bpm · 98.6 °F · 98%" for one reading. */
export function readingSummary(v: OpdVitalDTO): string {
  return [
    v.bpSystolic != null ? `${v.bpSystolic}/${v.bpDiastolic ?? "—"} mmHg` : null,
    v.pulse != null ? `${v.pulse} bpm` : null,
    v.temperature != null ? `${v.temperature} °F` : null,
    v.spo2 != null ? `SpO₂ ${v.spo2}%` : null,
  ].filter(Boolean).join(" · ");
}

/** The readings, newest first, grouped by day. `showVisit` adds the visit each belongs to (for a patient's whole history). */
export function VitalsHistory({ readings, visitLabels }: { readings: OpdVitalDTO[]; visitLabels?: Record<number, string> }) {
  if (readings.length === 0) return <p className="py-6 text-center text-[13px] font-light text-[color:var(--ink-soft)]">No vitals recorded yet.</p>;
  const days: { day: string; items: OpdVitalDTO[] }[] = [];
  for (const r of readings) {
    const day = dayOf(r.recordedAt);
    const last = days[days.length - 1];
    if (last && last.day === day) last.items.push(r); else days.push({ day, items: [r] });
  }
  return (
    <div className="flex flex-col gap-4">
      {days.map((d) => (
        <div key={d.day}>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">
            {d.day} <span className="font-normal normal-case">· {d.items.length} {d.items.length === 1 ? "reading" : "readings"}</span>
          </p>
          <div className="overflow-hidden rounded-[10px] border border-[color:var(--line)]">
            {d.items.map((r) => (
              <div key={r.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-[color:var(--subtle-2)] px-4 py-[10px] last:border-b-0">
                <span className="w-[68px] shrink-0 text-[13px] font-medium text-[color:var(--ink)]">{timeOf(r.recordedAt)}</span>
                <span className="min-w-0 flex-1 text-[13px] text-[color:var(--ink)]">
                  {readingSummary(r) || "—"}
                  {r.note && r.note !== "At check-in" ? <span className="ml-2 font-light text-[color:var(--ink-soft)]">“{r.note}”</span> : null}
                </span>
                <span className="text-[11px] font-light text-[color:var(--ink-soft)]">
                  {visitLabels?.[r.visitId] ? `${visitLabels[r.visitId]} · ` : ""}{r.note === "At check-in" ? "At check-in · " : ""}{r.recordedBy}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const EMPTY = { bpSystolic: "", bpDiastolic: "", pulse: "", temperature: "", spo2: "", note: "", time: "" };
type SetForm = typeof EMPTY;

/** Today at HH:MM (local) as an ISO time; empty means "now", which the server fills in. */
const atTime = (hhmm: string): string | undefined => {
  if (!hhmm) return undefined;
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

/** Adds vitals to a visit: one set or several in a single save. Earlier readings stay, and the form clears ready for the next. */
export function AddVitalsModal({ visitId, patientName, tokenNumber, open, onClose, onSaved }: {
  visitId: number | null;
  patientName: string;
  tokenNumber: string;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { items: readings, reload } = useList<OpdVitalDTO>(visitId != null && open ? `/opd/${visitId}/vitals` : null, { all: true });
  const [sets, setSets] = useState<SetForm[]>([EMPTY]);
  const { run, loading, error, reset } = useMutation();
  const change = (i: number, k: keyof SetForm, v: string) => { reset(); setSets((all) => all.map((x, n) => (n === i ? { ...x, [k]: v } : x))); };
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
  const hasReading = (x: SetForm) => [x.bpSystolic, x.bpDiastolic, x.pulse, x.temperature, x.spo2].some((v) => v.trim() !== "");
  const filled = sets.filter(hasReading);

  async function save() {
    if (visitId == null || filled.length === 0) return;
    try {
      await run(() => api.post(`/opd/${visitId}/vitals`, {
        readings: filled.map((x) => ({ bpSystolic: num(x.bpSystolic), bpDiastolic: num(x.bpDiastolic), pulse: num(x.pulse), temperature: num(x.temperature), spo2: num(x.spo2), note: x.note.trim(), recordedAt: atTime(x.time) })),
      }));
    } catch { return; }
    setSets([EMPTY]);
    reload();
    onSaved?.();
  }
  const close = () => { reset(); setSets([EMPTY]); onClose(); };

  return (
    <Modal open={open} onClose={close} width={700} title="Vitals" subtitle={`${patientName} · ${tokenNumber}. Add one set or several at once — earlier readings are kept.`}
      footer={<>
        <button onClick={close} className="rounded-full border border-[color:var(--line)] px-5 py-[8px] text-[13px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer">Close</button>
        <button onClick={save} disabled={loading || filled.length === 0} className="rounded-full bg-[color:var(--brand)] px-5 py-[8px] text-[13px] text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">
          {loading ? "Saving…" : filled.length > 1 ? `Add ${filled.length} readings` : "Add reading"}
        </button>
      </>}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          {sets.map((f, i) => (
            <div key={i} className="rounded-[10px] border border-[color:var(--line)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">Set {i + 1}</span>
                {sets.length > 1 && <button type="button" onClick={() => setSets((all) => all.filter((_, n) => n !== i))} className="cursor-pointer text-[12px] text-[color:var(--ink-soft)] hover:text-[#ff0004]">Remove</button>}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <FormRow label="BP systolic (mmHg)"><FormInput type="number" placeholder="120" value={f.bpSystolic} onChange={(v) => change(i, "bpSystolic", v)} /></FormRow>
                <FormRow label="BP diastolic (mmHg)"><FormInput type="number" placeholder="80" value={f.bpDiastolic} onChange={(v) => change(i, "bpDiastolic", v)} /></FormRow>
                <FormRow label="Pulse (bpm)"><FormInput type="number" placeholder="72" value={f.pulse} onChange={(v) => change(i, "pulse", v)} /></FormRow>
                <FormRow label="Temperature (°F)"><FormInput type="number" placeholder="98.6" value={f.temperature} onChange={(v) => change(i, "temperature", v)} /></FormRow>
                <FormRow label="SpO₂ (%)"><FormInput type="number" placeholder="98" value={f.spo2} onChange={(v) => change(i, "spo2", v)} /></FormRow>
                <FormRow label="Time taken (empty = now)"><FormInput type="time" placeholder="" value={f.time} onChange={(v) => change(i, "time", v)} /></FormRow>
              </div>
              <div className="mt-3"><FormRow label="Note (optional)"><FormInput placeholder="e.g. after medication" value={f.note} onChange={(v) => change(i, "note", v)} /></FormRow></div>
            </div>
          ))}
          <button type="button" onClick={() => setSets((all) => [...all, EMPTY])} disabled={sets.length >= 24} className="self-start cursor-pointer text-[13px] text-[color:var(--brand)] hover:underline disabled:opacity-50">+ Add another set</button>
        </div>
        {error && <p className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#ff0004]">{error.message}</p>}
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">Readings so far</p>
          <VitalsHistory readings={readings} />
        </div>
      </div>
    </Modal>
  );
}
