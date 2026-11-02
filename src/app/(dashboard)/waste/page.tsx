"use client";

/** Waste & infection control: bin collections, disposal to the vendor, infection events and hand-hygiene audits, and the register. */
import { useEffect, useRef, useState } from "react";
import { Printer, Recycle } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api/client";
import { printElement } from "@/lib/print";
import type { WasteRegisterDTO } from "@/types/api";
import { dmy } from "@/components/mrd/shared";
import { CollectionTab } from "@/components/waste/CollectionTab";
import { DisposalTab } from "@/components/waste/DisposalTab";
import { InfectionTab } from "@/components/waste/InfectionTab";
import { WasteDashboard } from "@/components/waste/WasteDashboard";
import { ghostBtn, kg } from "@/components/waste/shared";

const TABS = [{ id: "collection", label: "Collection" }, { id: "disposal", label: "Disposal" }, { id: "infection", label: "Infection control" }, { id: "dashboard", label: "Dashboard" }] as const;
const cell = { padding: "5px 6px", borderBottom: "1px solid #ddd", textAlign: "left" as const };

export default function WastePage() {
  const { can, loading } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("collection");
  const [register, setRegister] = useState<WasteRegisterDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (register) { const t = setTimeout(() => { printElement(printRef.current, "Biomedical waste register"); setRegister(null); }, 60); return () => clearTimeout(t); } }, [register]);
  if (loading) return null;
  if (!can("cssd", "read")) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">Waste & infection control is available to staff with access to CSSD.</p></div>;
  const canWrite = can("cssd", "write");
  const printRegister = async () => { setBusy(true); try { setRegister(await api.get<WasteRegisterDTO>("/waste/register")); } finally { setBusy(false); } };
  return (
    <div className={`${tw.gutterX} pt-[16px] mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 420 }}>
        <div className="flex items-center gap-3 border-b border-[color:var(--line)] px-5 py-3">
          <Recycle size={16} className="text-[color:var(--ink-soft)]" />
          <h1 className="text-[15px] font-semibold">Waste &amp; infection control</h1>
          <button className={`${ghostBtn} ml-auto`} onClick={() => void printRegister()} disabled={busy}><Printer size={14} />Print register</button>
        </div>
        <div className="px-5 pt-3">
          <div role="tablist" className="inline-flex rounded-[10px] bg-[color:var(--subtle-2)] p-[3px]">
            {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`cursor-pointer rounded-[8px] px-3 py-[5px] text-[14px] ${tab === t.id ? "bg-[color:var(--surface)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>{t.label}</button>)}
          </div>
        </div>
        {tab === "collection" && <CollectionTab canWrite={canWrite} />}
        {tab === "disposal" && <DisposalTab canWrite={canWrite} />}
        {tab === "infection" && <InfectionTab canWrite={canWrite} />}
        {tab === "dashboard" && <WasteDashboard />}
      </div>
      {register && (
        <div className="hidden">
          <div ref={printRef}>
            <h1 style={{ fontSize: 22, margin: 0 }}>{register.hospital}</h1>
            <h2 style={{ fontSize: 17, margin: "12px 0 2px" }}>Biomedical waste register</h2>
            <p style={{ margin: "0 0 10px", color: "#555" }}>{dmy(register.from)} – {dmy(register.to)}</p>
            <h3 style={{ fontSize: 14, margin: "10px 0 4px" }}>Collection</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><thead><tr>{["Date", "Time", "Ward", "Category", "Qty (kg)", "Bags"].map((h) => <th key={h} style={{ ...cell, borderBottom: "2px solid #111" }}>{h}</th>)}</tr></thead>
              <tbody>{register.collections.map((c) => <tr key={c.id}><td style={cell}>{c.date}</td><td style={cell}>{c.time}</td><td style={cell}>{c.ward}</td><td style={cell}>{c.categoryLabel}</td><td style={cell}>{kg(c.quantityKg)}</td><td style={cell}>{c.bags}</td></tr>)}</tbody></table>
            <h3 style={{ fontSize: 14, margin: "14px 0 4px" }}>Disposal</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><thead><tr>{["Date", "Category", "Qty (kg)", "Vendor", "Manifest no.", "Vehicle"].map((h) => <th key={h} style={{ ...cell, borderBottom: "2px solid #111" }}>{h}</th>)}</tr></thead>
              <tbody>{register.disposals.map((c) => <tr key={c.id}><td style={cell}>{c.date}</td><td style={cell}>{c.categoryLabel}</td><td style={cell}>{kg(c.quantityKg)}</td><td style={cell}>{c.vendor}</td><td style={cell}>{c.manifestNo}</td><td style={cell}>{c.vehicle}</td></tr>)}</tbody></table>
            <h3 style={{ fontSize: 14, margin: "14px 0 4px" }}>Totals</h3>
            <table style={{ borderCollapse: "collapse", fontSize: 12 }}><thead><tr>{["Category", "Collected (kg)", "Disposed (kg)"].map((h) => <th key={h} style={{ ...cell, borderBottom: "2px solid #111" }}>{h}</th>)}</tr></thead>
              <tbody>{register.totals.map((t) => <tr key={t.category}><td style={cell}>{t.label}</td><td style={cell}>{kg(t.collectedKg)}</td><td style={cell}>{kg(t.disposedKg)}</td></tr>)}</tbody></table>
          </div>
        </div>
      )}
    </div>
  );
}
