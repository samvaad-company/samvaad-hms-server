"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Printer, Search } from "lucide-react";
import { useItem } from "@/lib/api/hooks";
import { printElement } from "@/lib/print";
import type { ReportCatalogDTO, ReportMetaDTO, ReportRunDTO } from "@/types/api";
import { dmy, todayLocal } from "@/components/mrd/shared";
import { cellText, downloadText, toCsv } from "./format";

const Chip = ({ children }: { children: string }) => (
  <span className="shrink-0 rounded-full bg-[color:var(--brand-soft)] px-[10px] py-[2px] text-[11px] font-medium text-[color:var(--ink)]">{children}</span>
);

/** One report: its filters, the table it produces, and CSV / print. */
function ReportRunner({ meta, onBack }: { meta: ReportMetaDTO; onBack: () => void }) {
  const monthStart = `${todayLocal().slice(0, 8)}01`;
  const [from, setFrom] = useState(meta.param === "day" ? todayLocal() : monthStart);
  const [to, setTo] = useState(todayLocal());
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const sheet = useRef<HTMLDivElement>(null);
  const path = `/reports/run?id=${meta.id}&from=${from}&to=${to}&q=${encodeURIComponent(q)}`;
  const { item, loading, error } = useItem<ReportRunDTO>(path);

  const exportCsv = () => {
    if (!item) return;
    const head = item.columns.map((c) => c.label);
    const body = item.rows.map((r) => item.columns.map((c) => cellText(r[c.key], c.fmt)));
    if (item.totals) body.push(item.columns.map((c) => (item.totals![c.key] == null ? "" : cellText(item.totals![c.key], c.fmt))));
    downloadText(`${meta.id}_${from}_${to}.csv`, toCsv(head, body));
  };
  const period = meta.param === "day" ? dmy(from) : meta.param === "asof" ? `as on ${dmy(to)}` : meta.param === "range" ? `${dmy(from)} – ${dmy(to)}` : "";

  return (
    <div className="px-5 pb-6 pt-4">
      <button onClick={onBack} className="mb-3 inline-flex cursor-pointer items-center gap-[6px] text-[13px] text-[color:var(--ink-soft)] hover:text-[color:var(--brand)]"><ArrowLeft size={14} />All reports</button>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold">{meta.title}</h2>
          <p className="text-[13px] text-[color:var(--ink-soft)]">{meta.description}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3 text-[12px] text-[color:var(--ink-soft)]">
          {meta.param === "range" && (<>
            <label className="flex flex-col gap-1">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value || monthStart)} className="rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 py-[6px] text-[13px] text-[color:var(--ink)]" /></label>
            <label className="flex flex-col gap-1">To<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value || todayLocal())} className="rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 py-[6px] text-[13px] text-[color:var(--ink)]" /></label>
          </>)}
          {meta.param === "day" && (
            <label className="flex flex-col gap-1">Date<input type="date" value={from} onChange={(e) => { setFrom(e.target.value || todayLocal()); setTo(e.target.value || todayLocal()); }} className="rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 py-[6px] text-[13px] text-[color:var(--ink)]" /></label>
          )}
          {meta.param === "asof" && (
            <label className="flex flex-col gap-1">As on<input type="date" value={to} onChange={(e) => setTo(e.target.value || todayLocal())} className="rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 py-[6px] text-[13px] text-[color:var(--ink)]" /></label>
          )}
          {meta.param === "patient" && (
            <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); setQ(draft.trim()); }}>
              <label className="flex flex-col gap-1">Patient<input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Name or patient ID" className="w-[220px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 py-[6px] text-[13px] text-[color:var(--ink)]" /></label>
              <button className="cursor-pointer rounded-[8px] bg-[color:var(--brand)] px-3 py-[7px] text-[13px] font-medium text-white">Run</button>
            </form>
          )}
          <button onClick={exportCsv} disabled={!item || !item.rows.length} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[7px] text-[13px] text-[color:var(--ink)] disabled:opacity-40"><Download size={14} />CSV</button>
          <button onClick={() => printElement(sheet.current, meta.title)} disabled={!item || !item.rows.length} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[7px] text-[13px] text-[color:var(--ink)] disabled:opacity-40"><Printer size={14} />Print</button>
        </div>
      </div>

      {error ? <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>
        : !item ? <p className="py-8 text-[14px] text-[color:var(--ink-soft)]">{loading ? "Running…" : ""}</p> : (
          <div ref={sheet}>
            <h3 className="mb-2 hidden text-[16px] font-semibold print:block">{meta.title} {period && `· ${period}`}</h3>
            {item.summary && item.summary.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {item.summary.map((s) => (
                  <span key={s.label} className="rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[6px] text-[13px]"><span className="text-[color:var(--ink-soft)]">{s.label}: </span><span className="font-mono font-semibold">{cellText(s.value, s.fmt)}</span></span>
                ))}
              </div>
            )}
            {item.columns.length > 0 && (
              <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[color:var(--subtle)] text-left text-[12px] text-[color:var(--ink-soft)]">
                      {item.columns.map((c) => <th key={c.key} className={`whitespace-nowrap px-4 py-2 font-semibold ${c.fmt === "money" || c.fmt === "int" || c.fmt === "pct" ? "text-right" : ""}`}>{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {item.rows.length === 0 && <tr><td colSpan={item.columns.length} className="px-4 py-8 text-center text-[color:var(--ink-soft)]">Nothing to show for {period || "this report"}.</td></tr>}
                    {item.rows.map((r, i) => (
                      <tr key={i} className="border-t border-[color:var(--line)]">
                        {item.columns.map((c) => <td key={c.key} className={`px-4 py-[9px] ${c.fmt === "money" || c.fmt === "int" || c.fmt === "pct" ? "text-right font-mono" : ""}`}>{cellText(r[c.key], c.fmt)}</td>)}
                      </tr>
                    ))}
                    {item.totals && item.rows.length > 0 && (
                      <tr className="border-t-2 border-[color:var(--line)] bg-[color:var(--subtle)] font-semibold">
                        {item.columns.map((c) => <td key={c.key} className={`px-4 py-[9px] ${c.fmt === "money" || c.fmt === "int" || c.fmt === "pct" ? "text-right font-mono" : ""}`}>{item.totals![c.key] == null ? "" : cellText(item.totals![c.key], c.fmt)}</td>)}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {item.note && <p className="mt-3 text-[12px] text-[color:var(--ink-soft)]">{item.note}</p>}
            {item.rows.length > 0 && <p className="mt-1 text-[12px] text-[color:var(--ink-soft)]">{item.rows.length} {item.rows.length === 1 ? "row" : "rows"}</p>}
          </div>
        )}
    </div>
  );
}

/** Reports → Reports: every report as a card, filterable by category and search; opening one runs it. */
export function ReportsCatalog() {
  const { item, error } = useItem<ReportCatalogDTO>("/reports/catalog");
  const [category, setCategory] = useState("All");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (item?.reports ?? []).filter((r) => (category === "All" || r.category === category) && (!needle || `${r.title} ${r.description} ${r.category}`.toLowerCase().includes(needle)));
  }, [item, category, q]);
  const meta = item?.reports.find((r) => r.id === open);

  if (meta) return <ReportRunner key={meta.id} meta={meta} onBack={() => setOpen(null)} />;
  return (
    <div className="px-5 pb-6 pt-4">
      <label className="relative mb-3 ml-auto block w-[260px] max-w-full">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reports…" aria-label="Search reports"
          className="w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] py-[7px] pl-8 pr-3 text-[13px] outline-none focus:border-[color:var(--brand)]" />
      </label>
      <div className="mb-4 flex flex-wrap gap-2">
        {["All", ...(item?.categories ?? [])].map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={`cursor-pointer rounded-full border px-[14px] py-[5px] text-[13px] font-medium ${category === c ? "border-[color:var(--brand)] bg-[color:var(--brand)] text-white" : "border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>{c}</button>
        ))}
      </div>
      {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">The reports couldn&apos;t be loaded.</p>}
      {!item && !error && <p className="py-8 text-[14px] text-[color:var(--ink-soft)]">Loading…</p>}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {shown.map((r) => (
          <button key={r.id} onClick={() => setOpen(r.id)} aria-label={r.title}
            className={`flex cursor-pointer flex-col gap-1 rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3 text-left hover:border-[color:var(--brand)] ${r.available ? "" : "opacity-60"}`}>
            <span className="flex items-start justify-between gap-2"><span className="text-[14px] font-medium leading-5 text-[color:var(--ink)]">{r.title}</span><Chip>{r.category}</Chip></span>
            <span className="text-[12px] leading-4 text-[color:var(--ink-soft)]">{r.description}{r.available ? "" : " — not available yet"}</span>
          </button>
        ))}
      </div>
      {item && shown.length === 0 && <p className="py-8 text-center text-[14px] text-[color:var(--ink-soft)]">No report matches that.</p>}
    </div>
  );
}
