"use client";

/**
 * The Setup UI kit: a switch, a data-driven form dialog (almost every master's add/edit form is one of these), and the small
 * pieces the master screens share.
 */
import { useState, type ReactNode } from "react";
import { Pencil, Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import { COLOUR_CHOICES, type ConfigKey, type SetupKind, type SetupRecordDTO } from "@/types/setup";
import { attempt, cancelBtn, ErrorNote, fieldLabel, outlineBtn, primaryBtn } from "@/components/mrd/shared";

export type Rec = SetupRecordDTO;

/** A master's records, newest changes included. */
export function useSetup(kind: SetupKind, active?: boolean) {
  return useList<SetupRecordDTO>(`/setup/${kind}`, active ? { active: 1 } : undefined);
}

/** One of the hospital's configuration blobs (hospital setup, billing, notifications…). */
export function useConfig(key: ConfigKey) {
  return useItem<Record<string, unknown>>(`/setup/config/${key}`);
}

export const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
export const num = (v: unknown): number => (v === null || v === undefined || v === "" ? 0 : Number(v));

// ── Switch ───────────────────────────────────────────────────────────────────

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange?.(!checked)}
      className={`relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-[color:var(--brand)]" : "bg-[color:var(--line)]"}`}>
      <span className={`absolute top-[3px] h-[16px] w-[16px] rounded-full bg-white shadow transition-all ${checked ? "left-[21px]" : "left-[3px]"}`} />
    </button>
  );
}

/** A bordered row with a label on the left and a switch on the right (the "Active" row of every form). */
export function ToggleRow({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[8px] border border-[color:var(--line)] px-[14px] py-[10px]">
      <div className="min-w-0"><p className="text-[14px] text-[color:var(--ink)]">{label}</p>{hint && <p className="text-[12px] text-[color:var(--ink-soft)]">{hint}</p>}</div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export const textarea = "w-full resize-y rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] px-[14px] py-[10px] text-[14px] leading-[22px] focus:border-[color:var(--brand)] focus:bg-[color:var(--surface)] focus:outline-none";

export function Labelled({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-2"><span className={fieldLabel}>{label}</span>{children}{hint && <p className="text-[12px] text-[color:var(--ink-soft)]">{hint}</p>}</div>;
}

export function ColourPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {COLOUR_CHOICES.map((c) => (
        <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={value === c} onClick={() => onChange(c)}
          className={`h-[26px] w-[26px] rounded-full border-2 cursor-pointer ${value === c ? "border-[color:var(--ink)]" : "border-transparent"}`} style={{ background: c }} />
      ))}
      <input type="color" aria-label="Custom colour" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#22c55e"} onChange={(e) => onChange(e.target.value)} className="h-[26px] w-[34px] cursor-pointer rounded border border-[color:var(--line)] bg-transparent p-0" />
    </div>
  );
}

export function Dot({ colour }: { colour?: string }) {
  return <span className="inline-block h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: colour || "#94a3b8" }} />;
}

// ── Form dialog ──────────────────────────────────────────────────────────────

export type FieldType = "text" | "textarea" | "number" | "select" | "toggle" | "date" | "time" | "colour" | "month";
export interface FieldSpec {
  key: string;
  label: string;
  type?: FieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Relative width within its row. */
  w?: number;
  mono?: boolean;
  hint?: string;
  /** Hide the field until another one has this value. */
  showIf?: (v: Record<string, unknown>) => boolean;
  rows?: number;
  min?: string;
  upper?: boolean;
}

export interface FormDialogProps {
  title: string;
  subtitle?: string;
  /** Fields, laid out one array per row. */
  rows: FieldSpec[][];
  initial?: Record<string, unknown>;
  /** Where to save: `${endpoint}` to create, `${endpoint}/${id}` to update. */
  endpoint: string;
  id?: number;
  submitLabel: string;
  width?: number;
  onClose: () => void;
  onSaved?: (saved: unknown) => void;
  /** Change the values just before they are sent. */
  prepare?: (values: Record<string, unknown>) => Record<string, unknown>;
  /** Shows a Delete button when set (editing only). */
  deleteLabel?: string;
  /** Anything extra under the fields. */
  footerNote?: ReactNode;
  children?: (values: Record<string, unknown>, set: (k: string, v: unknown) => void) => ReactNode;
  disabled?: (values: Record<string, unknown>) => boolean;
  method?: "patch" | "put";
}

export function FormDialog({ title, subtitle, rows, initial = {}, endpoint, id, submitLabel, width = 460, onClose, onSaved, prepare, deleteLabel, children, disabled, method = "patch" }: FormDialogProps) {
  const { run, loading, error, reset } = useMutation();
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {};
    for (const f of rows.flat()) v[f.key] = initial[f.key] ?? (f.type === "toggle" ? (f.key === "active" ? true : false) : "");
    return v;
  });
  const [confirming, setConfirming] = useState(false);
  const set = (k: string, v: unknown) => setValues((p) => ({ ...p, [k]: v }));
  const close = () => { reset(); onClose(); };

  async function save() {
    reset();
    const body: Record<string, unknown> = {};
    for (const f of rows.flat()) {
      if (f.showIf && !f.showIf(values)) continue;
      const raw = values[f.key];
      body[f.key] = typeof raw === "string" ? (f.upper ? raw.trim().toUpperCase() : raw.trim()) : raw;
    }
    const payload = prepare ? prepare(body) : body;
    let saved: unknown;
    const ok = await attempt(run(async () => { saved = id ? await (method === "put" ? api.put(`${endpoint}/${id}`, payload) : api.patch(`${endpoint}/${id}`, payload)) : await api.post(endpoint, payload); }));
    if (ok) { onSaved?.(saved); close(); }
  }
  async function remove() {
    reset();
    if (await attempt(run(() => api.del(`${endpoint}/${id}`)))) { setConfirming(false); onSaved?.(null); close(); } else setConfirming(false);
  }

  return (
    <>
      <Modal open onClose={close} width={width} title={title} subtitle={subtitle}
        footer={(
          <>
            {id && deleteLabel && <button onClick={() => setConfirming(true)} className="mr-auto h-[36px] rounded-[8px] px-3 text-[13px] font-medium text-[#c8001a] hover:bg-[#ffe9e9] cursor-pointer">{deleteLabel}</button>}
            <button onClick={close} className={cancelBtn}>Cancel</button>
            <button onClick={save} disabled={loading || (disabled?.(values) ?? false)} className={primaryBtn}>{loading ? "Saving…" : submitLabel}</button>
          </>
        )}>
        <div className="flex flex-col gap-4">
          {rows.map((row, i) => {
            const visible = row.filter((f) => !f.showIf || f.showIf(values));
            if (visible.length === 0) return null;
            return (
              <div key={i} className="grid gap-3" style={{ gridTemplateColumns: visible.map((f) => `minmax(0, ${f.w ?? 1}fr)`).join(" ") }}>
                {visible.map((f) => <FieldControl key={f.key} f={f} value={values[f.key]} set={set} />)}
              </div>
            );
          })}
          {children?.(values, set)}
          <ErrorNote message={error?.message} />
        </div>
      </Modal>
      <ConfirmDialog open={confirming} title={deleteLabel} message="This can't be undone." confirmLabel="Delete" danger loading={loading} onConfirm={remove} onCancel={() => setConfirming(false)} />
    </>
  );
}

