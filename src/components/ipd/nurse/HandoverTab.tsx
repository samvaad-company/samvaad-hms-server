"use client";

/**
 * Handover: for the shift in progress, each patient with what the next nurse should know — what is pending is
 * worked out from the ward's records, and the nurse adds free-text notes on top.
 */
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import type { IpdHandoverDTO } from "@/types/api";
import { btn, cardCls, clock, Empty, useAutoRefresh, type WardPatient, done } from "@/components/ipd/nurse/shared";

interface HandoverDTO {
  shift: "Morning" | "Evening" | "Night";
  shiftDate: string;
  notes: IpdHandoverDTO[];
}

function Pending({ p }: { p: WardPatient }) {
  const l = p.live;
  const items = [
    l && l.dosesMissed > 0 && { t: `${l.dosesMissed} missed ${l.dosesMissed === 1 ? "dose" : "doses"}`, tone: "bad" },
    l && l.dosesDue > 0 && { t: `${l.dosesDue} ${l.dosesDue === 1 ? "dose" : "doses"} due`, tone: "warn" },
    l && l.ivRunning > 0 && { t: `${l.ivRunning} IV running`, tone: "info" },
    l && l.newOrders > 0 && { t: `${l.newOrders} new ${l.newOrders === 1 ? "order" : "orders"}`, tone: "info" },
    l?.vitalsDue && { t: "Vitals due", tone: "warn" },
    l && l.openTasks > 0 && { t: `${l.openTasks} open ${l.openTasks === 1 ? "task" : "tasks"}`, tone: "info" },
    l && l.openChecklists > 0 && { t: `${l.openChecklists} checklist in progress`, tone: "info" },
  ].filter(Boolean) as { t: string; tone: "bad" | "warn" | "info" }[];
  if (items.length === 0) return <p className="text-[12px] text-[color:var(--ink-soft)]">Nothing pending.</p>;
  const tone = { bad: "border-[#f4a3ac] bg-[#ffe3e5] text-[#b3001b]", warn: "border-[#f3cf7d] bg-[#fff2d6] text-[#8a5300]", info: "border-[color:var(--line)] text-[color:var(--ink)]" };
  return <div className="flex flex-wrap gap-2">{items.map((i) => <span key={i.t} className={`rounded-full border px-2 text-[11px] font-medium ${tone[i.tone]}`}>{i.t}</span>)}</div>;
}

function Card({ p, notes, canWrite, onAdded }: { p: WardPatient; notes: IpdHandoverDTO[]; canWrite: boolean; onAdded: () => void }) {
  const [text, setText] = useState("");
  const { run, loading, error } = useMutation();
  async function add() {
    if (!(await done(run(() => api.post("/ipd/nurse/handover", { admissionId: p.adm.id, note: text.trim() }))))) return;
    setText("");
    onAdded();
  }
  return (
    <li className={`${cardCls} px-4 py-3`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-semibold text-[color:var(--ink)]">{p.adm.patientName} <span className="font-mono text-[12px] font-normal text-[color:var(--ink-soft)]">{p.adm.bed || "No bed"} · {p.adm.ward}</span></p>
        <p className="truncate text-[12px] text-[color:var(--ink-soft)]">{p.adm.diagnosis || "No diagnosis recorded"}</p>
      </div>
      <div className="mt-2"><Pending p={p} /></div>
      {notes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-[8px] bg-[color:var(--subtle)] px-3 py-2 text-[13px] text-[color:var(--ink)]">
              {n.note}
              <span className="block text-[11px] text-[color:var(--ink-soft)]">{n.author} · {clock(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
      {canWrite && (
        <div className="mt-3 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note for the next shift…" aria-label={`Handover note for ${p.adm.patientName}`}
            className="h-[34px] flex-1 rounded-[8px] bg-[color:var(--surface)] border border-[color:var(--line)] px-3 text-[13px] text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] focus:outline-none focus:border-[color:var(--brand)]" />
          <button onClick={add} disabled={loading || text.trim().length < 2} className={`${btn.base} ${btn.solid}`}>Add</button>
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-[12px] text-[#c8001a]">{error.message}</p>}
    </li>
  );
}

export function HandoverTab({ patients, canWrite }: { patients: WardPatient[]; canWrite: boolean }) {
  const { item: data, reload } = useItem<HandoverDTO>("/ipd/nurse/handover");
  useAutoRefresh(reload);
  return (
    <div className="p-5">
      <p className="mb-3 text-[13px] text-[color:var(--ink-soft)]">
        <span className="font-semibold text-[color:var(--ink)]">{data?.shift ?? "…"} shift</span>
        {data ? ` · ${new Date(`${data.shiftDate}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}` : ""} — pending items are read off the chart; notes are yours.
      </p>
      {patients.length === 0 ? <Empty>No patients in this view.</Empty> : (
        <ul className="flex flex-col gap-3">
          {patients.map((p) => <Card key={p.adm.id} p={p} notes={(data?.notes ?? []).filter((n) => n.admissionId === p.adm.id)} canWrite={canWrite} onAdded={reload} />)}
        </ul>
      )}
    </div>
  );
}
