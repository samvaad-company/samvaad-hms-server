"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import type { HkBoardDTO, HkTaskDTO } from "@/types/api";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormRow, FormSelect, FormTextarea } from "@/components/shared/FormRow";

const COLUMNS: { status: HkTaskDTO["status"]; label: string; note: string; tone: string }[] = [
  { status: "Pending", label: "Pending", note: "Raised, no one on it yet", tone: "bg-[#ffe9e9] text-[#c8001a] border-[#f3b4b4]" },
  { status: "In progress", label: "In progress", note: "The floor is cleaning", tone: "bg-[#fff1dc] text-[#8a5300] border-[#f1cf9b]" },
  { status: "Completed", label: "Completed", note: "Awaiting supervisor verify", tone: "bg-[color:var(--subtle)] text-[color:var(--ink)] border-[color:var(--line)]" },
];
const clock = (ts: string | null) => (ts ? new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) : "");
const chip = "rounded-[6px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 py-[1px] text-[12px] text-[color:var(--ink)]";
const btn = "cursor-pointer rounded-[8px] px-3 py-[5px] text-[13px] font-medium";

type Dialog = { kind: "assign" | "complete" | "verify"; task: HkTaskDTO } | { kind: "new" } | null;

function Card({ t, act }: { t: HkTaskDTO; act: (d: Dialog) => void; }) {
  const { run } = useMutation();
  return (
    <article className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[10px]">
      <div className="flex items-center gap-2 text-[12px]">
        <span className={chip}>{t.kind}</span><span className="text-[color:var(--ink-soft)]">{t.source}</span>
        <span className="ml-auto font-mono text-[color:var(--ink-soft)]">{t.date}</span>
      </div>
      <h3 className="mt-2 text-[14px] font-semibold leading-5">{t.title}</h3>
      {t.assignee && <p className="text-[12px] text-[color:var(--ink-soft)]">{t.assignee}</p>}
      {(t.notes || t.completionNotes) && <p className="mt-[2px] line-clamp-2 text-[12px] text-[color:var(--ink-soft)]" title={t.notes}>{t.completionNotes || t.notes}</p>}
      {t.startedAt && t.status === "In progress" && <p className="mt-1 font-mono text-[11px] text-[color:var(--ink-soft)]">started {clock(t.startedAt)}</p>}
      {t.completedAt && t.status === "Completed" && <p className="mt-1 font-mono text-[11px] text-[color:var(--ink-soft)]">done {clock(t.completedAt)}</p>}
      <div className="mt-2 flex items-center gap-2">
        {t.status === "Pending" && <button className={`${btn} bg-[color:var(--brand-soft)] text-[color:var(--brand)]`} onClick={() => void run(() => api.post(`/housekeeping/tasks/${t.id}/start`))}>Start</button>}
        {t.status === "Pending" && <button className={`${btn} text-[color:var(--ink)]`} onClick={() => act({ kind: "assign", task: t })}>Assign</button>}
        {(t.status === "Pending" || t.status === "In progress") && <button className={`${btn} ${t.status === "Pending" ? "border border-[color:var(--line)]" : "bg-[color:var(--brand-soft)] text-[color:var(--brand)]"}`} onClick={() => act({ kind: "complete", task: t })}>Complete…</button>}
        {t.status === "Completed" && <button className={`${btn} bg-[color:var(--brand-soft)] text-[color:var(--brand)]`} onClick={() => act({ kind: "verify", task: t })}>Verify…</button>}
      </div>
    </article>
  );
}

