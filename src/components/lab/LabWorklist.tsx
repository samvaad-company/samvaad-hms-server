"use client";

import { useMemo, useState } from "react";
import { Search, FileText, Upload, TestTube, CalendarDays } from "lucide-react";
import { formatDate, parseDisplayDate, inDateRange, DATE_RANGES, type DateRangeId } from "@/lib/dates";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import { PriorityBadge, PRIORITIES, PRIORITY_RANK } from "@/components/shared/PriorityBadge";
import type { LabTestDTO } from "@/types/api";
import type { LabPriority, LabStatus } from "@/types";

/** The worklist reads in laboratory terms; the stored status names stay as they are. */
const STATUS_LABEL: Record<LabStatus, string> = {
  "Pending": "Ordered",
  "Sample Collected": "Sample collected",
  "Report Ready": "Published",
  "Cancelled": "Cancelled",
};
const STATUS_STYLE: Record<LabStatus, string> = {
  "Pending": "text-[color:var(--ink)]",
  "Sample Collected": "bg-[#e8f1ff] text-[#0a5fc4]",
  "Report Ready": "bg-[#dffff3] text-[#0b7a47]",
  "Cancelled": "bg-[#ffe9e9] text-[#c8001a]",
};
const STATUS_CHIPS: (LabStatus | "All")[] = ["All", "Pending", "Sample Collected", "Report Ready", "Cancelled"];

const CATEGORIES = ["Haematology", "Biochemistry", "Microbiology", "Immunology", "Urology", "Pathology", "Coagulation", "Cardiology"] as const;

/** The section of the lab a test belongs to, read from its name (tests carry no category of their own). */
export function labCategoryOf(testName: string): string {
  const n = testName.toLowerCase();
  if (/culture|sensitivity|gram stain|afb|sputum/.test(n)) return "Microbiology";
  if (/\bpt\b|\binr\b|aptt|coagulation|d-dimer/.test(n)) return "Coagulation";
  if (/cbc|blood count|haemoglobin|hemoglobin|\bhb\b|\besr\b|platelet|blood group|peripheral smear|haemato|hemato/.test(n)) return "Haematology";
  if (/urine|urinalysis|micro ?albumin/.test(n)) return "Urology";
  if (/stool|biopsy|histopath|cytology|\bfnac\b|pap smear/.test(n)) return "Pathology";
  if (/ige|allerg|hiv|hepatitis|hbsag|dengue|widal|malaria|serolog|crp|rheumatoid|\bana\b|vdrl/.test(n)) return "Immunology";
  if (/ecg|echo|tmt|stress test|holter/.test(n)) return "Cardiology";
  if (/sugar|glucose|hba1c|lipid|cholesterol|liver|lft|kidney|kft|renal|thyroid|tsh|\bt3\b|\bt4\b|creatinine|urea|electrolyte|sodium|potassium|vitamin|calcium|uric|bilirubin|enzyme|biochem/.test(n)) return "Biochemistry";
  return "Other";
}

type SortId = "priority" | "newest" | "oldest" | "patient";
const SORTS: { id: SortId; label: string }[] = [
  { id: "priority", label: "STAT first, then oldest" },
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "patient", label: "Patient A–Z" },
];

/** Whole days a test has been waiting, for tests that are still open. */
function overdueDays(t: LabTestDTO): number {
  if (t.status === "Report Ready" || t.status === "Cancelled") return 0;
  const d = parseDisplayDate(t.date);
  if (!d) return 0;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.max(0, Math.floor((start - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000));
}

function sortTests(list: LabTestDTO[], sort: SortId): LabTestDTO[] {
  const byDate = (a: LabTestDTO, b: LabTestDTO) => a.date.localeCompare(b.date) || a.id - b.id;
  const out = [...list];
  if (sort === "newest") out.sort((a, b) => byDate(b, a));
  else if (sort === "oldest") out.sort(byDate);
  else if (sort === "patient") out.sort((a, b) => a.patientName.localeCompare(b.patientName) || byDate(a, b));
  else out.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byDate(a, b));
  return out;
}

const chip = (active: boolean) =>
  `inline-flex items-center gap-[6px] rounded-full border px-[12px] py-[5px] text-[12px] font-normal whitespace-nowrap cursor-pointer transition-colors ${
    active
      ? "bg-[color:var(--brand)] border-[color:var(--brand)] text-white"
      : "bg-[color:var(--surface)] border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"
  }`;

