"use client";

/**
 * Pick a complaint, answer a few questions with one tap each, and the sentence writes itself. The complaints and their questions are
 * set up in Masters (Chief complaints); "Add to clinical notes" puts the sentence into the chief complaint text.
 */
import { useMemo, useRef, useState, useEffect } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { useList } from "@/lib/api/hooks";
import type { SetupRecordDTO } from "@/types/setup";
import { DURATION_UNITS, sentenceOf, toComplaint, type ComplaintAnswers, type ComplaintQuestion, type ComplaintTemplate } from "@/lib/consultation/complaints";

const inputCls = "h-[36px] bg-[color:var(--surface)] border border-[color:var(--line)] rounded-[8px] px-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)]";

interface Entry { key: number; t: ComplaintTemplate; a: ComplaintAnswers; more: string; showMore: boolean }
let entryKey = 1;

function Pill({ on, multi, label, onClick }: { on: boolean; multi: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-[8px] border px-3 py-[7px] text-[13px] transition-colors ${on ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)] font-medium text-[color:var(--brand)]" : "border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>
      <span className={`flex h-[16px] w-[16px] shrink-0 items-center justify-center border ${multi ? "rounded-[4px]" : "rounded-full"} ${on ? "border-[color:var(--brand)] bg-[color:var(--brand)] text-white" : "border-[color:var(--line)]"}`}>{on && <Check size={11} strokeWidth={3} />}</span>
      {label}
    </button>
  );
}

function Question({ q, n, value, onChange }: { q: ComplaintQuestion; n: number; value: ComplaintAnswers[string] | undefined; onChange: (v: ComplaintAnswers[string]) => void }) {
  const labels = value?.labels ?? [];
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-[color:var(--ink)]">
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-[color:var(--subtle)] text-[10px] text-[color:var(--ink-soft)]">{n}</span>
        {q.title}{q.optional && <span className="text-[11px] font-normal text-[color:var(--ink-soft)]">(optional)</span>}
      </p>
      {(q.kind === "single" || q.kind === "multi") && (
        <div className="flex flex-wrap gap-2">
          {q.options.map((o) => {
            const on = labels.includes(o.label);
            return <Pill key={o.label} on={on} multi={q.kind === "multi"} label={o.label}
              onClick={() => onChange({ labels: q.kind === "multi" ? (on ? labels.filter((l) => l !== o.label) : [...labels, o.label]) : on ? [] : [o.label] })} />;
          })}
        </div>
      )}
      {q.kind === "duration" && (
        <div className="flex items-center gap-2">
          <input inputMode="numeric" className={`${inputCls} w-[90px]`} value={value?.n ?? ""} placeholder="3" onChange={(e) => onChange({ ...value, n: e.target.value.replace(/[^0-9.]/g, "").slice(0, 4), unit: value?.unit ?? "Days" })} />
          <select className={`${inputCls} w-[110px]`} value={value?.unit ?? "Days"} onChange={(e) => onChange({ ...value, unit: e.target.value, n: value?.n ?? "" })}>
            {DURATION_UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
          <span className="text-[12px] text-[color:var(--ink-soft)]">since symptom started</span>
        </div>
      )}
      {q.kind === "text" && <input className={`${inputCls} w-full`} value={value?.text ?? ""} onChange={(e) => onChange({ text: e.target.value })} />}
    </div>
  );
}

