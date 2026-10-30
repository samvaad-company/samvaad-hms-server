"use client";

/** Reports → Audit: every recorded change in the hospital, newest first, with the hash chain checked as it loads. */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileText, ScrollText, ShieldCheck, ShieldAlert } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { useItem } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { printElement } from "@/lib/print";
import type { AuditChainDTO, AuditEntryDTO, AuditPageDTO } from "@/types/api";
import { dmy } from "@/components/mrd/shared";
import { downloadText, toCsv } from "@/components/reports/format";

const PAGE = 50;
const stamp = (ts: string) => {
  const d = new Date(ts);
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }).replace(/^(\d+)/, (h) => h.padStart(2, "0"));
  return `${date}, ${time}`;
};
const TONE: Record<string, string> = { Created: "bg-[#dffff3] text-[#0b7a47]", Updated: "bg-[color:var(--subtle-2)] text-[color:var(--ink)]", Exported: "bg-[#fff1dc] text-[#8a5300]", Deleted: "bg-[#ffe9e9] text-[#c8001a]" };
const select = "rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[8px] text-[13px] text-[color:var(--ink)]";

function Banner({ chain, checking }: { chain: AuditChainDTO; checking?: boolean }) {
  if (!chain.intact) return <p role="alert" className="flex items-center gap-2 border-b border-[#f3b4b4] bg-[#ffe9e9] px-5 py-2 text-[13px] text-[#c8001a]"><ShieldAlert size={15} />The chain breaks at entry #{chain.brokenAt} — an entry was changed or removed after it was written.</p>;
  return (
    <p className="flex items-center gap-2 border-b border-[color:var(--line)] px-5 py-2 text-[13px] text-[color:var(--ink-soft)]">
      <ShieldCheck size={15} className="text-[#12a150]" />
      {checking ? "Checking the chain…"
        : chain.entries === 0 ? "Changes made from now on are added to a tamper-evident chain."
        : `Chain verified on ${chain.checkedOn} - ${chain.entries} ${chain.entries === 1 ? "entry" : "entries"}, unbroken.`}
      {chain.unchained > 0 && <span> {chain.unchained} older {chain.unchained === 1 ? "entry was" : "entries were"} written before the chain began.</span>}
    </p>
  );
}