export function LabWorklist({
  tests,
  canWrite,
  canUpload,
  canDelete,
  showHospital,
  onViewPatient,
  onViewReport,
  onUpload,
  onCollectSample,
  onPrintBarcode,
  onSetPriority,
  onCancel,
  onDelete,
  showDateRange = true,
}: {
  tests: LabTestDTO[];
  canWrite: boolean;
  canUpload: boolean;
  canDelete: boolean;
  showHospital: boolean;
  onViewPatient: (t: LabTestDTO) => void;
  onViewReport: (t: LabTestDTO) => void;
  onUpload: (t: LabTestDTO) => void;
  onCollectSample: (t: LabTestDTO) => void;
  /** Optional: when given, the row menu offers to print the sample barcode. */
  onPrintBarcode?: (t: LabTestDTO) => void;
  onSetPriority: (t: LabTestDTO, p: LabPriority) => void;
  onCancel: (t: LabTestDTO) => void;
  onDelete: (t: LabTestDTO) => void;
  /** Off when the page already has a date range of its own that applies to the tests passed in. */
  showDateRange?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LabStatus | "All">("All");
  const [priority, setPriority] = useState<LabPriority | "All">("All");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState<SortId>("priority");
  const [range, setRange] = useState<DateRangeId>("all");

  const q = search.trim().toLowerCase();
  // Each chip row counts what is left after the *other* filters, so a count always matches what clicking it shows.
  const base = useMemo(
    () =>
      tests.filter(
        (t) =>
          inDateRange(t.date, range) &&
          (!q ||
            t.patientName.toLowerCase().includes(q) ||
            t.testName.toLowerCase().includes(q) ||
            t.orderNumber.toLowerCase().includes(q) ||
            (t.patientCode ?? "").toLowerCase().includes(q)),
      ),
    [tests, q, range],
  );
  const fits = (t: LabTestDTO, skip: "status" | "category" | "priority") =>
    (skip === "status" || status === "All" || t.status === status) &&
    (skip === "category" || category === "All" || labCategoryOf(t.testName) === category) &&
    (skip === "priority" || priority === "All" || t.priority === priority);

  const statusCount = (s: LabStatus | "All") =>
    base.filter((t) => fits(t, "status") && (s === "All" || t.status === s)).length;
  const categoryCount = (m: string) =>
    base.filter((t) => fits(t, "category") && (m === "All" || labCategoryOf(t.testName) === m)).length;
  const priorityCount = (p: LabPriority | "All") =>
    base.filter((t) => fits(t, "priority") && (p === "All" || t.priority === p)).length;

  const categories = ["All", ...CATEGORIES.filter((c) => tests.some((t) => labCategoryOf(t.testName) === c)), ...(tests.some((t) => labCategoryOf(t.testName) === "Other") ? ["Other"] : [])];
  const visible = sortTests(base.filter((t) => fits(t, "status") && fits(t, "category") && fits(t, "priority")), sort);

  return (
    <div>
      <div className="flex flex-col gap-3 px-5 pt-4 pb-3 border-b border-[color:var(--line)]">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-[280px] max-w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient, UHID, order or test…"
              className="h-[36px] w-full rounded-full bg-[color:var(--surface)] border border-[color:var(--line)] pl-[34px] pr-3 text-[13px] text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] focus:outline-none focus:border-[color:var(--brand)]"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortId)}
              aria-label="Sort worklist"
              className="h-[36px] rounded-full bg-[color:var(--surface)] border border-[color:var(--line)] px-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] cursor-pointer"
            >
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            {showDateRange && <label className="relative flex items-center">
              <CalendarDays size={14} className="absolute left-3 text-[color:var(--ink-soft)] pointer-events-none" />
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as DateRangeId)}
                aria-label="Date range"
                className="h-[36px] rounded-full bg-[color:var(--surface)] border border-[color:var(--line)] pl-[32px] pr-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] cursor-pointer"
              >
                {DATE_RANGES.map((r) => <option key={r.id} value={r.id}>{r.id === "all" ? "All dates" : r.label}</option>)}
              </select>
            </label>}
            <span className="font-mono text-[12px] text-[color:var(--ink-soft)] whitespace-nowrap">
              {visible.length} of {tests.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter by status">
          {STATUS_CHIPS.map((s) => (
            <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)} className={chip(status === s)}>
              {s === "All" ? "All" : STATUS_LABEL[s]}
              <span className={`font-mono text-[11px] ${status === s ? "text-white/80" : "text-[color:var(--ink-soft)]"}`}>{statusCount(s)}</span>
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-[color:var(--line)]" />
          {(["All", ...[...PRIORITIES].reverse()] as (LabPriority | "All")[]).map((p) => (
            <button key={p} aria-pressed={priority === p} onClick={() => setPriority(p)} className={chip(priority === p)}>
              {p === "All" ? "Any priority" : p}
              <span className={`font-mono text-[11px] ${priority === p ? "text-white/80" : "text-[color:var(--ink-soft)]"}`}>{priorityCount(p)}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter by category">
          {categories.map((m) => (
            <button key={m} aria-pressed={category === m} onClick={() => setCategory(m)} className={chip(category === m)}>
              {m === "All" ? "All categories" : m}
              {m !== "All" && <span className={`font-mono text-[11px] ${category === m ? "text-white/80" : "text-[color:var(--ink-soft)]"}`}>{categoryCount(m)}</span>}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">No tests match these filters.</div>
      ) : (
        <ul>
          {visible.map((t) => {
            const late = overdueDays(t);
            const open = t.status === "Pending" || t.status === "Sample Collected";
            const menu: RowAction[] = [
              ...PRIORITIES.filter((p) => p !== t.priority).map((p) => ({
                label: `Mark as ${p}`,
                disabled: !canWrite || !open,
                onClick: () => onSetPriority(t, p),
              })),
              { label: "View patient", onClick: () => onViewPatient(t) },
              ...(onPrintBarcode && open ? [{ label: "Print sample barcode", onClick: () => onPrintBarcode(t) }] : []),
              { label: "Cancel test", disabled: !canWrite || !open, onClick: () => onCancel(t) },
              ...(canDelete ? [{ label: "Delete", danger: true, onClick: () => onDelete(t) }] : []),
            ];
            return (
              <li
                key={t.id}
                className={`flex items-center gap-4 px-5 py-[10px] border-b border-[color:var(--line)] last:border-b-0 ${
                  t.priority === "STAT" && open ? "bg-[#fffbee] dark:bg-[#2a2412]" : ""
                }`}
              >
                <span className="w-[104px] shrink-0 font-mono text-[12px] text-[color:var(--ink-soft)]">{t.orderNumber || `#${t.id}`}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <button onClick={() => onViewPatient(t)} className="truncate text-[15px] font-medium text-[color:var(--ink)] hover:text-[color:var(--brand)] cursor-pointer text-left">
                      {t.patientName}
                    </button>
                    {t.patientCode && <span className="font-mono text-[12px] text-[color:var(--ink-soft)] shrink-0">{t.patientCode}</span>}
                  </div>
                  <p className="truncate text-[12px] text-[color:var(--ink-soft)]">
                    {labCategoryOf(t.testName)} · {t.testName}
                    {t.doctor && <> · Dr. {t.doctor.replace(/^Dr\.?\s*/i, "")}</>}
                    {showHospital && t.hospitalName && <> · {t.hospitalName}</>}
                    {" · "}{formatDate(t.date)}
                    {late > 0 && <span className="text-[#c8001a]"> · overdue {late}d</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <PriorityBadge priority={t.priority} />
                  <span className={`inline-flex rounded-full px-[10px] py-[2px] text-[12px] leading-[16px] ${STATUS_STYLE[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                  {t.status === "Pending" && canWrite && (
                    <button onClick={() => onCollectSample(t)} className="inline-flex items-center gap-[6px] h-[32px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px] text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer whitespace-nowrap">
                      <TestTube size={14} /> Collect sample
                    </button>
                  )}
                  {t.hasReport ? (
                    <button onClick={() => onViewReport(t)} className="inline-flex items-center gap-[6px] h-[32px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px] text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer whitespace-nowrap">
                      <FileText size={14} /> Report
                    </button>
                  ) : canUpload && t.status !== "Cancelled" ? (
                    <button onClick={() => onUpload(t)} className="inline-flex items-center gap-[6px] h-[32px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px] text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer whitespace-nowrap">
                      <Upload size={14} /> Upload
                    </button>
                  ) : null}
                  <RowMenu actions={menu} compact />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
