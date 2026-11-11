"use client";

/** Drug chart (MAR): every medicine down the side, the days across, each dose with what became of it. */
import { useEffect, useMemo, useState } from "react";
import { Plus, Printer } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import type { DoseSlotDTO, IpdMedicationDTO } from "@/types/api";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormRow } from "@/components/shared/FormRow";
import { Card, ChartCtx, ErrorLine, btn, dayName, done, timeOf } from "@/components/ipd/patient/ui";
import { OrderDialog } from "@/components/ipd/patient/SheetTab";
import { todayIso } from "@/lib/dates";

const addDays = (d: string, n: number) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)).toISOString().slice(0, 10);
type Range = "now" | "today" | "next3" | "past3";
const RANGES: { id: Range; label: string }[] = [{ id: "now", label: "Around now" }, { id: "today", label: "Today" }, { id: "next3", label: "Next 3 days" }, { id: "past3", label: "Past 3 days" }];

const STATE_STYLE: Record<string, string> = {
  given: "border-[#b9e5cd] bg-[#e6f7ee] text-[#0b7a47]",
  due: "border-[#f3cf7d] bg-[#fff2d6] text-[#8a5300] font-semibold",
  missed: "border-[#f4a3ac] bg-[#ffe3e5] text-[#b3001b]",
  held: "border-[color:var(--line)] bg-[color:var(--subtle)] text-[color:var(--ink-soft)] line-through",
  upcoming: "border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink)]",
};