function Row({ e, open, toggle }: { e: AuditEntryDTO; open: boolean; toggle: () => void }) {
  return (
    <li className="border-b border-[color:var(--line)] last:border-b-0">
      <button onClick={toggle} aria-expanded={open} className="grid w-full cursor-pointer items-center gap-3 px-4 py-[9px] text-left text-[13px] hover:bg-[color:var(--faint)]" style={{ gridTemplateColumns: "150px 82px minmax(0,1fr) auto 20px" }}>
        <span className="font-mono text-[12px] text-[color:var(--ink-soft)]">{stamp(e.at)}</span>
        <span className={`w-fit rounded-[6px] px-2 py-[2px] text-[12px] font-medium ${TONE[e.actionLabel] ?? TONE.Updated}`}>{e.actionLabel}</span>
        <span className="truncate">{e.summary}</span>
        <span className="whitespace-nowrap font-mono text-[12px] text-[color:var(--ink-soft)]">{e.actor} <span className="ml-2">#{e.id}</span></span>
        <ChevronDown size={14} className={`text-[color:var(--ink-soft)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <dl className="grid gap-x-6 gap-y-1 bg-[color:var(--brand-soft)] px-6 py-3 text-[12px]" style={{ gridTemplateColumns: "130px minmax(0,1fr)" }}>
          {e.details.map((d) => <div key={d.label} className="contents"><dt className="text-[color:var(--ink-soft)]">{d.label}</dt><dd className="break-words font-mono">{d.value}</dd></div>)}
        </dl>
      )}
    </li>
  );
}

export default function AuditPage() {
  const { can, loading: authLoading } = useAuth();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [module, setModule] = useState("");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [verified, setVerified] = useState<AuditChainDTO | null>(null);
  const [checking, setChecking] = useState(false);
  const [sheet, setSheet] = useState<AuditEntryDTO[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [rev, setRev] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setTimeout(() => { setTerm(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE), ...(term && { q: term }), ...(module && { module }), ...(action && { action }), ...(actor && { actor }), ...(from && { from }), ...(to && { to }), r: String(rev) }).toString();
  const { item, loading, error } = useItem<AuditPageDTO>(authLoading || !can("admin", "read") ? null : `/audit?${query}`);
  const [last, setLast] = useState<AuditPageDTO | null>(null);
  if (item && item !== last) setLast(item);
  const data = item ?? last;

  // Printing waits for the sheet to be on the page.
  useEffect(() => { if (sheet) { const t = setTimeout(() => { printElement(printRef.current, "Audit trail"); setSheet(null); }, 50); return () => clearTimeout(t); } }, [sheet]);

  if (authLoading) return null;
  if (!can("admin", "read")) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">The audit trail is available to hospital administrators.</p></div>;

  const filters = (all: boolean) => ({ ...(term && { q: term }), ...(module && { module }), ...(action && { action }), ...(actor && { actor }), ...(from && { from }), ...(to && { to }), ...(all ? { pageSize: 5000, page: 1 } : {}) });
  const verify = async () => { setChecking(true); try { setVerified(await api.get<AuditChainDTO>("/audit/verify")); } finally { setChecking(false); } };
  const exportAs = async (format: "csv" | "pdf") => {
    setBusy(true);
    try {
      const all = await api.get<AuditPageDTO>("/audit", filters(true));
      if (format === "csv") downloadText(`audit-trail-${all.chain.checkedOn}.csv`, toCsv(["Entry", "When", "Action", "Summary", "Module", "Actor"], all.rows.map((r) => [String(r.id), r.at, r.actionLabel, r.summary, r.module, r.actor])));
      else setSheet(all.rows);
      await api.post("/audit/export", { format, count: all.rows.length });
      setRev((n) => n + 1);
    } finally { setBusy(false); }
  };

  const chain = verified ?? data?.chain;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;
  const firstShown = data && data.total > 0 ? (page - 1) * PAGE + 1 : 0;
  const reset = (fn: () => void) => { fn(); setPage(1); };
  return (
    <div className={`${tw.gutterX} pt-[16px] mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
        <div className="flex items-center gap-3 border-b border-[color:var(--line)] px-5 py-3">
          <ScrollText size={16} className="text-[color:var(--ink-soft)]" />
          <h1 className="text-[15px] font-semibold">Audit trail</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={verify} disabled={checking} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[6px] text-[13px] disabled:opacity-50"><ShieldCheck size={14} />Verify chain</button>
            <button onClick={() => exportAs("csv")} disabled={busy || !data?.total} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[6px] text-[13px] disabled:opacity-50"><Download size={14} />CSV</button>
            <button onClick={() => exportAs("pdf")} disabled={busy || !data?.total} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[6px] text-[13px] disabled:opacity-50"><FileText size={14} />PDF</button>
          </div>
        </div>
        {chain && <Banner chain={chain} checking={checking} />}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search summary / resource..." aria-label="Search the audit trail" className={`${select} w-[260px] outline-none focus:border-[color:var(--brand)]`} />
          <select aria-label="Module" value={module} onChange={(e) => reset(() => setModule(e.target.value))} className={select}><option value="">All modules</option>{data?.modules.map((m) => <option key={m}>{m}</option>)}</select>
          <select aria-label="Action" value={action} onChange={(e) => reset(() => setAction(e.target.value))} className={select}><option value="">All actions</option>{data?.actions.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select>
          <select aria-label="Actor" value={actor} onChange={(e) => reset(() => setActor(e.target.value))} className={select}><option value="">Any actor</option>{data?.actors.map((a) => <option key={a}>{a}</option>)}</select>
          <input type="date" aria-label="From" value={from} max={to || undefined} onChange={(e) => reset(() => setFrom(e.target.value))} className={select} />
          <span className="text-[13px] text-[color:var(--ink-soft)]">to</span>
          <input type="date" aria-label="To" value={to} min={from || undefined} onChange={(e) => reset(() => setTo(e.target.value))} className={select} />
        </div>
        {error && <p role="alert" className="mx-5 mb-3 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">The audit trail couldn&apos;t be loaded.</p>}
        <div className="px-5 pb-3">
          {!data ? <p className="py-8 text-[14px] text-[color:var(--ink-soft)]">{loading ? "Loading…" : ""}</p> : data.rows.length === 0 ? <p className="rounded-[10px] border border-[color:var(--line)] py-10 text-center text-[14px] text-[color:var(--ink-soft)]">No entries match.</p> : (
            <ul className={`overflow-hidden rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] ${loading ? "opacity-60" : ""}`}>
              {data.rows.map((e) => <Row key={e.id} e={e} open={open.has(e.id)} toggle={() => setOpen((s) => { const n = new Set(s); if (!n.delete(e.id)) n.add(e.id); return n; })} />)}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-[color:var(--line)] px-5 py-3 text-[13px] text-[color:var(--ink-soft)]">
          <span>{data ? (data.total === 0 ? "Showing 0 of 0" : `Showing ${firstShown}-${Math.min(page * PAGE, data.total)} of ${data.total}`) : ""}</span>
          <span className="flex gap-2">
            <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="cursor-pointer rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[6px] disabled:opacity-40">Previous</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= pages} className="cursor-pointer rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[6px] font-medium text-[color:var(--ink)] disabled:opacity-40">Next</button>
          </span>
        </div>
      </div>
      {sheet && (
        <div className="hidden">
          <div ref={printRef}>
            <h2>Audit trail · {dmy(new Date().toLocaleDateString("en-CA"))}</h2>
            <table><thead><tr><th>#</th><th>When</th><th>Action</th><th>Summary</th><th>Actor</th></tr></thead>
              <tbody>{sheet.map((r) => <tr key={r.id}><td>{r.id}</td><td>{stamp(r.at)}</td><td>{r.actionLabel}</td><td>{r.summary}</td><td>{r.actor}</td></tr>)}</tbody></table>
          </div>
        </div>
      )}
    </div>
  );
}
