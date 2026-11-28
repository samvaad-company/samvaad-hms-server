"use client";

/**
 * A diagnosis written in a text box. The doctor types it, or searches their earlier diagnoses (then ICD-10) and picks one: it is put
 * in the box, where it can be edited for the new patient. Each line (or text between ";") is one diagnosis; the ones written are kept in
 * the doctor's own list and the patient's record when the prescription is saved, and the Save button keeps them straight away.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Star } from "lucide-react";
import { api } from "@/lib/api/client";
import { icd10Codes } from "@/data/icd10";
import type { DoctorDiagnosisDTO } from "@/types/api";

const searchCls = "h-[36px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] pl-[34px] pr-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors";
const areaCls = "w-full resize-y bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 py-2 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors";

const textOf = (d: { name: string; code?: string }) => (d.code ? `${d.name} (${d.code})` : d.name);

export function DiagnosisPicker({ doctorId, patientId, kind, value, onChange, placeholder, textPlaceholder, rows = 3 }: {
  /** The doctor whose list is searched; empty until one is chosen. */
  doctorId: string;
  /** The patient the diagnosis is for; empty until one is chosen. */
  patientId: string;
  kind: "Primary" | "Secondary";
  value: string;
  onChange: (next: string) => void;
  /** For the search box. */
  placeholder: string;
  /** For the text box. */
  textPlaceholder: string;
  rows?: number;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<DoctorDiagnosisDTO[]>([]);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!doctorId) { setMine([]); return; }
    let dead = false;
    const t = setTimeout(() => {
      api.get<DoctorDiagnosisDTO[]>("/diagnoses", { doctorId, q: q.trim(), limit: 8 }).then((r) => { if (!dead) setMine(r); }).catch(() => { if (!dead) setMine([]); });
    }, 150);
    return () => { dead = true; clearTimeout(t); };
  }, [doctorId, q]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const term = q.trim();
  const icd = useMemo(() => {
    const t = term.toLowerCase();
    if (t.length < 2) return [];
    return icd10Codes.filter((c) => c.description.toLowerCase().includes(t) || c.code.toLowerCase().includes(t)).slice(0, 6);
  }, [term]);

  /** Puts a picked diagnosis in the text box: on its own line after what is already there. */
  const fill = (text: string) => {
    const cur = value.trim();
    onChange(cur ? `${cur}\n${text}` : text);
    setQ(""); setOpen(false); setNote(null);
  };

  const lines = value.split(/[\n;]+/).map((x) => x.trim()).filter((x) => x.length >= 2);
  /** Keeps what is written in the patient's diagnoses (when a patient is chosen) and in the doctor's own list. */
  async function save() {
    if (!doctorId || !lines.length) return;
    setSaving(true); setNote(null);
    try {
      if (patientId) await api.post(`/patients/${patientId}/diagnoses`, { names: lines, kind, doctorId: Number(doctorId) });
      else for (const l of lines) await api.post("/diagnoses", { name: l, doctorId: Number(doctorId) });
      setNote({ ok: true, text: patientId ? "Saved to the patient's diagnoses and your list." : "Saved to your list. Choose the patient to save it to their record too." });
    } catch (e) { setNote({ ok: false, text: (e as Error).message || "That could not be saved." }); }
    finally { setSaving(false); }
  }

  return (
    <div ref={box} className="flex flex-col gap-2">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
        <input
          placeholder={placeholder}
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          className={searchCls}
        />
        {open && (mine.length > 0 || icd.length > 0) && (
          <div className="absolute left-0 right-0 top-[40px] z-20 max-h-[300px] overflow-auto rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] shadow-lg">
            {mine.length > 0 && <p className="px-3 pt-2 text-[10px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">{term ? "Your diagnoses" : "Your most used"}</p>}
            {mine.map((m) => (
              <button key={m.id} type="button" onClick={() => fill(textOf(m))} className="flex w-full cursor-pointer items-center gap-2 border-b border-[color:var(--subtle-2)] px-3 py-2 text-left text-[12px] hover:bg-[color:var(--subtle)]">
                <Star size={12} className="shrink-0 text-[#d99a00]" />
                <span className="min-w-0 flex-1 truncate text-[color:var(--ink)]">{m.name}</span>
                {m.code && <span className="font-medium text-[color:var(--brand)]">{m.code}</span>}
                {m.useCount > 0 && <span className="text-[11px] text-[color:var(--ink-soft)]">used {m.useCount}×</span>}
              </button>
            ))}
            {icd.length > 0 && <p className="px-3 pt-2 text-[10px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">ICD-10</p>}
            {icd.map((c) => (
              <button key={c.code} type="button" onClick={() => fill(`${c.description} (${c.code})`)} className="flex w-full cursor-pointer items-center gap-2 border-b border-[color:var(--subtle-2)] px-3 py-2 text-left text-[12px] hover:bg-[color:var(--subtle)]">
                <span className="font-medium text-[color:var(--brand)]">{c.code}</span>
                <span className="min-w-0 flex-1 truncate text-[color:var(--ink-soft)]">{c.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <textarea rows={rows} value={value} onChange={(e) => { onChange(e.target.value); setNote(null); }} placeholder={textPlaceholder} className={areaCls} />
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[color:var(--ink-soft)]">
        <button type="button" disabled={saving || !doctorId || lines.length === 0} onClick={() => void save()}
          className="inline-flex h-[32px] cursor-pointer items-center rounded-full bg-[color:var(--brand)] px-4 text-[12px] font-medium text-white hover:bg-[color:var(--brand-hover)] disabled:cursor-default disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
        {note ? <span className={note.ok ? "text-[#0b7a47]" : "text-[#b3001b]"}>{note.text}</span>
          : !doctorId ? <span>Choose the doctor to search and save diagnoses.</span>
          : <span>Search above to fill the box, then edit it. One diagnosis per line.</span>}
      </div>
    </div>
  );
}
