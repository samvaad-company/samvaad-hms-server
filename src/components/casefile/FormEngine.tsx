"use client";

/**
 * Draws a case-file form from its description (lib/casefile/forms.ts), either as the editable sheet on screen or as the printed pages.
 * Both come from the same markup, so the sheet staff fill in is the sheet that prints and goes into the PDF.
 */
import { Fragment, type CSSProperties as _CSS, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import type { CaseFileDTO } from "@/types/casefile";
import { FORM_BY_KEY, type Block, type Col, type Field, type FormDef } from "@/lib/casefile/forms";
import { linkedDays, linkedGrid, linkedRows, type LinkedRow, type Row } from "@/lib/casefile/link";

export type Mode = "edit" | "print";
export type Unit = Record<string, unknown>;

/* ── the data of one form, by unit ─────────────────────────────────────────────────────────────────────────────────────── */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

export function hasContent(v: unknown): boolean {
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "number") return true;
  if (typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.some(hasContent);
  if (isObj(v)) return Object.values(v).some(hasContent);
  return false;
}

/** The unit (one day, one sheet, or the whole form) inside a form's saved data. */
export function unitData(def: FormDef, data: Record<string, unknown>, unit: string): Unit {
  if (def.scope === "date") return isObj(data.days) && isObj(data.days[unit]) ? (data.days[unit] as Unit) : {};
  if (def.scope === "sheet") return Array.isArray(data.sheets) && isObj(data.sheets[Number(unit)]) ? (data.sheets[Number(unit)] as Unit) : {};
  return data;
}

export function withUnit(def: FormDef, data: Record<string, unknown>, unit: string, next: Unit): Record<string, unknown> {
  if (def.scope === "date") return { ...data, days: { ...(isObj(data.days) ? data.days : {}), [unit]: next } };
  if (def.scope === "sheet") {
    const sheets = Array.isArray(data.sheets) ? [...data.sheets] : [];
    while (sheets.length <= Number(unit)) sheets.push({});
    sheets[Number(unit)] = next;
    return { ...data, sheets };
  }
  return next;
}

/** Days (or sheet numbers) a form has something for, in order. */
export function unitsOf(def: FormDef, data: Record<string, unknown>, file: CaseFileDTO | null): string[] {
  if (def.scope === "single") return ["_"];
  if (def.scope === "sheet") return Array.from({ length: Math.max(1, Array.isArray(data.sheets) ? data.sheets.length : 1) }, (_, i) => String(i));
  const days = new Set<string>(linkedDays(def.key, file?.linked));
  if (isObj(data.days)) for (const [d, v] of Object.entries(data.days)) if (hasContent(v)) days.add(d);
  return [...days].sort();
}

const asRows = (v: unknown): Row[] => (Array.isArray(v) ? v.map((r) => (isObj(r) ? Object.fromEntries(Object.entries(r).map(([k, x]) => [k, str(x)])) : {})) : []);
const tableRows = (b: Extract<Block, { t: "table" }>, U: Unit): Row[] => (U[b.k] === undefined && b.defaults ? b.defaults.map((r) => ({ ...r })) : asRows(U[b.k]));

/* ── small inputs that are a field on screen and plain text when printed ─────────────────────────────────────────────── */

interface Ctx { mode: Mode; file: CaseFileDTO | null; unit: string; U: Unit; set: (patch: Unit) => void; def: FormDef }

function Val({ ctx, value, onChange, type = "text", label, area }: { ctx: Ctx; value: string; onChange: (v: string) => void; type?: string; label: string; area?: boolean }) {
  if (ctx.mode === "print") return <span className="cf-val">{type === "date" ? fmtDate(value) : value}</span>;
  if (area) return <textarea className="cf-in cf-area" aria-label={label} value={value} rows={2} onChange={(e) => onChange(e.target.value)} />;
  return <input className="cf-in" aria-label={label} type={type === "number" ? "text" : type} inputMode={type === "number" ? "decimal" : undefined} value={value} onChange={(e) => onChange(e.target.value)} />;
}

function YesNo({ ctx, value, onChange, label }: { ctx: Ctx; value: string; onChange: (v: string) => void; label: string }) {
  if (ctx.mode === "print") return <span className="cf-val">{value === "Yes" ? "Yes / ✓" : value === "No" ? "No / ✓" : "Yes / No"}</span>;
  return (
    <span className="cf-yn" role="radiogroup" aria-label={label}>
      {["Yes", "No"].map((o) => <button key={o} type="button" role="radio" aria-checked={value === o} className={value === o ? "on" : ""} onClick={() => onChange(value === o ? "" : o)}>{o}</button>)}
    </span>
  );
}

function FieldInput({ f, ctx }: { f: Field; ctx: Ctx }) {
  const v = str(ctx.U[f.k]);
  const set = (x: string) => ctx.set({ ...ctx.U, [f.k]: x });
  if (f.type === "yesno") return <YesNo ctx={ctx} value={v} onChange={set} label={f.label} />;
  if (f.type === "check") {
    return ctx.mode === "print"
      ? <span className="cf-box">{v ? "✓" : ""}</span>
      : <input type="checkbox" className="cf-check" aria-label={f.label} checked={!!v} onChange={(e) => set(e.target.checked ? "1" : "")} />;
  }
  if (f.type === "choice") {
    return ctx.mode === "print" ? <span className="cf-val">{(f.options ?? []).map((o) => (o === v ? `(${o})` : o)).join("  /  ")}</span> : (
      <span className="cf-yn" role="radiogroup" aria-label={f.label}>{(f.options ?? []).map((o) => <button key={o} type="button" role="radio" aria-checked={v === o} className={v === o ? "on" : ""} onClick={() => set(v === o ? "" : o)}>{o}</button>)}</span>
    );
  }
  return <Val ctx={ctx} value={v} onChange={set} type={f.type ?? "text"} label={f.label} />;
}

/* ── the blocks ──────────────────────────────────────────────────────────────────────────────────────────────────────────── */

function Strip({ b, ctx }: { b: Extract<Block, { t: "patient" }>; ctx: Ctx }) {
  const f = ctx.file;
  if (!f) return null;
  const sheet = ctx.def.scope === "sheet" ? `Sheet ${Number(ctx.unit) + 1}` : "";
  const item: Record<string, [string, string]> = {
    name: ["Name of Patient :", f.patient.name], age: ["Age :", f.patient.age ? String(f.patient.age) : ""], sex: ["Sex :", f.patient.sex],
    ipd: ["IPD No. :", f.admission.ipdNo], uhid: ["UHID No. :", f.patient.uhid], bed: ["Room / Bed No. :", [f.admission.ward, f.admission.bed].filter(Boolean).join(" · ")],
    doctor: ["Consultant :", f.admission.doctor], diet: ["DIET :", f.admission.diet],
  };
  return (
    <div className="cf-strip">
      {b.items.map((k) => <div key={k} className={`cf-f ${k === "name" ? "wide" : k === "bed" ? "mid" : ""}`}><span className="l">{item[k][0]}</span><span className="v">{item[k][1]}</span></div>)}
      {ctx.def.scope === "date" && <div className="cf-f"><span className="l">Date :</span><span className="v">{fmtDate(ctx.unit)}</span></div>}
      {sheet && <div className="cf-f"><span className="l">{sheet}</span></div>}
    </div>
  );
}

export const fmtDate = (iso: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso);

function Cell({ col, row, ctx, onChange, linked }: { col: Col; row: Row; ctx: Ctx; onChange?: (patch: Row) => void; linked: boolean }) {
  const show = (x: string) => (ctx.mode === "print" && x === "○" ? "" : x);
  if (col.stack) {
    return (
      <div className="cf-stack">
        {col.stack.map((s) => (
          <div key={s.k} className="row"><b>{s.label}</b>
            {linked || !onChange ? <span className="cf-val">{show(row[s.k] ?? "")}</span> : <Val ctx={ctx} value={row[s.k] ?? ""} label={`${col.label}: ${s.label}`} onChange={(v) => onChange({ [s.k]: v })} />}
            {s.suffix && <span>{s.suffix}</span>}
          </div>
        ))}
      </div>
    );
  }
  const v = row[col.k] ?? "";
  if (linked || !onChange) return <span className="cf-val">{show(v)}</span>;
  if (col.type === "yesno") return <YesNo ctx={ctx} value={v} onChange={(x) => onChange({ [col.k]: x })} label={col.label} />;
  return <Val ctx={ctx} value={v} label={col.label} area={col.type === "textarea"} type={col.type === "date" || col.type === "time" ? col.type : "text"} onChange={(x) => onChange({ [col.k]: x })} />;
}

/** `slice`: which printed page of a long table to draw (print only). */
function TableBlock({ b, ctx, page }: { b: Extract<Block, { t: "table" }>; ctx: Ctx; page: number }) {
  const manual = tableRows(b, ctx.U);
  const fromElsewhere = linkedRows(b.linked, ctx.file?.linked, ctx.def.scope === "date" ? ctx.unit : undefined);
  const total: { row: Row; linked: boolean; i: number }[] = [...fromElsewhere.map((row) => ({ row, linked: true, i: -1 })), ...manual.map((row, i) => ({ row, linked: false, i }))];
  const setRows = (rows: Row[]) => ctx.set({ ...ctx.U, [b.k]: rows });
  const printing = ctx.mode === "print";
  let shown = total;
  if (printing) {
    shown = total.slice(page * b.rows, (page + 1) * b.rows);
    while (shown.length < b.rows) shown = [...shown, { row: {}, linked: false, i: -2 }];
  } else if (manual.length === 0 || Object.values(manual[manual.length - 1]).some((x) => x)) {
    // A blank row to type into is always at the end.
    shown = [...total, { row: {}, linked: false, i: manual.length }];
  }
  const sum = b.cols.reduce((n, c) => n + c.w, 0);
  return (
    <>
      <table className="cf-table">
        <colgroup>{b.cols.map((c) => <col key={c.k} style={{ width: `${(c.w / sum) * 100}%` }} />)}{!printing && <col style={{ width: 26 }} />}</colgroup>
        <thead><tr>{b.cols.map((c) => <th key={c.k}>{c.label}</th>)}{!printing && <th className="cf-noprint" />}</tr></thead>
        <tbody>
          {shown.map((r, n) => (
            <tr key={n} style={{ height: printing ? b.rowH : undefined }} className={r.linked ? "cf-linked" : ""} title={r.linked ? `From: ${(r.row as LinkedRow)._src}. Change it where it was recorded.` : undefined}>
              {b.cols.map((c) => (
                <td key={c.k} className={c.center ? "c" : ""}>
                  <Cell col={c} row={r.row} ctx={ctx} linked={r.linked}
                    onChange={r.i >= 0 || (r.i === manual.length && !printing) ? (patch) => {
                      const rows = [...manual];
                      if (r.i >= rows.length) rows.push({});
                      rows[r.i] = { ...(rows[r.i] ?? {}), ...patch };
                      setRows(rows);
                    } : undefined} />
                </td>
              ))}
              {!printing && <td className="cf-noprint c">{r.linked ? <span className="cf-src">↺</span> : r.i >= 0 && r.i < manual.length ? <button type="button" className="cf-x" aria-label="Remove this row" onClick={() => setRows(manual.filter((_, k) => k !== r.i))}><X size={12} /></button> : null}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {!printing && <button type="button" className="cf-add cf-noprint" onClick={() => setRows([...manual, {}])}><Plus size={13} /> {b.addLabel ?? "Add a row"}</button>}
    </>
  );
}

function GridBlock({ b, ctx }: { b: Extract<Block, { t: "grid" }>; ctx: Ctx }) {
  const data = isObj(ctx.U[b.k]) ? (ctx.U[b.k] as Record<string, Record<string, string>>) : {};
  const fromElsewhere = linkedGrid(b.linked, ctx.file?.linked, ctx.unit);
  const printing = ctx.mode === "print";
  const setCell = (r: string, c: string, v: string) => ctx.set({ ...ctx.U, [b.k]: { ...data, [r]: { ...(data[r] ?? {}), [c]: v } } });
  let prevGroup: string | undefined;
  const groupSize = (g: string) => b.rows.filter((r) => (r.group ?? "") === g).length;
  return (
    <table className="cf-table cf-grid">
      <colgroup>{b.rows.some((r) => r.group) && <col style={{ width: 26 }} />}<col style={{ width: `${b.labelW ?? 20}%` }} />{b.cols.map((c) => <col key={c.k} />)}</colgroup>
      {b.cols.some((c) => c.label) && <thead><tr>{b.rows.some((r) => r.group) && <th />}<th>Activities</th>{b.cols.map((c) => <th key={c.k}>{c.label}</th>)}</tr></thead>}
      <tbody>
        {b.rows.map((r) => {
          const g = r.group ?? "";
          const first = g !== prevGroup; prevGroup = g;
          return (
            <tr key={r.k} style={{ height: b.rowH }}>
              {b.rows.some((x) => x.group) && (first && g ? <th rowSpan={groupSize(g)} className="cf-vert">{Array.from(g.replace(/ /g, "")).map((ch, i) => <div key={i}>{ch}</div>)}</th> : first ? <th rowSpan={groupSize(g)} /> : null)}
              <td className="l">{r.label}</td>
              {b.cols.map((c) => {
                const mine = data[r.k]?.[c.k] ?? "", theirs = fromElsewhere[r.k]?.[c.k] ?? "";
                return (
                  <td key={c.k}>
                    {theirs && <div className="cf-linked cf-val" title="From the nurse station">{theirs}</div>}
                    <Val ctx={ctx} value={mine} label={`${r.label} ${c.label ?? c.k}`} type={r.input ?? "text"} area={!!b.linked && !printing} onChange={(v) => setCell(r.k, c.k, v)} />
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function BlockView({ b, ctx, page }: { b: Block; ctx: Ctx; page: number }) {
  switch (b.t) {
    case "title": return <div className="cf-title">{b.text}</div>;
    case "heading": return <div className="cf-heading">{b.text}</div>;
    case "note": return <div className="cf-note">{b.text}</div>;
    case "patient": return <Strip b={b} ctx={ctx} />;
    case "fields":
      return (
        <div className="cf-fields" style={{ gridTemplateColumns: `repeat(${b.cols}, minmax(0, 1fr))` }}>
          {b.items.map((f) => (
            <div key={f.k} className="cf-f" style={f.span ? { gridColumn: `span ${f.span}` } : undefined}>
              <span className="l">{f.label}</span>
              <span className={f.type === "yesno" || f.type === "choice" || f.type === "check" ? "" : "v"}><FieldInput f={f} ctx={ctx} /></span>
            </div>
          ))}
        </div>
      );
    case "lines":
      return (
        <div className="cf-linesblock">
          {b.label && <div className="cf-label">{b.label}</div>}
          {ctx.mode === "print"
            ? <div className="cf-lines" style={{ minHeight: `calc(var(--lh, 26px) * ${b.n})` }}>{str(ctx.U[b.k])}</div>
            : <textarea className="cf-lines cf-in" aria-label={b.label ?? b.k} rows={b.n} style={{ minHeight: `calc(var(--lh, 26px) * ${b.n})` }} value={str(ctx.U[b.k])} onChange={(e) => ctx.set({ ...ctx.U, [b.k]: e.target.value })} />}
        </div>
      );
    case "table": return <TableBlock b={b} ctx={ctx} page={page} />;
    case "grid": return <GridBlock b={b} ctx={ctx} />;
    case "linkedlist": {
      const items = ctx.file?.linked.labTests ?? [];
      if (!items.length) return null;
      return <div className="cf-note cf-linkedlist"><b>{b.title}: </b>{items.map((t) => `${t.name} (${fmtDate(t.date)}${t.status ? `, ${t.status}` : ""})`).join(" · ")}</div>;
    }
  }
}

/** The letterhead: the hospital's own name, address and contacts. */
function Head({ file }: { file: CaseFileDTO | null }) {
  if (!file) return null;
  const h = file.hospital;
  return (
    <div className="cf-head">
      <div className="name">{h.name}</div>
      <div className="meta">{[h.address, h.city].filter(Boolean).join(", ")}</div>
      <div className="meta">{[h.phone && `Ph: ${h.phone}`, h.email && `E-mail: ${h.email}`].filter(Boolean).join("   ·   ")}</div>
    </div>
  );
}

/** What a form shows when the person has written nothing yet but the patient record has the answer. */
export function withKnownAnswers(def: FormDef, U: Unit, file: CaseFileDTO | null): Unit {
  if (!file) return U;
  if (def.key === "admission_history" && U.allergy === undefined && file.patient.allergies.trim()) return { ...U, allergy: "Yes", allergyNote: U.allergyNote ?? file.patient.allergies };
  if (def.key === "diagnosis_plan" && U.diagnosis === undefined && file.admission.diagnosis.trim()) return { ...U, diagnosis: file.admission.diagnosis };
  if (def.key === "room_handover" && U.roomNo === undefined) return { ...U, roomNo: [file.admission.ward, file.admission.bed].filter(Boolean).join(" · "), admDate: U.admDate ?? fmtDate(file.admission.admittedOn) };
  if (def.key === "room_charges" && U.roomNo === undefined) return { ...U, roomNo: file.admission.bed, admDate: U.admDate ?? file.admission.admittedOn };
  if (def.key === "past_history" && U.otherPh === undefined && file.patient.chronic.trim()) return { ...U, otherPh: file.patient.chronic };
  return U;
}

/* ── the editable sheet ─────────────────────────────────────────────────────────────────────────────────────────────────── */

export function FormEditor({ def, unit, U, file, onChange }: { def: FormDef; unit: string; U: Unit; file: CaseFileDTO | null; onChange: (next: Unit) => void }) {
  const shown = withKnownAnswers(def, U, file);
  const ctx: Ctx = { mode: "edit", file, unit, U: shown, set: onChange, def };
  return (
    <div className="cf cf-edit" style={def.lineH ? ({ "--lh": `${def.lineH}px` } as _CSS) : undefined}>
      <div className={`cf-page ${def.lineH ? "cf-dense" : ""}`}>
        <Head file={file} />
        {def.blocks.map((b, i) => <BlockView key={i} b={b} ctx={ctx} page={0} />)}
      </div>
    </div>
  );
}

/* ── the printed pages ──────────────────────────────────────────────────────────────────────────────────────────────────── */

/** Every printed page of one form: one per day or sheet, and more where a table runs past one page. */
export function PrintPages({ def, data, file }: { def: FormDef; data: Record<string, unknown>; file: CaseFileDTO | null }) {
  const units = unitsOf(def, data, file);
  const pages: ReactNode[] = [];
  for (const unit of units.length ? units : ["_"]) {
    const U = withKnownAnswers(def, unitData(def, data, unit), file);
    const ctx: Ctx = { mode: "print", file, unit, U, set: () => undefined, def };
    let count = 1;
    for (const b of def.blocks) {
      if (b.t !== "table") continue;
      const n = tableRows(b, U).length + linkedRows(b.linked, file?.linked, def.scope === "date" ? unit : undefined).length;
      count = Math.max(count, Math.ceil(n / b.rows));
    }
    for (let p = 0; p < count; p++) {
      pages.push(
        <div className={`cf-page ${def.lineH ? "cf-dense" : ""}`} key={`${def.key}-${unit}-${p}`} data-form={def.key} style={def.lineH ? ({ "--lh": `${def.lineH}px` } as _CSS) : undefined}>
          <Head file={file} />
          {def.blocks.map((b, i) => (p === 0 || b.t === "title" || b.t === "patient" || b.t === "table") ? <BlockView key={i} b={b} ctx={ctx} page={p} /> : <Fragment key={i} />)}
          {count > 1 && <div className="cf-pageno">Page {p + 1} of {count}</div>}
        </div>,
      );
    }
  }
  return <>{pages}</>;
}

export { FORM_BY_KEY };
