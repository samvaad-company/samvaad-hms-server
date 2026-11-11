"use client";

/** Rounds & notes: the doctors' rounds and the nursing notes for this stay, newest first, with a box to add either. */
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import type { IpdNoteDTO } from "@/types/api";
import { FormTextarea } from "@/components/shared/FormRow";
import { Card, ChartCtx, ErrorLine, Pill, btn, done } from "@/components/ipd/patient/ui";
import { formatDate } from "@/lib/dates";

type Kind = "Doctor Round" | "Daily Note";

export function RoundsTab({ ctx }: { ctx: ChartCtx }) {
  const { items, reload } = useList<IpdNoteDTO>("/ipd/notes", { all: true, admission_id: ctx.id });
  const { run, loading, error, reset } = useMutation();
  const [filter, setFilter] = useState<"All" | Kind>("All");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>(ctx.isDoctor ? "Doctor Round" : "Daily Note");
  const [findings, setFindings] = useState("");
  const [orders, setOrders] = useState("");
  const [text, setText] = useState("");

  const notes = items.filter((n) => n.noteType !== "Diet");
  const shown = notes
    .filter((n) => filter === "All" || n.noteType === filter)
    .filter((n) => !q.trim() || `${n.content} ${n.author}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.id - a.id);
  const isRound = kind === "Doctor Round";
  const content = isRound ? [findings.trim() && `Findings: ${findings.trim()}`, orders.trim() && `Orders: ${orders.trim()}`].filter(Boolean).join("\n\n") : text.trim();
  const editable = ctx.canWrite && !ctx.discharged;

  async function add() {
    if (!content) return;
    if (!(await done(run(() => api.post("/ipd/notes", { admissionId: ctx.id, noteType: kind, content }))))) return;
    setFindings(""); setOrders(""); setText("");
    reload();
    ctx.refresh();
  }
  async function remove(id: number) {
    if (!confirm("Delete this note?")) return;
    if (await done(run(() => api.del(`/ipd/notes/${id}`)))) { reload(); ctx.refresh(); }
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      {editable && (
        <Card title="Add to the record">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              {(["Doctor Round", "Daily Note"] as const).map((k) => (
                <button key={k} type="button" onClick={() => { reset(); setKind(k); }} className={`${btn.base} ${kind === k ? btn.solid : btn.ghost}`}>{k === "Doctor Round" ? "Doctor round" : "Nursing / daily note"}</button>
              ))}
            </div>
            {isRound ? (
              <div className="grid gap-3 md:grid-cols-2">
                <FormTextarea value={findings} onChange={setFindings} rows={3} placeholder="Clinical findings on this round…" />
                <FormTextarea value={orders} onChange={setOrders} rows={3} placeholder="Orders / instructions…" />
              </div>
            ) : <FormTextarea value={text} onChange={setText} rows={3} placeholder="Vitals, intake/output, observations…" />}
            <ErrorLine error={error} />
            <div className="flex justify-end"><button onClick={add} disabled={loading || !content} className={`${btn.base} ${btn.solid}`}>{loading ? "Saving…" : isRound ? "Add round" : "Add note"}</button></div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(["All", "Doctor Round", "Daily Note"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`${btn.base} ${filter === f ? btn.solid : btn.ghost}`}>
            {f === "All" ? "Everything" : f === "Doctor Round" ? "Doctor rounds" : "Nursing notes"} · {f === "All" ? notes.length : notes.filter((n) => n.noteType === f).length}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes or authors…" className="ml-auto h-[32px] w-[240px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px] outline-none focus:border-[color:var(--brand)]" />
      </div>

      {shown.length === 0 ? <p className="py-10 text-center text-[13px] text-[color:var(--ink-soft)]">No notes yet.</p> : (
        <div className="flex flex-col gap-3">
          {shown.map((n) => (
            <article key={n.id} className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] p-4">
              <div className="mb-2 flex items-center gap-2 text-[12px]">
                <Pill tone={n.noteType === "Doctor Round" ? "info" : "neutral"}>{n.noteType === "Doctor Round" ? "Doctor round" : "Nursing note"}</Pill>
                <span className="text-[color:var(--ink-soft)]">{formatDate(n.date)} · {n.time} · {n.author}</span>
                {editable && <button aria-label="Delete note" onClick={() => remove(n.id)} className="ml-auto cursor-pointer text-[#c8c8cc] hover:text-[#ff0004]"><Trash2 size={13} /></button>}
              </div>
              <p className="whitespace-pre-wrap text-[13px] text-[color:var(--ink)]">{n.content}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
