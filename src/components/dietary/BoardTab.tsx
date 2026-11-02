"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Printer, Send, FileText, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import { printElement } from "@/lib/print";
import type { DietBoardDTO, DietPrintDTO } from "@/types/api";
import { DIET_MEALS } from "@/types/api";

const clock = (ts: string | null) => (ts ? new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) : "");
const ghost = "inline-flex cursor-pointer items-center gap-[6px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[6px] text-[13px] font-medium hover:bg-[color:var(--subtle)] disabled:cursor-not-allowed disabled:opacity-50";
const primary = "inline-flex cursor-pointer items-center gap-[6px] rounded-[8px] bg-[color:var(--brand)] px-3 py-[6px] text-[13px] font-medium text-white disabled:opacity-50";

/** The ward's day: who is ordered what, and the kitchen sheet from generate to received. */
export function BoardTab({ date, wardId }: { date: string; wardId: number | null }) {
  const { item: board, error, reload } = useItem<DietBoardDTO>(`/dietary/board?date=${date}${wardId ? `&wardId=${wardId}` : ""}`);
  const { run, loading, error: actionError, reset } = useMutation();
  const [toast, setToast] = useState("");
  const [sheet, setSheet] = useState<DietPrintDTO | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 6000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (sheet) { const t = setTimeout(() => { printElement(printRef.current, `Kitchen diet sheet - ${sheet.ward}`); setSheet(null); }, 60); return () => clearTimeout(t); } }, [sheet]);
  if (!board) return <p className="p-6 text-[14px] text-[color:var(--ink-soft)]">{error ? "The board couldn't be loaded." : "Loading…"}</p>;
  if (board.wardId === null) return <p className="p-6 text-[14px] text-[color:var(--ink-soft)]">No wards are set up yet.</p>;
  const s = board.sheet;
  const body = { date, wardId: board.wardId };
  const act = (fn: () => Promise<void>) => { reset(); void run(async () => { await fn(); reload(); }).catch(() => undefined); };
  const generate = () => act(async () => { const r = await api.post<{ added: number; existing: number }>("/dietary/sheet", body); setToast(`Sheet ready - ${r.added} ${r.added === 1 ? "line" : "lines"} added, ${r.existing} already present`); });
  const dot = (ordered: boolean, onSheet: boolean) => !ordered ? <span className="text-[color:var(--ink-soft)] opacity-40">·</span>
    : <span className={`inline-block h-[10px] w-[10px] rounded-full ${s?.status === "Received" ? "bg-[#12a150]" : onSheet ? "bg-[#e8a90c]" : "bg-[#c9c9cf]"}`} title={onSheet ? (s?.status === "Received" ? "Received" : "On the sheet") : "Not on a sheet yet"} />;

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className={primary} onClick={generate} disabled={loading || (!!s && s.status !== "Draft")} title={s && s.status !== "Draft" ? "A dispatched sheet is closed" : undefined}><FileText size={14} />{s ? "Regenerate" : "Generate sheet"}</button>
        {!s && <span className="rounded-full border border-[color:var(--line)] px-3 py-[3px] text-[12px]">No sheet yet for {date}</span>}
        {s && <button className={ghost} title="Kitchen sheet PDF (register layout)" onClick={() => act(async () => setSheet(await api.get<DietPrintDTO>("/dietary/sheet/print", { date, wardId: board.wardId! })))} disabled={loading}><Printer size={14} />Print</button>}
        {s?.status === "Draft" && <button className={ghost} onClick={() => act(async () => { await api.post("/dietary/sheet/dispatch", body); setToast("Marked dispatched"); })} disabled={loading || s.lines === 0}><Send size={14} />Mark dispatched</button>}
        {s?.status === "Dispatched" && <><span className="rounded-full border border-[color:var(--line)] px-3 py-[3px] font-mono text-[12px]">dispatched {clock(s.dispatchedAt)}</span><button className={ghost} onClick={() => act(async () => { await api.post("/dietary/sheet/receive", body); setToast("Receipt confirmed"); })} disabled={loading}><Check size={14} />Confirm receipt</button></>}
        {s?.status === "Received" && <span className="rounded-full border border-[#9fe3c6] bg-[#effff8] px-3 py-[3px] font-mono text-[12px] text-[#0b7a47]">received {clock(s.receivedAt)}</span>}
        <span className="ml-auto font-mono text-[13px] text-[color:var(--ink-soft)]">{board.orders.length} active {board.orders.length === 1 ? "order" : "orders"}</span>
      </div>
      {actionError && <p role="alert" className="mb-3 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{actionError.message}</p>}
      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
        <table className="w-full border-collapse text-[14px]">
          <thead><tr className="text-left text-[12px] text-[color:var(--ink-soft)]"><th className="px-4 py-2 font-medium">Patient</th><th className="px-4 py-2 font-medium">Bed</th><th className="px-4 py-2 font-medium">Diet</th>{DIET_MEALS.map((m) => <th key={m} className="px-3 py-2 text-center font-medium">{m}</th>)}</tr></thead>
          <tbody>
            {board.orders.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-[color:var(--ink-soft)]">No diet orders for this ward. Add one on the Orders tab.</td></tr>}
            {board.orders.map((o) => (
              <tr key={o.id} className="border-t border-[color:var(--line)]">
                <td className="px-4 py-[9px] font-medium">{o.patient} <span className="ml-1 font-mono text-[11px] font-normal text-[color:var(--ink-soft)]">{o.patientCode}</span></td>
                <td className="whitespace-nowrap px-4 py-[9px] font-mono text-[13px]">{o.bed}</td>
                <td className="px-4 py-[9px]">{o.diet}{o.instructions && <span className="ml-1 text-[#d10024]" title={o.instructions}>*</span>}</td>
                {DIET_MEALS.map((m) => <td key={m} className="px-3 py-[9px] text-center">{dot(o.meals.includes(m), o.onSheet.includes(m))}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3 text-[13px] shadow-lg">
          <Check size={15} className="text-[#12a150]" />{toast}<button aria-label="Dismiss" onClick={() => setToast("")} className="ml-2 cursor-pointer text-[color:var(--ink-soft)]"><X size={14} /></button>
        </div>
      )}
      {sheet && (
        <div className="hidden">
          <div ref={printRef}>
            <h1 style={{ fontSize: 22, margin: 0 }}>{sheet.hospital}</h1>
            <h2 style={{ fontSize: 17, margin: "14px 0 2px" }}>Kitchen diet sheet - {sheet.ward}</h2>
            <p style={{ margin: "0 0 10px", color: "#555" }}>Meals for {sheet.date}</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr>{["MEAL", "PATIENT", "UHID", "BED", "DIET", "INSTRUCTIONS"].map((h) => <th key={h} style={{ textAlign: "left", borderBottom: "2px solid #111", padding: "4px 6px" }}>{h}</th>)}</tr></thead>
              <tbody>{sheet.rows.map((r, i) => <tr key={i}><td style={{ padding: "6px", borderBottom: "1px solid #ddd" }}>{r.meal}</td><td style={{ padding: "6px", borderBottom: "1px solid #ddd" }}>{r.patient}</td><td style={{ padding: "6px", borderBottom: "1px solid #ddd", fontFamily: "monospace" }}>{r.code}</td><td style={{ padding: "6px", borderBottom: "1px solid #ddd" }}>{r.bed}</td><td style={{ padding: "6px", borderBottom: "1px solid #ddd" }}>{r.diet}</td><td style={{ padding: "6px", borderBottom: "1px solid #ddd" }}>{r.instructions}</td></tr>)}</tbody>
            </table>
            <p style={{ fontSize: 11, color: "#666" }}>Rows: {sheet.rows.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
