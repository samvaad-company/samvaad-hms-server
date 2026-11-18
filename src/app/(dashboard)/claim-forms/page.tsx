"use client";

/** Claim forms: the admitted patients whose stay is paid by an insurer or TPA. Open one to get the insurer's own claim form filled in. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Search } from "lucide-react";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { useItem } from "@/lib/api/hooks";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { PatientName } from "@/components/loyalty/PatientName";
import type { ClaimCandidateDTO } from "@/types/claims";

const COLUMNS = [
  { label: "Patient", width: "minmax(170px,1.5fr)" },
  { label: "Admission", width: "130px" },
  { label: "Ward · Bed", width: "minmax(120px,1fr)" },
  { label: "Paid by", width: "minmax(170px,1.4fr)" },
  { label: "Claim form", width: "minmax(190px,1.5fr)" },
  { label: "Admitted", width: "110px" },
  { label: "", width: "140px" },
];

export default function ClaimFormsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [discharged, setDischarged] = useState(false);
  const qs = new URLSearchParams();
  if (search.trim()) qs.set("search", search.trim());
  if (discharged) qs.set("discharged", "1");
  const { item: rows, loading, error } = useItem<ClaimCandidateDTO[]>(`/claim-forms${qs.size ? `?${qs}` : ""}`);
  const list = rows ?? [];

  return (
    <>
      <PageHeader title="Claim forms" subtitle="Admitted patients paid by an insurance company or TPA. Open one to fill the insurer's own claim form from the patient's record and download it as a PDF."
        stats={[{ icon: FileText, value: String(list.length), label: discharged ? "Insured stays" : "Admitted, insured" }]} dateRange={false} />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 360 }}>
          <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--line)] px-4 py-3">
            <label className="relative min-w-[220px] flex-1 sm:max-w-[360px]">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient, admission, insurer, doctor…" aria-label="Search claim forms"
                className="h-[38px] w-full rounded-full border border-[color:var(--line)] bg-[color:var(--subtle)] pl-9 pr-4 text-[13px] text-[color:var(--ink)] focus:border-[color:var(--brand)] focus:outline-none" />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-[color:var(--ink-soft)]">
              <input type="checkbox" checked={discharged} onChange={(e) => setDischarged(e.target.checked)} className="h-4 w-4 accent-[color:var(--brand)]" />
              Include patients discharged in the last 60 days
            </label>
          </div>
          <DataTable columns={COLUMNS} minWidth={1000}>
            {error ? (
              <div className="py-16 text-center text-[14px] text-[#c8001a]">{error.message}</div>
            ) : loading && !rows ? (
              <div className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">Loading…</div>
            ) : list.length === 0 ? (
              <div className="px-4 py-16 text-center text-[14px] text-[color:var(--ink-soft)]">
                {search || discharged ? "No insured stay matches." : "No admitted patient is paid by an insurer or TPA right now. Set “Paid by” on an admission to an insurance company and it will show here."}
              </div>
            ) : list.map((c) => (
              <div key={c.admissionId} role="button" tabIndex={0} onClick={() => router.push(`/claim-forms/${c.admissionId}`)} onKeyDown={(e) => { if (e.key === "Enter") router.push(`/claim-forms/${c.admissionId}`); }}
                className={`${tw.table.dataRow} cursor-pointer`} style={{ gridTemplateColumns: "var(--cols)" }}>
                <span className="truncate text-[13px] font-medium text-[color:var(--ink)]"><PatientName id={c.patientId} name={c.patientName} /></span>
                <span className="truncate text-[13px] text-[color:var(--ink)]">{c.admissionNo || `#${c.admissionId}`}</span>
                <span className="truncate text-[13px] text-[color:var(--ink)]">{[c.ward, c.bed].filter(Boolean).join(" · ") || "—"}</span>
                <span className="truncate text-[13px] text-[color:var(--ink)]">{c.payer}{c.status === "Discharged" ? <span className="ml-2 rounded-full bg-[color:var(--subtle)] px-2 py-[1px] text-[11px] text-[color:var(--ink-soft)]">Discharged</span> : null}</span>
                <span className={`truncate text-[13px] ${c.formName ? "text-[color:var(--ink)]" : "text-[#b26a00]"}`}>{c.formName ?? "Choose the insurer's form"}</span>
                <span className="whitespace-nowrap text-[13px] text-[color:var(--ink-soft)]">{c.admissionDate ? formatDate(c.admissionDate) : "—"}</span>
                <span className="justify-self-end"><span className="inline-flex h-[30px] items-center rounded-full bg-[color:var(--brand)] px-4 text-[12px] text-white">Fill claim form</span></span>
              </div>
            ))}
          </DataTable>
        </div>
      </div>
    </>
  );
}
