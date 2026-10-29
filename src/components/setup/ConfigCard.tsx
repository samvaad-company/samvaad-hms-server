"use client";

/**
 * A card of read-only values with an Edit button that turns the same fields into inputs (Cancel / Save). Used for the
 * hospital's identity, financial year, registrations, billing and policies — all stored as configuration blobs.
 */
import { useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { dmy, ErrorNote, outlineBtn, primaryBtn } from "@/components/mrd/shared";
import { attempt } from "@/components/hr/shared";
import type { ConfigKey } from "@/types/setup";
import { FieldControl, str, type FieldSpec } from "@/components/setup/ui";

interface Props {
  title: string;
  configKey: ConfigKey;
  /** Rows of fields; each row is laid out as equal columns (or by `w`). */
  rows: FieldSpec[][];
  values: Record<string, unknown>;
  canEdit: boolean;
  onSaved: () => void;
  /** A line shown under the values (e.g. "Heads every blood bank register."). */
  note?: ReactNode;
  /** Field keys shown as On/Off chips (toggles) in a strip at the bottom. */
  chips?: FieldSpec[];
  /** Turn a stored value into display text (selects show their label, dates read as 29 Oct 2026). */
  className?: string;
}

function show(f: FieldSpec, v: unknown): string {
  if (v === null || v === undefined || v === "") return "Not set";
  if (f.type === "select") return f.options?.find((o) => o.value === String(v))?.label ?? String(v);
  if (f.type === "date") return dmy(String(v));
  if (f.type === "number") return String(v);
  return String(v);
}

export function ConfigCard({ title, configKey, rows, values, canEdit, onSaved, note, chips = [], className = "" }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const { run, loading, error, reset } = useMutation();
  const all = [...rows.flat(), ...chips];

  function start() { reset(); setDraft(Object.fromEntries(all.map((f) => [f.key, values[f.key] ?? (f.type === "toggle" ? false : "")]))); setEditing(true); }
  async function save() {
    reset();
    const patch: Record<string, unknown> = {};
    for (const f of all) {
      const before = values[f.key] ?? (f.type === "toggle" ? false : "");
      let after = draft[f.key];
      if (typeof after === "string") after = after.trim();
      if (f.type === "number") after = after === "" ? 0 : Number(after);
      if (after !== before) patch[f.key] = after;
    }
    if (Object.keys(patch).length === 0) { setEditing(false); return; }
    if (await attempt(run(() => api.put(`/setup/config/${configKey}`, patch)))) { setEditing(false); onSaved(); }
  }

  return (
    <section className={`rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5 ${className}`}>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-[14px] font-semibold text-[color:var(--ink)]">{title}</h2>
        {canEdit && !editing && <button onClick={start} className={outlineBtn + " ml-auto !h-[30px]"}><Pencil size={13} /> Edit</button>}
        {editing && (
          <span className="ml-auto flex gap-2">
            <button onClick={() => setEditing(false)} className={outlineBtn + " !h-[30px]"}>Cancel</button>
            <button onClick={save} disabled={loading} className={primaryBtn + " !h-[30px]"}>{loading ? "Saving…" : "Save"}</button>
          </span>
        )}
      </div>
      <div className="flex flex-col gap-4">
        {rows.map((row, i) => (
          <div key={i} className="grid gap-x-4 gap-y-3" style={{ gridTemplateColumns: row.map((f) => `minmax(0, ${f.w ?? 1}fr)`).join(" ") }}>
            {row.map((f) => editing
              ? <FieldControl key={f.key} f={f} value={draft[f.key]} set={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} />
              : (
                <div key={f.key} className="min-w-0">
                  <p className="text-[13px] text-[color:var(--ink-soft)]">{f.label}</p>
                  <p className={`mt-[2px] break-words text-[14px] ${str(values[f.key]) === "" ? "text-[color:var(--ink-soft)]" : f.mono ? "font-mono text-[13px] text-[color:var(--ink)]" : "text-[color:var(--ink)]"}`}>{f.type === "toggle" ? (values[f.key] === true ? "On" : "Off") : show(f, values[f.key])}</p>
                </div>
              ))}
          </div>
        ))}
        {note && <p className="text-[12px] text-[color:var(--ink-soft)]">{note}</p>}
        {chips.length > 0 && (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(chips.length, 4)}, minmax(0, 1fr))` }}>
            {chips.map((f) => editing
              ? <FieldControl key={f.key} f={f} value={draft[f.key]} set={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} />
              : <div key={f.key} className="flex items-center justify-between gap-2 rounded-[8px] border border-[color:var(--line)] px-3 py-[8px] text-[13px]"><span>{f.label}</span><span className={values[f.key] === true ? "font-medium" : "text-[color:var(--ink-soft)]"}>{values[f.key] === true ? "On" : "Off"}</span></div>)}
          </div>
        )}
        <ErrorNote message={error?.message} />
      </div>
    </section>
  );
}
