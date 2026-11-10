"use client";

/** IPD case files: pick an admitted patient to open the sheets kept with them (progress notes, treatment sheet, charts…). */
import { useMemo, useState } from "react";
import Link from "next/link";
import { FolderOpen, Search } from "lucide-react";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { useItem } from "@/lib/api/hooks";
import { PageHeader } from "@/components/shared/PageHeader";
import { TabBar } from "@/components/shared/TabBar";
import { PatientName } from "@/components/loyalty/PatientName";
import type { CaseFileListItemDTO } from "@/types/casefile";

export default function CaseFilesPage() {
  const [tab, setTab] = useState("Admitted");
  const [search, setSearch] = useState("");
  const { item, loading, error } = useItem<CaseFileListItemDTO[]>(`/casefile?status=${tab === "All" ? "all" : tab}`);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (item ?? []).filter((r) => !q || `${r.patientName} ${r.uhid} ${r.ipdNo} ${r.bed} ${r.ward} ${r.doctor}`.toLowerCase().includes(q));
  }, [item, search]);

  return (
    <>
      <PageHeader title="Case files" subtitle="The sheets kept with each admitted patient: progress notes, treatment sheet, charts, handover and the admission history."
        stats={[{ icon: FolderOpen, value: String((item ?? []).length), label: tab === "All" ? "Case files" : tab }]} dateRange={false} />
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 360 }}>
          <TabBar tabs={[{ id: "Admitted", label: "Admitted" }, { id: "Discharged", label: "Discharged" }, { id: "All", label: "All" }]} activeTab={tab} onTabChange={setTab} />
          <div className="flex items-center gap-2 border-b border-[color:var(--subtle-2)] px-4 py-3">
            <div className="relative w-full max-w-[360px]">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient, UHID, IPD no., bed or doctor…" aria-label="Search case files"
                className="h-[38px] w-full rounded-full border border-[color:var(--line)] bg-[color:var(--subtle)] pl-8 pr-3 text-[13px] focus:border-[color:var(--brand)] focus:outline-none" />
            </div>
          </div>
          {error && <p className="m-4 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
          {loading && !item && <p className="py-12 text-center text-[14px] text-[color:var(--ink-soft)]">Loading…</p>}
          {item && rows.length === 0 && <p className="py-12 text-center text-[14px] text-[color:var(--ink-soft)]">{item.length === 0 ? `No ${tab === "All" ? "" : tab.toLowerCase() + " "}patients yet.` : "Nothing matches your search."}</p>}
          <ul className="divide-y divide-[color:var(--subtle-2)]">
            {rows.map((r) => (
              <li key={r.admissionId}>
                <Link href={`/case-files/${r.admissionId}`} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 hover:bg-[color:var(--subtle)]">
                  <div className="min-w-[200px] flex-1">
                    <p className="text-[14px] font-medium text-[color:var(--ink)]"><PatientName id={r.patientId} name={r.patientName} /></p>
                    <p className="text-[12px] text-[color:var(--ink-soft)]">{[r.uhid, r.ipdNo, r.age ? `${r.age} yrs` : ""].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="min-w-[150px] text-[13px] text-[color:var(--ink)]">
                    <p>{[r.ward, r.bed].filter(Boolean).join(" · ") || "No bed"}</p>
                    <p className="text-[12px] text-[color:var(--ink-soft)]">{r.doctor}</p>
                  </div>
                  <div className="min-w-[110px] text-[12px] text-[color:var(--ink-soft)]">Admitted {formatDate(r.admittedOn)}{r.status === "Discharged" && <span className="ml-1 rounded-full bg-[color:var(--subtle)] px-2">Discharged</span>}</div>
                  <div className="w-[150px]" title={`${r.filled} of ${r.total} forms have something written in them`}>
                    <p className="text-[12px] text-[color:var(--ink-soft)]">{r.filled} of {r.total} forms</p>
                    <div className="mt-1 h-[6px] overflow-hidden rounded-full bg-[color:var(--subtle)]"><div className="h-full rounded-full bg-[color:var(--brand)]" style={{ width: `${(r.filled / r.total) * 100}%` }} /></div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