export function TasksBoard({ board, openNew, onClose }: { board: HkBoardDTO; openNew: boolean; onClose: () => void }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [text, setText] = useState("");
  const [assignee, setAssignee] = useState("");
  const [wardId, setWardId] = useState("");
  const [bedId, setBedId] = useState("");
  const [location, setLocation] = useState("");
  const { run, loading, error, reset } = useMutation();
  const closeAll = () => { setDialog(null); onClose(); setText(""); setAssignee(""); setWardId(""); setBedId(""); setLocation(""); reset(); };
  const current: Dialog = dialog ?? (openNew ? { kind: "new" } : null);
  const staff = board.staff.map((s) => ({ value: s.name, label: `${s.name} · ${s.role}` }));
  const submit = () => run(async () => {
    if (!current) return;
    if (current.kind === "new") await api.post("/housekeeping/tasks", { ...(wardId && { wardId: Number(wardId) }), ...(bedId && { bedId: Number(bedId) }), location, assignee, notes: text });
    else if (current.kind === "assign") await api.post(`/housekeeping/tasks/${current.task.id}/assign`, { assignee });
    else await api.post(`/housekeeping/tasks/${current.task.id}/${current.kind}`, { notes: text });
    closeAll();
  }).catch(() => undefined);

  const title = !current ? "" : current.kind === "new" ? "New housekeeping task" : current.kind === "assign" ? "Assign task" : current.kind === "complete" ? "Complete task" : "Verify task";
  const subtitle = !current ? "" : current.kind === "new" ? "An ad hoc cleaning job (corridor spill, OT lobby...). Bed turnarounds are raised automatically on discharge."
    : `${current.task.title}${current.kind === "verify" ? " — confirm the area is clean and ready." : ""}`;
  return (
    <>
      <div className="grid items-start gap-4 p-4" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        {COLUMNS.map((c) => {
          const list = board.tasks.filter((t) => t.status === c.status);
          return (
            <section key={c.status} aria-label={c.label} className="rounded-[12px] border border-[color:var(--line)] bg-[color:var(--subtle)] p-2">
              <header className="mb-2 flex items-center gap-2 px-1 text-[13px]">
                <span className={`rounded-full border px-3 py-[2px] font-medium ${c.tone}`}>{c.label}</span>
                <span className="font-mono text-[color:var(--ink-soft)]">{list.length}</span>
                <span className="ml-auto text-[12px] text-[color:var(--ink-soft)]">{c.note}</span>
              </header>
              <div className="flex max-h-[calc(100vh-290px)] min-h-[80px] flex-col gap-2 overflow-y-auto pr-[2px]">
                {list.length === 0 && <p className="px-2 py-6 text-center text-[13px] text-[color:var(--ink-soft)]">Nothing here.</p>}
                {list.map((t) => <Card key={t.id} t={t} act={setDialog} />)}
              </div>
            </section>
          );
        })}
      </div>

      <Modal open={!!current} onClose={closeAll} title={title} subtitle={subtitle} width={460}
        footer={<div className="flex justify-end gap-3"><button onClick={closeAll} className="cursor-pointer px-3 py-2 text-[14px] font-medium">Cancel</button>
          <button onClick={() => void submit()} disabled={loading || (current?.kind === "assign" && !assignee.trim())} className="cursor-pointer rounded-[8px] bg-[color:var(--brand)] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50">
            {current?.kind === "new" ? "Raise task" : current?.kind === "assign" ? "Assign" : current?.kind === "complete" ? "Mark complete" : "Verify"}</button></div>}>
        {current?.kind === "new" && (
          <div className="flex flex-col gap-4">
            <FormRow label="Ward"><FormSelect value={wardId} onChange={(v) => { setWardId(v); setBedId(""); }} options={[{ value: "", label: "Anywhere" }, ...board.wards.map((w) => ({ value: String(w.id), label: w.name }))]} /></FormRow>
            <FormRow label="Bed"><FormSelect value={bedId} onChange={setBedId} options={[{ value: "", label: "No specific bed" }, ...board.beds.filter((b) => !wardId || String(b.wardId) === wardId).map((b) => ({ value: String(b.id), label: b.label }))]} /></FormRow>
            <FormRow label="Location"><FormInput value={location} onChange={setLocation} placeholder="e.g. OPD corridor, OT lobby" /></FormRow>
            <FormRow label="Assign to"><FormSelect value={assignee} onChange={setAssignee} options={[{ value: "", label: "Optional" }, ...staff]} /></FormRow>
            <FormRow label="Notes"><FormTextarea value={text} onChange={setText} placeholder="" /></FormRow>
          </div>
        )}
        {current?.kind === "assign" && (
          <FormRow label="Assign to" required><FormSelect value={assignee} onChange={setAssignee} placeholder="Pick a person" options={staff} /></FormRow>
        )}
        {(current?.kind === "complete" || current?.kind === "verify") && (
          <FormRow label={current.kind === "complete" ? "What was done" : "Verification notes"}><FormTextarea value={text} onChange={setText} placeholder="Optional" /></FormRow>
        )}
        {error && <p role="alert" className="mt-3 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
      </Modal>
    </>
  );
}