export function FieldControl({ f, value, set }: { f: FieldSpec; value: unknown; set: (k: string, v: unknown) => void }) {
  const type = f.type ?? "text";
  if (type === "toggle") return <ToggleRow label={f.label} checked={value === true} onChange={(v) => set(f.key, v)} hint={f.hint} />;
  const body = (() => {
    switch (type) {
      case "textarea": return <textarea rows={f.rows ?? 3} value={str(value)} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} className={textarea} />;
      case "select": return <FormSelect value={str(value)} onChange={(v) => set(f.key, v)} options={f.options ?? []} />;
      case "colour": return <ColourPicker value={str(value)} onChange={(v) => set(f.key, v)} />;
      case "number": return <FormInput type="number" min={f.min ?? "0"} value={str(value)} placeholder={f.placeholder} onChange={(v) => set(f.key, v)} />;
      case "date": return <FormInput type="date" value={str(value)} onChange={(v) => set(f.key, v)} />;
      case "time": return <FormInput type="time" value={str(value)} onChange={(v) => set(f.key, v)} />;
      case "month": return <FormInput type="month" value={str(value)} onChange={(v) => set(f.key, v)} />;
      default: return <FormInput value={str(value)} placeholder={f.placeholder} onChange={(v) => set(f.key, f.upper ? v.toUpperCase() : v)} />;
    }
  })();
  return <Labelled label={f.label} hint={f.hint}>{f.mono ? <div className="font-mono">{body}</div> : body}</Labelled>;
}

// ── List pieces ──────────────────────────────────────────────────────────────

/** "Payer classes 3" on the left, the add button on the right. */
export function ListHeader({ title, count, children, note }: { title: string; count?: number; children?: ReactNode; note?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 pb-3">
      <div className="min-w-0">
        <p className="text-[13px] text-[color:var(--ink-soft)]">{title}{count !== undefined && <span className="ml-2 font-medium text-[color:var(--ink)]">{count}</span>}</p>
        {note && <p className="text-[12px] text-[color:var(--ink-soft)]">{note}</p>}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function AddButton({ label, onClick, primary = false }: { label: string; onClick: () => void; primary?: boolean }) {
  return <button onClick={onClick} className={(primary ? primaryBtn : outlineBtn) + " !h-[34px]"}><Plus size={14} /> {label}</button>;
}

export function EditIcon({ onClick, label }: { onClick: () => void; label: string }) {
  return <button onClick={onClick} aria-label={label} className="rounded-[6px] p-[6px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)] cursor-pointer"><Pencil size={14} /></button>;
}

/** The bordered box all the plain lists sit in. */
export function ListBox({ children, empty }: { children: ReactNode; empty?: ReactNode }) {
  return <div className="overflow-hidden rounded-[10px] border border-[color:var(--line)]">{empty ?? children}</div>;
}

export function Row({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return <div onClick={onClick} className={`flex items-center gap-3 border-b border-[color:var(--line)] px-4 py-[10px] last:border-b-0 hover:bg-[color:var(--faint)] ${onClick ? "cursor-pointer" : ""}`}>{children}</div>;
}

export const Code = ({ children }: { children: ReactNode }) => <span className="shrink-0 font-mono text-[12px] text-[color:var(--ink-soft)]">{children}</span>;

export function Muted({ children }: { children: ReactNode }) {
  return <span className="text-[12px] text-[color:var(--ink-soft)]">{children}</span>;
}

/** "Not active" tag for a switched-off record. */
export function Inactive() {
  return <span className="rounded-full border border-[color:var(--line)] bg-[color:var(--subtle)] px-2 py-[1px] text-[11px] text-[color:var(--ink-soft)]">Inactive</span>;
}

export const dateRange = (from: unknown, to: unknown): string => (from ? `${str(from)} → ${to ? str(to) : ""}`.trim() : "");

export function csvEscape(v: unknown): string {
  const s = str(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A small CSV reader (quoted fields, commas, newlines). Returns rows of cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((x) => x.trim() !== "")) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}
