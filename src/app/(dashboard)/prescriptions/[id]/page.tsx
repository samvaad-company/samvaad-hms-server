"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { printElement, downloadElement, shareDocument } from "@/lib/print";
import { DocumentLetterhead, useHospital } from "@/components/shared/DocumentLetterhead";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import { AiReviewCard } from "@/components/prescriptions/AiReviewCard";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import type { PrescriptionDTO, RxAiReviewDTO, RxFindingSeverity } from "@/types/api";
import { ArrowLeft, Pill, Printer, Download, QrCode, HelpCircle, ChevronDown } from "lucide-react";

const SEVERITY_TAG: Record<RxFindingSeverity, string> = {
  critical: "bg-[#ffe3e5] text-[#b3001b] border-[#f4a3ac]",
  warning: "bg-[#fff2d6] text-[#8a5300] border-[#f3cf7d]",
  info: "bg-[color:var(--subtle)] text-[color:var(--ink-soft)] border-[color:var(--line)]",
};
const SEVERITY_RANK: Record<RxFindingSeverity, number> = { critical: 0, warning: 1, info: 2 };

function allergyList(text: string | null | undefined): string[] {
  return (text ?? "").split(/[,;/\n]+/).map((s) => s.trim()).filter((s) => s && !/^(none|nil|no|nka|nkda|n\/a|na|not assessed|unknown)$/i.test(s));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrescriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { item: rx, loading, reload } = useItem<PrescriptionDTO>(`/prescriptions/${id}`);
  useBreadcrumb("/prescriptions", "Prescriptions", rx?.rxNumber ?? "Prescription");
  const docRef = useRef<HTMLDivElement>(null);
  const hospital = useHospital();
  const { run } = useMutation();
  const [review, setReview] = useState<RxAiReviewDTO | null>(null);
  const [showPrintCopy, setShowPrintCopy] = useState(false);

  // The most serious finding per medicine, so each medicine line can carry its own flag.
  const flags = useMemo(() => {
    const byMedicine = new Map<string, { category: string; severity: RxFindingSeverity }>();
    for (const f of review?.findings ?? []) {
      for (const m of f.medicines) {
        const seen = byMedicine.get(m);
        if (!seen || SEVERITY_RANK[f.severity] < SEVERITY_RANK[seen.severity]) byMedicine.set(m, { category: f.category, severity: f.severity });
      }
    }
    return byMedicine;
  }, [review]);

  if (loading) {
    return (
      <div className={`${tw.gutterX} pt-10`}>
        <p className="text-[14px] font-normal text-[color:var(--ink-soft)]">Loading…</p>
      </div>
    );
  }
  if (!rx) {
    return (
      <div className={`${tw.gutterX} pt-10`}>
        <p className="text-[14px] font-normal text-[color:var(--ink-soft)]">Prescription not found.</p>
      </div>
    );
  }

  const title = `Prescription ${rx.rxNumber}`;
  const allergies = allergyList(rx.patient?.allergies);
  const conditions = allergyList(rx.patient?.chronicConditions);
  const canWrite = can("prescriptions", "write");

  const menu: RowAction[] = [
    { label: "Share link", onClick: () => void shareDocument(title, window.location.href) },
    { label: "Preview print copy", onClick: () => setShowPrintCopy((v) => !v) },
    ...(canWrite && rx.status !== "Dispensed"
      ? [{ label: "Mark dispensed", onClick: () => void run(() => api.post(`/prescriptions/${rx.id}/dispense`)).then(reload) }]
      : []),
  ];

  return (
    <>
      {/* Header */}
      <div className={`${tw.gutterX} pt-2 pb-3 flex items-center gap-3 flex-wrap`}>
        <Link href="/prescriptions" aria-label="Back to prescriptions" className="flex items-center justify-center w-8 h-8 rounded-full text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Pill size={18} className="text-[color:var(--ink-soft)] shrink-0" />
        <div className="min-w-0">
          <p className="text-[15px] leading-[20px] text-[color:var(--ink)] truncate">
            <span className="font-semibold">{rx.patientName}</span>
            {rx.patient?.code && <span className="ml-2 font-mono text-[12px] text-[color:var(--ink-soft)]">{rx.patient.code}</span>}
            <span className="ml-2 text-[12px] text-[color:var(--ink-soft)]">
              {rx.patientAge} yrs{rx.patient?.gender ? ` · ${rx.patient.gender}` : ""}
            </span>
          </p>
          <p className="text-[12px] leading-[16px] text-[color:var(--ink-soft)] truncate">
            {formatDate(rx.date)} · {rx.rxNumber} · {rx.doctor}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatusBadge status={rx.status} />
          <button onClick={() => downloadElement(docRef.current, title)} className="inline-flex items-center gap-2 h-[34px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px] text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer transition-colors">
            <Download size={14} /> Download Rx
          </button>
          <button onClick={() => printElement(docRef.current, title)} className="inline-flex items-center gap-2 h-[34px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px] text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer transition-colors">
            <Printer size={14} /> Print full details
          </button>
          <RowMenu actions={menu} />
        </div>
      </div>

      <div className={`${tw.gutterX} mb-[30px] grid gap-5 items-start`} style={{ gridTemplateColumns: "minmax(0,1fr) 320px" }}>
        {/* Main column */}
        <div className="flex flex-col gap-4 min-w-0">
          <div className="flex flex-wrap gap-2">
            {allergies.length > 0 ? (
              <span className="inline-flex items-center gap-[6px] rounded-full border border-[#f4a3ac] bg-[#ffe3e5] px-3 py-[3px] text-[12px] font-medium text-[#b3001b]">
                Allergies: {allergies.join(", ")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-[6px] rounded-full border border-[#f3cf7d] bg-[#fff6dd] px-3 py-[3px] text-[12px] text-[#8a5300]">
                <HelpCircle size={13} /> Allergies not assessed
              </span>
            )}
            {conditions.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-[color:var(--subtle)] px-3 py-[3px] text-[12px] text-[color:var(--ink)]">
                Conditions: {conditions.join(", ")}
              </span>
            )}
          </div>

          <AiReviewCard rxId={rx.id} medicineCount={rx.items.length} onReview={setReview} />

          {/* Medicines */}
          <section aria-label="Medicines" className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
            {rx.items.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-[color:var(--ink-soft)]">No medicines on this prescription.</p>
            ) : rx.items.map((m, i) => {
              const flag = flags.get(m.medicineName);
              return (
                <div key={m.id} className={`flex gap-3 px-4 py-3 ${i > 0 ? "border-t border-[color:var(--line)]" : ""}`}>
                  <span className="w-4 shrink-0 pt-[1px] text-[13px] text-[color:var(--ink-soft)]">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] leading-[20px] font-semibold text-[color:var(--ink)]">
                      {m.medicineName}
                      {m.dosage && !m.medicineName.replace(/\s+/g, "").toLowerCase().includes(m.dosage.replace(/\s+/g, "").toLowerCase()) && <span className="ml-2 text-[13px] font-medium text-[color:var(--ink-soft)]">{m.dosage}</span>}
                    </p>
                    {m.generic && <p className="text-[12px] leading-[16px] text-[color:var(--ink-soft)]">{m.generic}</p>}
                    <p className="mt-1 text-[14px] leading-[19px] text-[color:var(--ink)]">
                      {[m.frequency, m.duration].filter(Boolean).join(" · ") || "No directions given"}
                    </p>
                    {m.instructions && <p className="mt-1 text-[14px] leading-[19px] text-[color:var(--ink)]">{m.instructions}</p>}
                  </div>
                  {flag && (
                    <span title="Flagged by the AI review" className={`self-start shrink-0 rounded-full border px-[10px] py-[2px] text-[11px] font-medium ${SEVERITY_TAG[flag.severity]}`}>
                      {flag.category}
                    </span>
                  )}
                </div>
              );
            })}
          </section>

          <section aria-label="Diagnosis">
            <p className="text-[12px] font-semibold text-[color:var(--ink)]">Diagnosis</p>
            <p className="mt-1 text-[15px] leading-[21px] text-[color:var(--ink)]">{rx.diagnosis}</p>
          </section>

          {showPrintCopy && (
            <button onClick={() => setShowPrintCopy(false)} className="self-start inline-flex items-center gap-1 text-[12px] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] cursor-pointer">
              <ChevronDown size={14} /> Hide print copy
            </button>
          )}
        </div>

        {/* Side column */}
        <aside className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3 flex flex-col gap-3">
          <div>
            <p className="text-[12px] font-semibold text-[color:var(--ink)]">Patient</p>
            <p className="mt-1 text-[13px] text-[color:var(--ink-soft)]">
              {rx.patientName} · {rx.patientAge} yrs{rx.patient?.gender ? ` · ${rx.patient.gender}` : ""}
            </p>
            {rx.patient?.code && <p className="font-mono text-[12px] text-[color:var(--ink-soft)]">{rx.patient.code}</p>}
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[color:var(--ink)]">Prescribed by</p>
            <p className="mt-1 text-[13px] text-[color:var(--ink-soft)]">{rx.doctor || "—"}</p>
          </div>
          {rx.patientId && (
            <Link href={`/patients/${rx.patientId}`} className="text-[12px] font-medium text-[color:var(--brand)] hover:underline">
              Open patient record
            </Link>
          )}
        </aside>
      </div>

      {/* Printable copy — always mounted so Download / Print can use it; shown on screen only when asked for. */}
      <div
        aria-hidden={!showPrintCopy}
        style={showPrintCopy ? undefined : { position: "absolute", left: -99999, top: 0, width: 860 }}
        className={showPrintCopy ? `${tw.gutterX} mb-[30px]` : undefined}
      >
        <div ref={docRef} className={`${tw.surface.card} ${tw.radius.card} overflow-hidden max-w-[860px] mx-auto`}>
          <DocumentLetterhead
            hospital={hospital}
            right={
              <>
                <div className="text-[13px] font-medium text-[color:var(--brand)]">{rx.rxNumber}</div>
                <div className="text-[12px] font-light text-[color:var(--ink-soft)]">Date: {formatDate(rx.date)}</div>
                <span className={`inline-flex px-[8px] py-[3px] rounded-full text-[11px] font-normal mt-1 ${rx.status === "Dispensed" ? "bg-[#dffff3] text-[#00955c]" : rx.status === "Pending" ? "bg-[#fff2e0] text-[#ff9000]" : "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]"}`}>{rx.status}</span>
              </>
            }
          />

          <div className="px-8 py-4 grid grid-cols-2 gap-4 border-b border-[color:var(--subtle-2)]">
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Patient</p>
              <p className="text-[15px] font-medium text-[color:var(--ink)]">{rx.patientName}</p>
              <p className="text-[12px] font-light text-[color:var(--ink-soft)]">
                {rx.patientAge} years{rx.patient?.gender ? ` · ${rx.patient.gender}` : ""}{rx.patient?.code ? ` · ${rx.patient.code}` : ""}
              </p>
              {allergies.length > 0 && <p className="text-[12px] font-normal text-[#b3001b]">Allergies: {allergies.join(", ")}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Physician</p>
              <p className="text-[15px] font-medium text-[color:var(--ink)]">{rx.doctor}</p>
            </div>
          </div>

          <div className="px-8 py-4 border-b border-[color:var(--subtle-2)]">
            <p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-1">Diagnosis</p>
            <p className="text-[14px] font-normal text-[color:var(--ink)]">{rx.diagnosis}</p>
          </div>

          <div className="px-8 py-5 border-b border-[color:var(--subtle-2)]">
            <p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-3">Medicines</p>
            <div className="border border-[color:var(--line)] rounded-[10px] overflow-hidden">
              <div className="grid grid-cols-[2fr_1fr_1.5fr_1fr_2fr] bg-[color:var(--subtle-3)] px-4 py-2">
                {["Medicine", "Dosage", "Frequency", "Duration", "Instructions"].map((h) => (
                  <span key={h} className="text-[12px] font-medium text-[color:var(--ink)]">{h}</span>
                ))}
              </div>
              {rx.items.map((m, i) => (
                <div key={m.id} className={`grid grid-cols-[2fr_1fr_1.5fr_1fr_2fr] px-4 py-3 ${i < rx.items.length - 1 ? "border-b border-[color:var(--subtle-2)]" : ""}`}>
                  <span className="text-[13px] font-medium text-[color:var(--ink)]">{m.medicineName}</span>
                  <span className="text-[13px] font-normal text-[color:var(--ink-soft)]">{m.dosage}</span>
                  <span className="text-[13px] font-normal text-[color:var(--ink)]">{m.frequency}</span>
                  <span className="text-[13px] font-normal text-[color:var(--ink-soft)]">{m.duration}</span>
                  <span className="text-[12px] font-light text-[color:var(--ink-soft)]">{m.instructions ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-8 py-5 flex items-end justify-between">
            <div className="flex flex-col items-center gap-2">
              <div className="w-[72px] h-[72px] bg-[color:var(--subtle-2)] rounded-[8px] flex items-center justify-center">
                <QrCode size={36} className="text-[color:var(--ink-soft)]" />
              </div>
              <p className="text-[10px] font-light text-[color:var(--ink-soft)]">Scan to verify</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-[120px] border-b border-[color:var(--ink-soft)]" />
              <p className="text-[12px] font-normal text-[color:var(--ink)]">{rx.doctor}</p>
              <p className="text-[11px] font-light text-[color:var(--ink-soft)]">Signature & Seal</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
