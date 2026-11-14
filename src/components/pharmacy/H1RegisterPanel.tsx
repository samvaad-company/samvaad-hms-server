"use client";

/**
 * The H1 Register tab of Pharmacy: every Schedule H1 drug given to a patient (from a dispense or a counter sale), newest first —
 * who it was for, the prescriber, the drug, the quantity and when. Filter by dates and by patient, search, print or save as CSV.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList } from "@/lib/api/hooks";
import { formatDate, todayIso } from "@/lib/dates";
import { printElement } from "@/lib/print";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { LoadingBlock, Spinner } from "@/components/shared/Spinner";
import { useHospital } from "@/components/shared/DocumentLetterhead";
import type { H1RegisterDTO, PatientDTO } from "@/types/api";

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const field = "h-[34px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 text-[13px] text-[color:var(--ink)] focus:border-[color:var(--brand)] focus:outline-none";
const chip = "h-[28px] rounded-full border border-[color:var(--line)] px-3 text-[12px] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer";

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function H1RegisterPanel() {
  const hospital = useHospital();
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(todayIso());
  const [patientId, setPatientId] = useState("");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [data, setData] = useState<H1RegisterDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setTimeout(() => setTerm(search.trim()), 300); return () => clearTimeout(t); }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get<H1RegisterDTO>("/pharmacy/h1-register", { ...(from ? { from } : {}), ...(to ? { to } : {}), ...(patientId ? { patientId } : {}), ...(term ? { search: term } : {}) }));
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "The register couldn't be loaded."); }
    finally { setLoading(false); }
  }, [from, to, patientId, term]);
  useEffect(() => { void load(); }, [load]);

  const preset = (days: number | null) => { setFrom(days === null ? "" : daysAgo(days)); setTo(todayIso()); };
  const entries = data?.entries ?? [];

  function exportCsv() {
    const head = ["Date", "Time", "Patient", "Age", "Phone", "Address", "Prescriber", "Rx no.", "Medicine", "Quantity", "Returned", "Batch", "Reference", "Bill", "Given by"];
    const rows = entries.map((e) => [e.date, e.time, e.patientName, e.patientAge ?? "", e.patientPhone, e.patientAddress, e.prescriber, e.rxNumber, e.medicineName, e.quantity, e.returnedQty, e.batchNo, e.reference, e.billNumber, e.givenBy]);
    const blob = new Blob([[head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `H1-register-${from || "start"}-to-${to || "today"}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  return (
    <div className="p-5 flex flex-col gap-4" data-testid="h1-register">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1"><span className="text-[12px] text-[color:var(--ink-soft)]">From</span>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={field} aria-label="From date" /></label>
        <label className="flex flex-col gap-1"><span className="text-[12px] text-[color:var(--ink-soft)]">To</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={field} aria-label="To date" /></label>
        <div className="flex flex-wrap gap-2 pb-[2px]">
          <button type="button" onClick={() => preset(0)} className={chip}>Today</button>
          <button type="button" onClick={() => preset(7)} className={chip}>7 days</button>
          <button type="button" onClick={() => preset(30)} className={chip}>30 days</button>
          <button type="button" onClick={() => preset(null)} className={chip}>All time</button>
        </div>
        <div className="flex flex-col gap-1 min-w-[220px] flex-1 max-w-[320px]"><span className="text-[12px] text-[color:var(--ink-soft)]">Patient</span>
          <SearchSelect placeholder="All patients" value={patientId} onChange={setPatientId}
            options={[{ value: "", label: "All patients" }, ...patients.map((p) => ({ value: String(p.id), patientId: p.id, label: p.name, hint: `${p.patientId ?? ""} · ${p.phone}` }))]} /></div>
        <label className="flex flex-col gap-1 min-w-[180px] flex-1 max-w-[260px]"><span className="text-[12px] text-[color:var(--ink-soft)]">Search</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Drug, Rx, doctor, bill…" className={field} aria-label="Search the H1 register" /></label>
        <div className="ml-auto flex gap-2 pb-[2px]">
          <button type="button" onClick={() => printElement(docRef.current, "H1 register")} disabled={entries.length === 0} className={`${chip} inline-flex items-center gap-1 disabled:opacity-40`}><Printer size={13} /> Print</button>
          <button type="button" onClick={exportCsv} disabled={entries.length === 0} className={`${chip} inline-flex items-center gap-1 disabled:opacity-40`}><Download size={13} /> CSV</button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#ff0004]">{error}</p>}

      <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        {[["Patients", data?.summary.patients], ["Entries", data?.summary.entries], ["Units given", data?.summary.units]].map(([label, value]) => (
          <div key={label as string} className="rounded-[10px] border border-[color:var(--line)] px-4 py-3"><p className="text-[12px] text-[color:var(--ink-soft)]">{label}</p><p className="text-[20px] font-medium text-[color:var(--ink)]">{value ?? "—"}</p></div>
        ))}
      </div>

      {loading && !data ? <LoadingBlock label="Loading the H1 register…" /> : (
        <div ref={docRef} className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]" aria-busy={loading}>
          <div className="hidden print:block px-4 py-3 text-[13px]"><b>{hospital.name}</b> — Schedule H1 drug register{from || to ? ` (${from ? formatDate(from) : "start"} to ${to ? formatDate(to) : "today"})` : ""}</div>
          <table data-keep-table className="w-full min-w-[980px] text-left text-[13px]">
            <thead className="bg-[color:var(--subtle-3)] text-[12px] text-[color:var(--ink)]"><tr>
              <th className="px-4 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Patient</th><th className="px-3 py-2 font-medium">Prescriber</th><th className="px-3 py-2 font-medium">Medicine</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th><th className="px-3 py-2 font-medium">Batch</th><th className="px-3 py-2 font-medium">Ref.</th><th className="px-3 py-2 font-medium">Given by</th>
            </tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.key} className="border-t border-[color:var(--subtle-2)] align-top">
                  <td className="px-4 py-2 whitespace-nowrap text-[color:var(--ink)]">{formatDate(e.date)}<span className="block text-[11px] text-[color:var(--ink-soft)]">{e.time}</span></td>
                  <td className="px-3 py-2"><span className="block font-medium text-[color:var(--ink)]">{e.patientName}</span><span className="block text-[11px] text-[color:var(--ink-soft)]">{[e.patientAge != null ? `${e.patientAge} yrs` : "", e.patientPhone].filter(Boolean).join(" · ")}</span>{e.patientAddress && <span className="block text-[11px] text-[color:var(--ink-soft)]">{e.patientAddress}</span>}</td>
                  <td className="px-3 py-2 text-[color:var(--ink)]">{e.prescriber || "—"}{e.rxNumber && <span className="block font-mono text-[11px] text-[color:var(--ink-soft)]">{e.rxNumber}</span>}</td>
                  <td className="px-3 py-2 text-[color:var(--ink)]"><span className="mr-2 rounded-full bg-[#ffe9e9] px-2 py-[1px] text-[10px] font-medium text-[#c8001a]">H1</span>{e.medicineName}</td>
                  <td className="px-3 py-2 text-right font-medium">{e.quantity}{e.returnedQty > 0 && <span className="block text-[11px] font-normal text-[#c26a00]">{e.returnedQty} returned</span>}</td>
                  <td className="px-3 py-2 text-[color:var(--ink-soft)]">{e.batchNo || "—"}</td>
                  <td className="px-3 py-2 font-mono text-[12px] text-[color:var(--ink-soft)]">{e.reference}<span className="block text-[11px]">{e.source}{e.billNumber ? ` · ${e.billNumber}` : ""}</span></td>
                  <td className="px-3 py-2 text-[color:var(--ink-soft)]">{e.givenBy || "—"}</td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-[color:var(--ink-soft)]">No H1 drugs were given in this period{patientId || term ? " for this filter" : ""}.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {loading && data && <p className="inline-flex items-center gap-2 text-[12px] text-[color:var(--ink-soft)]" role="status"><Spinner size={12} /> Updating…</p>}
    </div>
  );
}