export function DrugChartTab({ ctx }: { ctx: ChartCtx }) {
  const today = todayIso();
  const [range, setRange] = useState<Range>("now");
  const days = useMemo(() => (range === "now" ? [today, addDays(today, 1)] : range === "today" ? [today] : range === "next3" ? [today, addDays(today, 1), addDays(today, 2)] : [addDays(today, -2), addDays(today, -1), today]), [range, today]);
  const { items: meds, reload: reloadMeds } = useList<IpdMedicationDTO>("/ipd/medications", { all: true, admission_id: ctx.id });
  const [slots, setSlots] = useState<DoseSlotDTO[]>([]);
  const [tick, setTick] = useState(0);
  const { run, loading, error } = useMutation();
  const [order, setOrder] = useState(false);
  const [hold, setHold] = useState<DoseSlotDTO | null>(null);
  const [why, setWhy] = useState("");
  const [showStopped, setShowStopped] = useState(false);
  const editable = ctx.canNurse && !ctx.discharged;

  useEffect(() => {
    let live = true;
    Promise.all(days.map((d) => api.get<DoseSlotDTO[]>(`/ipd/nurse/doses?date=${d}`).catch(() => [] as DoseSlotDTO[]))).then((all) => { if (live) setSlots(all.flat().filter((s) => s.admissionId === ctx.id)); });
    return () => { live = false; };
  }, [days, ctx.id, tick]);

  const reload = () => { setTick((n) => n + 1); reloadMeds(); ctx.refresh(); };
  const shownMeds = meds.filter((m) => showStopped || m.status === "Active");
  const stopped = meds.filter((m) => m.status !== "Active").length;
  const signOff = slots.filter((s) => s.state === "due").length;

  async function give(medicationId: number, scheduledAt: string, status: "Given" | "Held", note = "") {
    if (await done(run(() => api.post("/ipd/nurse/doses", { medicationId, scheduledAt, status, note })))) reload();
  }
  async function stop(m: IpdMedicationDTO) {
    if (!confirm(`Stop ${m.medicineName}? No more doses will be planned.`)) return;
    if (await done(run(() => api.patch(`/ipd/medications/${m.id}`, { status: "Stopped" })))) reload();
  }

  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => <button key={r.id} type="button" onClick={() => setRange(r.id)} className={`${btn.base} ${range === r.id ? btn.solid : btn.ghost}`}>{r.label}</button>)}
        <span className="ml-auto text-[12px] text-[color:var(--ink-soft)]">Sign off shift ({signOff} due)</span>
        <button type="button" onClick={() => window.print()} className={`${btn.base} ${btn.ghost}`}><Printer size={13} /> Print MAR sheet</button>
        {editable && <button type="button" onClick={() => setOrder(true)} className={`${btn.base} ${btn.solid}`}><Plus size={13} /> Add medicine</button>}
      </div>
      <ErrorLine error={error} />

      <Card className="overflow-x-auto !p-0">
        <div className="min-w-[640px]">
          <div className="grid border-b border-[color:var(--line)] bg-[color:var(--subtle)] text-[12px] font-medium text-[color:var(--ink)]" style={{ gridTemplateColumns: `minmax(200px,1fr) repeat(${days.length}, minmax(180px,1.4fr))` }}>
            <span className="px-4 py-2">Medicine</span>
            {days.map((d) => <span key={d} className="px-3 py-2">{dayName(`${d}T12:00:00`)}</span>)}
          </div>
          {shownMeds.length === 0 && <p className="py-10 text-center text-[13px] text-[color:var(--ink-soft)]">No medicines on the chart yet.</p>}
          {shownMeds.map((m) => (
            <div key={m.id} className="grid border-b border-[color:var(--subtle-2)] last:border-b-0" style={{ gridTemplateColumns: `minmax(200px,1fr) repeat(${days.length}, minmax(180px,1.4fr))` }}>
              <div className="px-4 py-3">
                <p className={`text-[13px] font-medium ${m.status === "Active" ? "text-[color:var(--ink)]" : "text-[color:var(--ink-soft)] line-through"}`}>{m.medicineName}</p>
                <p className="text-[12px] text-[color:var(--ink-soft)]">{[m.dosage, m.route, m.frequency].filter(Boolean).join(" · ")}</p>
                {editable && m.status === "Active" && (
                  <div className="mt-1 flex gap-3">
                    <button className="cursor-pointer text-[12px] text-[color:var(--brand)] hover:underline" onClick={() => give(m.id, new Date().toISOString(), "Given")}>+ Add dose</button>
                    <button className="cursor-pointer text-[12px] text-[color:var(--ink-soft)] hover:underline" onClick={() => stop(m)}>Stop</button>
                  </div>
                )}
                {m.status !== "Active" && <p className="text-[11px] text-[color:var(--ink-soft)]">{m.status}</p>}
              </div>
              {days.map((d) => {
                const mine = slots.filter((s) => s.medicationId === m.id && s.scheduledAt.slice(0, 10) === d).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
                return (
                  <div key={d} className="flex flex-wrap content-start gap-[6px] px-3 py-3">
                    {mine.length === 0 ? <span className="text-[12px] text-[color:var(--ink-soft)]">{m.status === "Active" ? "No fixed doses — add one when needed." : "No more doses planned."}</span> : mine.map((s) => (
                      <span key={s.key} className={`inline-flex items-center gap-1 rounded-[6px] border px-[6px] py-[2px] font-mono text-[12px] ${STATE_STYLE[s.state]}`} title={s.givenBy ? `${s.state} by ${s.givenBy}` : s.state}>
                        {timeOf(s.scheduledAt)}
                        {s.state === "given" && "✓"}{s.state === "missed" && "!"}
                        {editable && (s.state === "due" || (s.state === "upcoming" && d === today)) && (
                          <>
                            <button className="ml-1 cursor-pointer font-sans text-[11px] underline" onClick={() => give(m.id, s.scheduledAt, "Given")}>give</button>
                            <button className="cursor-pointer font-sans text-[11px] underline" onClick={() => { setHold(s); setWhy(""); }}>hold</button>
                          </>
                        )}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-[color:var(--ink-soft)]">
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-sm border border-[#b9e5cd] bg-[#e6f7ee]" /> Given (time shown)</span>
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-sm border border-[#f3cf7d] bg-[#fff2d6]" /> Due now</span>
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-sm border border-[#f4a3ac] bg-[#ffe3e5]" /> Missed</span>
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-sm border border-[color:var(--line)] bg-[color:var(--surface)]" /> Later</span>
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-sm border border-[color:var(--line)] bg-[color:var(--subtle)]" /> Held / refused</span>
        {stopped > 0 && <button type="button" onClick={() => setShowStopped((s) => !s)} className="ml-auto cursor-pointer text-[color:var(--brand)] hover:underline">{showStopped ? "Hide" : "Show"} {stopped} stopped / completed</button>}
      </div>

      {order && <OrderDialog ctx={ctx} open onClose={() => setOrder(false)} onSaved={reload} />}
      <Modal open={hold !== null} onClose={() => setHold(null)} title="Hold this dose" subtitle={hold ? `${hold.medicineName} · ${timeOf(hold.scheduledAt)}` : ""}
        footer={<><button onClick={() => setHold(null)} className={`${btn.base} ${btn.ghost}`}>Cancel</button><button disabled={loading || !why.trim()} className={`${btn.base} ${btn.solid}`} onClick={async () => { if (hold) { await give(hold.medicationId, hold.scheduledAt, "Held", why.trim()); setHold(null); } }}>Hold dose</button></>}>
        <FormRow label="Why is it being held?" required><FormInput value={why} onChange={setWhy} placeholder="e.g. Patient vomiting, refused" /></FormRow>
      </Modal>
    </div>
  );
}
