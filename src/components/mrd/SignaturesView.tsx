"use client";

/**
 * Signatures — every consent in the hospital, across patients: make one (New consent), print it, send it to a phone,
 * record a paper signature, or open the signed copy. The same rows and dialogs as on a patient's Documents tab.
 */
import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem } from "@/lib/api/hooks";
import type { ConsentCountsDTO, ConsentDocumentDTO, ConsentDTO } from "@/types/api";
import { Empty, primaryBtn } from "@/components/mrd/shared";
import { NewConsentDrawer } from "@/components/consents/NewConsentDrawer";
import { ConsentRow } from "@/components/consents/ConsentRow";
import { useConsentPrinter } from "@/components/consents/ConsentDocument";
import { ReadyDialog, SendDialog } from "@/components/consents/SendDialogs";

type Bucket = "draft" | "waiting" | "signed" | "refused" | "ended" | "all";

const CHIPS: { id: Bucket; label: string; count: keyof ConsentCountsDTO; on: string }[] = [
  { id: "draft", label: "Not sent yet", count: "draft", on: "border-[#f3cf7d] bg-[#fff2d6] text-[#8a5300]" },
  { id: "waiting", label: "Waiting to be signed", count: "waiting", on: "border-[#b9d3ff] bg-[#e3efff] text-[#0a5fc4]" },
  { id: "signed", label: "Signed", count: "signed", on: "border-[#9fe3c6] bg-[#dffff3] text-[#0b7a47]" },
  { id: "refused", label: "Refused", count: "refused", on: "border-[#f4a3ac] bg-[#ffe3e5] text-[#b3001b]" },
  { id: "ended", label: "Expired or cancelled", count: "expiredOrCancelled", on: "border-[color:var(--line)] bg-[color:var(--subtle-2)] text-[color:var(--ink)]" },
  { id: "all", label: "All", count: "all", on: "border-[#b9d3ff] bg-[#e3efff] text-[#0a5fc4]" },
];

export function SignaturesView({ canWrite }: { canWrite: boolean }) {
  const [bucket, setBucket] = useState<Bucket>("waiting");
  const [typed, setTyped] = useState("");
  const [term, setTerm] = useState("");
  const [making, setMaking] = useState(false);
  const [fresh, setFresh] = useState<ConsentDTO | null>(null);
  const [step, setStep] = useState<"send" | "ready" | null>(null);
  const printer = useConsentPrinter();
  useEffect(() => { const t = setTimeout(() => setTerm(typed.trim()), 250); return () => clearTimeout(t); }, [typed]);
  const path = useMemo(() => `/consents?status=${bucket}${term ? `&q=${encodeURIComponent(term)}` : ""}`, [bucket, term]);
  const { item: data, loading, reload } = useItem<{ items: ConsentDTO[]; counts: ConsentCountsDTO }>(path);
  const counts = data?.counts;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--line)] px-5 py-3">
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <button key={c.id} onClick={() => setBucket(c.id)} aria-pressed={bucket === c.id}
              className={`h-[28px] rounded-full border px-3 text-[13px] cursor-pointer transition-colors ${bucket === c.id ? c.on : "border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>
              {c.label} <span className="font-mono">{counts ? counts[c.count] : "–"}</span>
            </button>
          ))}
        </div>
        <label className="relative ml-auto block w-[260px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Search patient or form" aria-label="Search signatures"
            className="h-[36px] w-full rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] pl-8 pr-3 text-[14px] placeholder:text-[color:var(--ink-soft)] focus:border-[color:var(--brand)] focus:outline-none" />
        </label>
        {canWrite && <button onClick={() => setMaking(true)} className={primaryBtn}><Plus size={15} /> New consent</button>}
      </div>
      <div className="divide-y divide-[color:var(--line)]">
        {data?.items.map((c) => <ConsentRow key={c.id} consent={c} canWrite={canWrite} showPatient onChanged={reload} />)}
      </div>
      {!loading && data && data.items.length === 0 && <Empty>Nothing in this list.</Empty>}

      {making && (
        <NewConsentDrawer patient={null} onClose={() => setMaking(false)}
          onMade={(c, andPrint) => {
            setMaking(false); reload();
            if (andPrint) void printer.print(() => api.get<ConsentDocumentDTO>(`/consents/${c.id}/document`), c.formTitle);
            else { setFresh(c); setStep("send"); }
          }} />
      )}
      {fresh && step === "send" && <SendDialog consent={fresh} onClose={() => { setFresh(null); setStep(null); }} onCreated={(c) => { setFresh(c); setStep(c.delivery === "device" ? null : "ready"); reload(); }} />}
      {fresh && step === "ready" && fresh.link && <ReadyDialog consent={fresh} onClose={() => { setFresh(null); setStep(null); }} />}
      {printer.node}
    </div>
  );
}
