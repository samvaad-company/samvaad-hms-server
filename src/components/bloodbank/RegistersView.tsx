"use client";

/**
 * The statutory registers (Drugs & Cosmetics Act / NBTC). Each is the same table for the same date, every time.
 * "Print" builds the register with the hospital letterhead and opens the print dialog — choose Save as PDF there.
 */
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Printer } from "lucide-react";
import { api } from "@/lib/api/client";
import { printElement } from "@/lib/print";
import { DocumentLetterhead, useHospital } from "@/components/shared/DocumentLetterhead";
import type { BloodRegisterDTO } from "@/types/api";
import { btn, SectionHead, todayLocal } from "@/components/bloodbank/shared";

const REGISTERS = [
  { kind: "donor", title: "Blood Donor Register", asOn: false },
  { kind: "stock", title: "Blood Stock Register", asOn: true },
  { kind: "issue", title: "Issue Register", asOn: false },
  { kind: "discard", title: "Discard / Wastage Register", asOn: false },
  { kind: "serology", title: "Serology Register", asOn: false },
] as const;

function RegisterDocument({ reg }: { reg: BloodRegisterDTO }) {
  const hospital = useHospital();
  return (
    <div className="bg-white p-8 text-[12px] text-black" style={{ width: 900 }}>
      <DocumentLetterhead hospital={hospital} compact />
      <h1 className="mt-4 text-[18px] font-semibold">{reg.title}</h1>
      <p className="text-[12px]">{reg.rows.length} {reg.rows.length === 1 ? "entry" : "entries"} · {reg.kind === "stock" ? "as on " : ""}{reg.date}</p>
      <table className="mt-3 w-full border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-black">{reg.columns.map((c) => <th key={c} className="py-[6px] pr-3 text-[11px] font-bold uppercase tracking-wide">{c}</th>)}</tr>
        </thead>
        <tbody>
          {reg.rows.map((r, i) => (
            <tr key={i} className="border-b border-[#ddd]">{r.map((cell, j) => <td key={j} className="py-[5px] pr-3 align-top">{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {reg.rows.length === 0 && <p className="mt-3">No records for this date.</p>}
      <p className="mt-3 text-[10px]">Rows: {reg.rows.length}</p>
    </div>
  );
}

export function RegistersView() {
  const [date, setDate] = useState(todayLocal());
  const [doc, setDoc] = useState<BloodRegisterDTO | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const docRef = useRef<HTMLDivElement>(null);

  async function print(kind: string) {
    setBusy(kind); setError(null);
    try {
      const reg = await api.get<BloodRegisterDTO>(`/blood-bank/registers/${kind}`, { date });
      // Render the document now (not on the next frame) so there is something in the DOM to print.
      flushSync(() => setDoc(reg));
      printElement(docRef.current?.firstElementChild as HTMLElement | null, `${reg.title} ${reg.date}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The register could not be produced.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <SectionHead title="Statutory registers" note="Drugs & Cosmetics Act / NBTC - deterministic PDFs"
        action={<input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} max={todayLocal()} aria-label="Register date"
          className="h-[40px] rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 font-mono text-[14px] text-[color:var(--ink)]" />} />
      {error && <p role="alert" className="mx-5 mb-3 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error}</p>}
      <div className="grid gap-3 px-5 pb-6" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        {REGISTERS.map((r) => (
          <div key={r.kind} className="flex items-center justify-between rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3">
            <div>
              <p className="text-[15px] font-medium text-[color:var(--ink)]">{r.title}</p>
              <p className="font-mono text-[13px] text-[color:var(--ink-soft)]">{r.asOn ? "as on " : ""}{date}</p>
            </div>
            <button onClick={() => print(r.kind)} disabled={busy !== null} title={`Render the ${r.title} PDF`}
              className={`${btn.base} ${btn.ghost} !h-[32px] !text-[13px]`}>
              <Printer size={14} /> {busy === r.kind ? "Preparing…" : "Print"}
            </button>
          </div>
        ))}
      </div>
      {/* The document that gets printed, kept off-screen. */}
      <div ref={docRef} aria-hidden style={{ position: "absolute", left: -99999, top: 0 }}>{doc && <RegisterDocument reg={doc} />}</div>
    </div>
  );
}
