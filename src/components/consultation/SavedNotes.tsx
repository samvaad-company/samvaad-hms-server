"use client";

/**
 * Words a doctor keeps to use again.
 *  - SavedRemarks: the doctor's own remarks. Type one, press Save, and next time search for it and pick it from the list.
 *  - SavedAdvice: diet, exercise and other advice, saved for the patient so it is there to pick at their next visit.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Star, X } from "lucide-react";
import { api } from "@/lib/api/client";
import type { SavedNoteDTO } from "@/types/api";
import type { Consultation } from "@/types/consultation";

const searchCls = "h-[36px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] pl-[34px] pr-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors";
const areaCls = "w-full resize-y bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 py-2 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors";
const saveCls = "inline-flex h-[32px] cursor-pointer items-center rounded-full bg-[color:var(--brand)] px-4 text-[12px] font-medium text-white hover:bg-[color:var(--brand-hover)] disabled:cursor-default disabled:opacity-50";

/** The saved list for a search, and a way to refresh it after adding or removing. */
function useNotes(kind: "remark" | "advice", ownerOk: boolean, params: Record<string, string>, q: string) {
  const [items, setItems] = useState<SavedNoteDTO[]>([]);
  const [tick, setTick] = useState(0);
  const sig = JSON.stringify(params);
  useEffect(() => {
    if (!ownerOk) { setItems([]); return; }
    let dead = false;
    const t = setTimeout(() => {
      api.get<SavedNoteDTO[]>("/saved-notes", { kind, ...JSON.parse(sig), q: q.trim(), limit: 8 }).then((r) => { if (!dead) setItems(r); }).catch(() => { if (!dead) setItems([]); });
    }, 150);
    return () => { dead = true; clearTimeout(t); };
  }, [kind, ownerOk, sig, q, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { items, reload };
}

function useOutsideClose(onClose: () => void) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [onClose]);
  return box;
}