export function ChiefComplaintBuilder({ onAdd }: { onAdd: (text: string) => void }) {
  const { items } = useList<SetupRecordDTO>("/setup/chief_complaint", { active: 1 });
  const complaints = useMemo(() => items.map(toComplaint), [items]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const term = q.trim().toLowerCase();
  const matches = complaints.filter((c) => !term || c.name.toLowerCase().includes(term)).slice(0, 8);
  const common = complaints.filter((c) => c.common);
  const pick = (t: ComplaintTemplate) => { setEntries((e) => (e.some((x) => x.t.id === t.id) ? e : [...e, { key: entryKey++, t, a: {}, more: "", showMore: false }])); setQ(""); setOpen(false); };
  const patch = (key: number, p: Partial<Entry>) => setEntries((e) => e.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const sentences = entries.map((e) => sentenceOf(e.t, e.a, e.more));
  const preview = sentences.join(" ");

  if (complaints.length === 0) return <p className="text-[12px] text-[color:var(--ink-soft)]">No complaint templates yet. Add them in Masters → Chief complaints, or type the complaint below.</p>;

  return (
    <div className="flex flex-col gap-3">
      <div ref={box} className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
        <input ref={search} value={q} placeholder="Search a complaint: fever, cough, headache…" onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) { e.preventDefault(); pick(matches[0]); } if (e.key === "Escape") setOpen(false); }}
          className="h-[40px] w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] pl-[34px] pr-3 text-[13px] focus:border-[color:var(--brand)] focus:outline-none" />
        {open && (
          <div className="absolute left-0 right-0 top-[44px] z-20 max-h-[260px] overflow-auto rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] shadow-lg">
            {matches.map((c) => <button key={c.id} type="button" onClick={() => pick(c)} className="block w-full cursor-pointer border-b border-[color:var(--subtle-2)] px-3 py-2 text-left text-[13px] hover:bg-[color:var(--subtle)]">{c.name}</button>)}
            {matches.length === 0 && <p className="px-3 py-3 text-[12px] text-[color:var(--ink-soft)]">No complaint matches. Type it in the notes below, or add it in Masters.</p>}
          </div>
        )}
      </div>
      {common.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-[color:var(--ink-soft)]">Common:</span>
          {common.map((c) => {
            const on = entries.some((x) => x.t.id === c.id);
            return <button key={c.id} type="button" onClick={() => pick(c)} aria-pressed={on} className={`cursor-pointer rounded-full border px-3 py-[4px] text-[12px] ${on ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)] font-medium text-[color:var(--brand)]" : "border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>{c.name}</button>;
          })}
        </div>
      )}

      {entries.map((en) => {
        const questions = en.t.questions;
        return (
          <div key={en.key} className="overflow-hidden rounded-[10px] border border-[color:var(--line)]">
            <div className="flex items-center gap-2 bg-[color:var(--brand-soft)] px-4 py-3">
              <p className="text-[14px] font-semibold text-[color:var(--ink)]">{en.t.name}</p>
              <span className="rounded-full bg-[#dffff3] px-2 py-[1px] text-[11px] text-[#0b7a47]">Selected</span>
              <button type="button" aria-label={`Remove ${en.t.name}`} onClick={() => setEntries((e) => e.filter((x) => x.key !== en.key))} className="ml-auto cursor-pointer text-[color:var(--ink-soft)] hover:text-[#c8001a]"><X size={16} /></button>
            </div>
            <div className="flex flex-col gap-4 px-4 py-4">
              {questions.map((qq, i) => <Question key={qq.id} q={qq} n={i + 1} value={en.a[qq.id]} onChange={(v) => setEntries((all) => all.map((x) => (x.key === en.key ? { ...x, a: { ...x.a, [qq.id]: v } } : x)))} />)}
              <div className="border-t border-dashed border-[color:var(--line)] pt-3">
                {en.showMore
                  ? <input className={`${inputCls} w-full`} autoFocus value={en.more} placeholder="Anything else, e.g. temperature 101 F, after exposure to rain" onChange={(e) => patch(en.key, { more: e.target.value })} />
                  : <button type="button" onClick={() => patch(en.key, { showMore: true })} className="cursor-pointer text-[12px] font-medium text-[color:var(--brand)] hover:underline">+ Add more details</button>}
              </div>
            </div>
          </div>
        );
      })}

      {entries.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => { setOpen(true); search.current?.focus(); }} className="inline-flex cursor-pointer items-center gap-1 rounded-[8px] border border-dashed border-[color:var(--brand)] px-3 py-[6px] text-[12px] font-medium text-[color:var(--brand)] hover:bg-[color:var(--brand-soft)]"><Plus size={13} /> Add another complaint</button>
          <span className="text-[11px] text-[color:var(--ink-soft)]">All changes show in the preview.</span>
        </div>
      )}
      {entries.length > 0 && (
        <div className="rounded-[10px] bg-[color:var(--subtle)] px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">Complaint preview</p>
          <p className="mt-1 text-[14px] font-medium leading-[21px] text-[color:var(--ink)]">{preview}</p>
          <button type="button" onClick={() => { onAdd(preview); setEntries([]); }} className="mt-3 inline-flex h-[36px] cursor-pointer items-center rounded-[8px] bg-[color:var(--brand)] px-4 text-[13px] font-medium text-white hover:bg-[color:var(--brand-hover)]">Add to clinical notes →</button>
        </div>
      )}
    </div>
  );
}
