"use client";

/**
 * Setup - Masters - Chief complaints: the symptoms a doctor can pick on a prescription, each with the questions that describe it
 * (chills or not, how long, what time it rises...). The wording of each choice in the finished sentence is set here too.
 */
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import { DialogButtons, ErrorNote, outlineBtn, Pill } from "@/components/mrd/shared";
import { attempt } from "@/components/hr/shared";
import { AddButton, EditIcon, Labelled, ListBox, ListHeader, Muted, Row, ToggleRow, useSetup, type Rec } from "@/components/setup/ui";
import { KIND_LABEL, sentenceOf, toComplaint, type ComplaintAnswers, type ComplaintQuestion, type ComplaintTemplate, type QuestionKind } from "@/lib/consultation/complaints";

const kindOptions = (Object.keys(KIND_LABEL) as QuestionKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }));
const newId = () => `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function ChiefComplaintsView() {
  const { items, reload } = useSetup("chief_complaint");
  const [editing, setEditing] = useState<Rec | "new" | null>(null);
  return (
    <div>
      <ListHeader title="Chief complaints" count={items.length} note="Symptoms a doctor picks on a prescription, with the questions that describe each one. The sentence is written from the answers.">
        <AddButton primary label="Add complaint" onClick={() => setEditing("new")} />
      </ListHeader>
      <ListBox>
        {items.map((r) => {
          const t = toComplaint(r);
          return (
            <Row key={r.id}>
              <span className="min-w-0 truncate text-[14px] font-medium text-[color:var(--ink)]">{r.name}</span>
              {t.common && <Pill tone="blue">Common</Pill>}
              <Muted>{t.questions.length} {t.questions.length === 1 ? "question" : "questions"}</Muted>
              {!r.active && <Pill tone="grey">Hidden</Pill>}
              <span className="ml-auto"><EditIcon label={`Edit ${r.name}`} onClick={() => setEditing(r)} /></span>
            </Row>
          );
        })}
        {items.length === 0 && <p className="px-4 py-10 text-center text-[14px] text-[color:var(--ink-soft)]">No complaints yet. Add the first one.</p>}
      </ListBox>
      {editing && <ComplaintDesigner key={editing === "new" ? "new" : editing.id} rec={editing === "new" ? null : editing} onClose={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

function ComplaintDesigner({ rec, onClose }: { rec: Rec | null; onClose: () => void }) {
  const start: ComplaintTemplate = rec ? toComplaint(rec) : { id: 0, name: "", common: true, questions: [{ id: newId(), title: "Duration", kind: "duration", optional: false, options: [] }] };
  const [name, setName] = useState(start.name);
  const [common, setCommon] = useState(start.common);
  const [active, setActive] = useState(rec ? rec.active : true);
  const [qs, setQs] = useState<ComplaintQuestion[]>(start.questions);
  const { run, loading, error, reset } = useMutation();
  const patch = (i: number, p: Partial<ComplaintQuestion>) => setQs((a) => a.map((q, j) => (j === i ? { ...q, ...p } : q)));
  const move = (i: number, d: number) => setQs((a) => { const n = [...a]; const j = i + d; if (j < 0 || j >= n.length) return a; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const setOpt = (i: number, k: number, p: Partial<{ label: string; text: string }>) => patch(i, { options: qs[i].options.map((o, m) => (m === k ? { ...o, ...p } : o)) });

  // A sample of what the sentence will look like: the first choice of every question, 3 days.
  const sampleAnswers: ComplaintAnswers = Object.fromEntries(qs.map((q) => [q.id, q.kind === "duration" ? { n: "3", unit: "Days" } : q.kind === "text" ? { text: "…" } : { labels: q.options.slice(0, q.kind === "multi" ? 2 : 1).map((o) => o.label) }]));
  const preview = name.trim() ? sentenceOf({ ...start, name: name.trim(), questions: qs }, sampleAnswers) : "";

  const valid = name.trim().length >= 2;
  async function save() {
    reset();
    const body = {
      name: name.trim(), common, active,
      questions: qs.map((q) => ({ ...q, title: q.title.trim(), options: q.options.filter((o) => o.label.trim()).map((o) => ({ label: o.label.trim(), text: o.text.trim() })) })),
    };
    if (await attempt(run(() => (rec ? api.patch(`/setup/chief_complaint/${rec.id}`, body) : api.post("/setup/chief_complaint", body))))) onClose();
  }
  async function remove() {
    if (!rec || !confirm(`Delete "${rec.name}"? Prescriptions already written are not changed.`)) return;
    if (await attempt(run(() => api.del(`/setup/chief_complaint/${rec.id}`)))) onClose();
  }

  return (
    <Modal open onClose={onClose} width={760} title={rec ? "Edit chief complaint" : "New chief complaint"} subtitle="The doctor picks the complaint, then answers these questions with one tap each."
      footer={(
        <>
          {rec && <button onClick={remove} disabled={loading} className={outlineBtn + " !h-[36px] mr-auto !text-[#c8001a]"}>Delete</button>}
          <DialogButtons onCancel={onClose} onConfirm={save} label={rec ? "Save changes" : "Add complaint"} busyLabel="Saving…" loading={loading} disabled={!valid} />
        </>
      )}>
      <div className="flex flex-col gap-3">
        <Labelled label="Complaint"><FormInput value={name} onChange={setName} placeholder="e.g. Fever" /></Labelled>
        <ToggleRow label="Show as a common shortcut" hint="Common complaints appear as buttons above the search." checked={common} onChange={setCommon} />
        {rec && <ToggleRow label="Available to doctors" hint="Turn off to hide it without deleting it." checked={active} onChange={setActive} />}

        <p className="mt-1 text-[13px] font-medium text-[color:var(--ink)]">Questions</p>
        {qs.map((q, i) => (
          <div key={q.id} className="rounded-[10px] border border-[color:var(--line)] p-3">
            <div className="grid items-end gap-2" style={{ gridTemplateColumns: "1fr 160px auto" }}>
              <Labelled label={`${i + 1}. Question`}><FormInput value={q.title} onChange={(v) => patch(i, { title: v })} placeholder="e.g. Chills / rigors" /></Labelled>
              <Labelled label="Answered by"><FormSelect value={q.kind} onChange={(v) => patch(i, { kind: v as QuestionKind, options: v === "single" || v === "multi" ? (q.options.length ? q.options : [{ label: "", text: "" }, { label: "", text: "" }]) : q.options })} options={kindOptions} /></Labelled>
              <div className="mb-[2px] flex items-center">
                <button aria-label="Move up" onClick={() => move(i, -1)} className="cursor-pointer p-2 text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"><ArrowUp size={15} /></button>
                <button aria-label="Move down" onClick={() => move(i, 1)} className="cursor-pointer p-2 text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"><ArrowDown size={15} /></button>
                <button aria-label="Remove question" onClick={() => setQs((a) => a.filter((_, j) => j !== i))} className="cursor-pointer p-2 text-[color:var(--ink-soft)] hover:text-[#c8001a]"><Trash2 size={15} /></button>
              </div>
            </div>
            {(q.kind === "single" || q.kind === "multi") && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="grid gap-2 text-[11px] uppercase tracking-wider text-[color:var(--ink-soft)]" style={{ gridTemplateColumns: "1fr 1fr 28px" }}><span>Choice shown</span><span>Words in the sentence (blank = leave out)</span><span /></div>
                {q.options.map((o, k) => (
                  <div key={k} className="grid items-center gap-2" style={{ gridTemplateColumns: "1fr 1fr 28px" }}>
                    <FormInput value={o.label} onChange={(v) => setOpt(i, k, { label: v, ...(o.text === o.label.toLowerCase() ? { text: v.toLowerCase() } : {}) })} placeholder="e.g. With chills" />
                    <FormInput value={o.text} onChange={(v) => setOpt(i, k, { text: v })} placeholder="e.g. with chills" />
                    <button aria-label="Remove choice" onClick={() => patch(i, { options: q.options.filter((_, m) => m !== k) })} className="cursor-pointer text-[color:var(--ink-soft)] hover:text-[#c8001a]"><X size={15} /></button>
                  </div>
                ))}
                <div><button onClick={() => patch(i, { options: [...q.options, { label: "", text: "" }] })} className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-medium text-[color:var(--brand)] hover:underline"><Plus size={14} /> Add choice</button></div>
              </div>
            )}
            {q.kind === "duration" && <p className="mt-2 text-[12px] text-[color:var(--ink-soft)]">The doctor types a number and picks hours, days, weeks, months or years. It is written as “for 3 days” after the complaint.</p>}
            <div className="mt-2"><ToggleRow label="Optional" hint="Shown as “(optional)” to the doctor." checked={q.optional} onChange={(v) => patch(i, { optional: v })} /></div>
          </div>
        ))}
        {qs.length === 0 && <p className="rounded-[8px] border border-dashed border-[color:var(--line)] py-6 text-center text-[13px] text-[color:var(--ink-soft)]">No questions yet. The doctor will just pick this complaint.</p>}
        <div><AddButton label="Add question" onClick={() => setQs((a) => [...a, { id: newId(), title: "", kind: "single", optional: false, options: [{ label: "", text: "" }, { label: "", text: "" }] }])} /></div>

        {preview && (
          <div className="rounded-[10px] bg-[color:var(--subtle)] px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-[color:var(--ink-soft)]">Preview (first choices, 3 days)</p>
            <p className="mt-1 text-[14px] text-[color:var(--ink)]">{preview}</p>
          </div>
        )}
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}
