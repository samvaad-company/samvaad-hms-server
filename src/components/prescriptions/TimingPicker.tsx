"use client";

/**
 * The "When" choice on a medicine row: the usual four (before, after, with a meal, empty stomach), any wording the doctor saved earlier,
 * and "Other…" which opens a box to type new wording and a Save button that keeps it for that doctor, so it is in the list next time.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { api } from "@/lib/api/client";
import { TIMINGS } from "@/lib/prescriptions/remarks";
import type { SavedNoteDTO } from "@/types/api";

const OTHER = "__other";
const selectCls = "h-[36px] w-full appearance-none pr-7 bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-2 text-[12px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors";

export function TimingPicker({ value, doctorId, onChange }: { value: string; doctorId: string; onChange: (v: string) => void }) {
  const [saved, setSaved] = useState<SavedNoteDTO[]>([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!doctorId) { setSaved([]); return; }
    api.get<SavedNoteDTO[]>("/saved-notes", { kind: "timing", doctorId, limit: 50 }).then(setSaved).catch(() => setSaved([]));
  }, [doctorId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const own = saved.map((n) => n.text).filter((t) => !TIMINGS.includes(t));
  const extra = value && !TIMINGS.includes(value) && !own.includes(value) ? [value] : [];

  function pick(v: string) {
    if (v === OTHER) { setText(""); setErr(""); setOpen(true); return; }
    setOpen(false);
    onChange(v);
    if (own.includes(v) && doctorId) void api.post("/saved-notes", { kind: "timing", text: v, doctorId: Number(doctorId), used: true }).then(load).catch(() => null);
  }
  async function save(keep: boolean) {
    const t = text.trim().replace(/\s+/g, " ");
    if (t.length < 2) { setErr("Type when to take it, for example 30 minutes before food."); return; }
    setBusy(true); setErr("");
    try {
      if (keep && doctorId) { await api.post("/saved-notes", { kind: "timing", text: t, doctorId: Number(doctorId) }); load(); }
      onChange(t);
      setOpen(false);
    } catch (e) { setErr((e as Error).message || "That could not be saved."); }
    finally { setBusy(false); }
  }

  return (
    <div ref={box} className="relative">
      <select aria-label="When" value={value} onChange={(e) => pick(e.target.value)} className={selectCls}>
        {TIMINGS.map((t) => <option key={t} value={t}>{t || "Any time"}</option>)}
        {[...own, ...extra].map((t) => <option key={t} value={t}>{t}</option>)}
        <option value={OTHER}>Other…</option>
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2 top-[11px] text-[color:var(--ink-soft)]" />
      {open && (
        <div className="absolute left-0 top-[40px] z-30 w-[260px] rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] p-3 shadow-lg">
          <p className="mb-1 text-[11px] text-[color:var(--ink-soft)]">When should it be taken?</p>
          <input autoFocus value={text} maxLength={40} placeholder="e.g. 30 minutes before food"
            onChange={(e) => { setText(e.target.value); setErr(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void save(!!doctorId); } if (e.key === "Escape") setOpen(false); }}
            className="h-[34px] w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] px-2 text-[12px] focus:border-[color:var(--brand)] focus:outline-none" />
          {err && <p className="mt-1 text-[11px] text-[#b3001b]">{err}</p>}
          <div className="mt-2 flex items-center gap-2">
            <button type="button" disabled={busy || !doctorId} onClick={() => void save(true)} className="h-[30px] cursor-pointer rounded-full bg-[color:var(--brand)] px-4 text-[12px] font-medium text-white hover:bg-[color:var(--brand-hover)] disabled:cursor-default disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
            <button type="button" disabled={busy} onClick={() => void save(false)} className="h-[30px] cursor-pointer rounded-full border border-[color:var(--line)] px-3 text-[12px] hover:bg-[color:var(--subtle)]">Use once</button>
            <button type="button" onClick={() => setOpen(false)} className="ml-auto cursor-pointer text-[12px] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]">Cancel</button>
          </div>
          <p className="mt-2 text-[11px] text-[color:var(--ink-soft)]">{doctorId ? "Save keeps it in your list for next time." : "Choose the doctor to save it for later."}</p>
        </div>
      )}
    </div>
  );
}