function Dropdown({ title, items, onPick, onRemove }: { title: string; items: SavedNoteDTO[]; onPick: (n: SavedNoteDTO) => void; onRemove: (n: SavedNoteDTO) => void }) {
  return (
    <div className="absolute left-0 right-0 top-[40px] z-20 max-h-[280px] overflow-auto rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] shadow-lg">
      <p className="px-3 pt-2 text-[10px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">{title}</p>
      {items.map((n) => (
        <div key={n.id} className="flex items-center gap-2 border-b border-[color:var(--subtle-2)] px-3 py-2 text-[12px] last:border-0 hover:bg-[color:var(--subtle)]">
          <button type="button" onClick={() => onPick(n)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left">
            <Star size={12} className="shrink-0 text-[#d99a00]" />
            <span className="min-w-0 flex-1 truncate text-[color:var(--ink)]">{n.text}</span>
            {n.useCount > 0 && <span className="shrink-0 text-[11px] text-[color:var(--ink-soft)]">used {n.useCount}×</span>}
          </button>
          <button type="button" aria-label="Remove from saved" onClick={() => onRemove(n)} className="cursor-pointer text-[color:var(--ink-soft)] hover:text-[#b3001b]"><X size={13} /></button>
        </div>
      ))}
    </div>
  );
}

export function SavedRemarks({ doctorId, value, onChange }: { doctorId: string; value: string; onChange: (next: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const box = useOutsideClose(close);
  const { items, reload } = useNotes("remark", !!doctorId, { doctorId }, q);

  const fill = (n: SavedNoteDTO) => {
    const cur = value.trim();
    onChange(cur ? `${cur}\n${n.text}` : n.text);
    void api.post("/saved-notes", { kind: "remark", text: n.text, doctorId: Number(doctorId), used: true }).then(reload).catch(() => null);
    setQ(""); setOpen(false); setNote(null);
  };
  async function save() {
    const lines = value.split("\n").map((l) => l.trim()).filter((l) => l.length >= 2);
    if (!doctorId || !lines.length) return;
    setSaving(true); setNote(null);
    try {
      for (const l of lines) await api.post("/saved-notes", { kind: "remark", text: l, doctorId: Number(doctorId) });
      setNote({ ok: true, text: `Saved ${lines.length === 1 ? "the remark" : `${lines.length} remarks`}. Search for ${lines.length === 1 ? "it" : "them"} next time.` });
      reload();
    } catch (e) { setNote({ ok: false, text: (e as Error).message || "That could not be saved." }); }
    finally { setSaving(false); }
  }
  async function remove(n: SavedNoteDTO) { await api.del(`/saved-notes/${n.id}`).catch(() => null); reload(); }

  return (
    <div ref={box} className="flex flex-col gap-2">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
        <input placeholder="Search your saved remarks…" value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} className={searchCls} />
        {open && items.length > 0 && <Dropdown title={q.trim() ? "Your saved remarks" : "Your most used"} items={items} onPick={fill} onRemove={(n) => void remove(n)} />}
      </div>
      <textarea rows={3} value={value} onChange={(e) => { onChange(e.target.value); setNote(null); }} className={areaCls}
        placeholder="Remarks for this prescription, e.g. Avoid cold drinks. Review if fever persists beyond 3 days." />
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[color:var(--ink-soft)]">
        <button type="button" disabled={saving || !doctorId || !value.trim()} onClick={() => void save()} className={saveCls}>{saving ? "Saving…" : "Save remark"}</button>
        {note ? <span className={note.ok ? "text-[#0b7a47]" : "text-[#b3001b]"}>{note.text}</span>
          : !doctorId ? <span>Choose the doctor to search and save remarks.</span>
          : <span>One remark per line. Saved remarks are yours: search them next time and pick one.</span>}
      </div>
    </div>
  );
}

const LABELS = { diet: "Diet", exercise: "Exercise", other: "Other" } as const;
type AdviceKey = keyof typeof LABELS;

/** Search and Save for the advice fields: what is saved is kept for this patient. */
export function SavedAdvice({ doctorId, patientId, advice, onChange }: { doctorId: string; patientId: string; advice: Consultation["advice"]; onChange: (next: Consultation["advice"]) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const box = useOutsideClose(close);
  const { items, reload } = useNotes("advice", !!patientId, { patientId }, q);

  const pick = (n: SavedNoteDTO) => {
    const m = /^(Diet|Exercise|Other):\s*([\s\S]*)$/.exec(n.text);
    const key = (m ? m[1].toLowerCase() : "other") as AdviceKey;
    const text = m ? m[2] : n.text;
    const cur = advice[key].trim();
    onChange({ ...advice, [key]: cur && !cur.includes(text) ? `${cur}; ${text}` : cur || text });
    void api.post("/saved-notes", { kind: "advice", text: n.text, patientId: Number(patientId), used: true }).then(reload).catch(() => null);
    setQ(""); setOpen(false); setNote(null);
  };
  async function save() {
    const lines = (Object.keys(LABELS) as AdviceKey[]).filter((k) => advice[k].trim()).map((k) => `${LABELS[k]}: ${advice[k].trim()}`);
    if (!patientId || !lines.length) return;
    setSaving(true); setNote(null);
    try {
      for (const l of lines) await api.post("/saved-notes", { kind: "advice", text: l, patientId: Number(patientId), doctorId: doctorId ? Number(doctorId) : undefined });
      setNote({ ok: true, text: "Saved for this patient. It is in the search list at their next visit." });
      reload();
    } catch (e) { setNote({ ok: false, text: (e as Error).message || "That could not be saved." }); }
    finally { setSaving(false); }
  }
  async function remove(n: SavedNoteDTO) { await api.del(`/saved-notes/${n.id}`).catch(() => null); reload(); }

  return (
    <div ref={box} className="flex flex-col gap-2">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
        <input placeholder={patientId ? "Search advice saved for this patient…" : "Choose the patient to search their saved advice"} disabled={!patientId} value={q}
          onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} className={`${searchCls} disabled:opacity-60`} />
        {open && items.length > 0 && <Dropdown title="Saved for this patient" items={items} onPick={pick} onRemove={(n) => void remove(n)} />}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[color:var(--ink-soft)]">
        <button type="button" disabled={saving || !patientId || !(Object.values(advice) as string[]).some((t) => t.trim())} onClick={() => void save()} className={saveCls}>{saving ? "Saving…" : "Save for patient"}</button>
        {note ? <span className={note.ok ? "text-[#0b7a47]" : "text-[#b3001b]"}>{note.text}</span>
          : !patientId ? <span>Choose the patient to save advice to their record.</span>
          : <span>Saves the advice written below to this patient.</span>}
      </div>
    </div>
  );
}
