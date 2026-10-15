"use client";

import { useMemo, useState } from "react";
import { Search, FileText, Upload, ScanLine, CalendarDays } from "lucide-react";
import { formatDate, parseDisplayDate, inDateRange, DATE_RANGES, type DateRangeId } from "@/lib/dates";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import { PriorityBadge, PRIORITIES, PRIORITY_RANK } from "@/components/radiology/PriorityBadge";
import type { RadiologyTestDTO } from "@/types/api";
import type { RadiologyPriority, RadiologyStatus } from "@/types";

/** The worklist reads in radiology terms; the stored status names stay as they are. */
const STATUS_LABEL: Record<RadiologyStatus, string> = {
  "Pending": "Ordered",
  "Scan Done": "Scanned",
  "Report Ready": "Published",
  "Cancelled": "Cancelled",
};
const STATUS_STYLE: Record<RadiologyStatus, string> = {
  "Pending": "text-[color:var(--ink)]",
  "Scan Done": "bg-[#e8f1ff] text-[#0a5fc4]",
  "Report Ready": "bg-[#dffff3] text-[#0b7a47]",
  "Cancelled": "bg-[#ffe9e9] text-[#c8001a]",
};
const STATUS_CHIPS: (RadiologyStatus | "All")[] = ["All", "Pending", "Scan Done", "Report Ready", "Cancelled"];

const MODALITIES = ["X-Ray (XR)", "Ultrasound (USG)", "CT Scan (CT)", "MRI", "Mammography", "DEXA"] as const;

export function modalityOf(testName: string): string {
  const n = testName.toLowerCase();
  if (/x-?ray/.test(n)) return "X-Ray (XR)";
  if (/ultrasound|usg|doppler/.test(n)) return "Ultrasound (USG)";
  if (/\bct\b/.test(n)) return "CT Scan (CT)";
  if (/mri/.test(n)) return "MRI";
  if (/mammo/.test(n)) return "Mammography";
  if (/dexa|bone density/.test(n)) return "DEXA";
  return "Other";
}

type SortId = "priority" | "newest" | "oldest" | "patient";
const SORTS: { id: SortId; label: string }[] = [
  { id: "priority", label: "STAT first, then oldest" },
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "patient", label: "Patient A–Z" },
];

/** Whole days a study has been waiting, for studies that are still open. */
function overdueDays(t: RadiologyTestDTO): number {
  if (t.status === "Report Ready" || t.status === "Cancelled") return 0;
  const d = parseDisplayDate(t.date);
  if (!d) return 0;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.max(0, Math.floor((start - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000));
}

function sortTests(list: RadiologyTestDTO[], sort: SortId): RadiologyTestDTO[] {
  const byDate = (a: RadiologyTestDTO, b: RadiologyTestDTO) => a.date.localeCompare(b.date) || a.id - b.id;
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

export function RadiologyWorklist({
  tests,
  canWrite,
  canUpload,
  canDelete,
  showHospital,
  onViewPatient,
  onViewReport,
  onUpload,
  onMarkScanned,
  onSetPriority,
  onCancel,
  onDelete,
}: {
  tests: RadiologyTestDTO[];
  canWrite: boolean;
  canUpload: boolean;
  canDelete: boolean;
  showHospital: boolean;
  onViewPatient: (t: RadiologyTestDTO) => void;
  onViewReport: (t: RadiologyTestDTO) => void;
  onUpload: (t: RadiologyTestDTO) => void;
  onMarkScanned: (t: RadiologyTestDTO) => void;
  onSetPriority: (t: RadiologyTestDTO, p: RadiologyPriority) => void;
  onCancel: (t: RadiologyTestDTO) => void;
  onDelete: (t: RadiologyTestDTO) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RadiologyStatus | "All">("All");
  const [priority, setPriority] = useState<RadiologyPriority | "All">("All");
  const [modality, setModality] = useState("All");
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
  const fits = (t: RadiologyTestDTO, skip: "status" | "modality" | "priority") =>
    (skip === "status" || status === "All" || t.status === status) &&
    (skip === "modality" || modality === "All" || modalityOf(t.testName) === modality) &&
    (skip === "priority" || priority === "All" || t.priority === priority);

  const statusCount = (s: RadiologyStatus | "All") =>
    base.filter((t) => fits(t, "status") && (s === "All" || t.status === s)).length;
  const modalityCount = (m: string) =>
    base.filter((t) => fits(t, "modality") && (m === "All" || modalityOf(t.testName) === m)).length;
  const priorityCount = (p: RadiologyPriority | "All") =>
    base.filter((t) => fits(t, "priority") && (p === "All" || t.priority === p)).length;

  const modalities = ["All", ...MODALITIES, ...(tests.some((t) => modalityOf(t.testName) === "Other") ? ["Other"] : [])];
  const visible = sortTests(base.filter((t) => fits(t, "status") && fits(t, "modality") && fits(t, "priority")), sort);

  return (
    <div>
      <div className="flex flex-col gap-3 px-5 pt-4 pb-3 border-b border-[color:var(--line)]">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-[280px] max-w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient, UHID, order or study…"
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
            <label className="relative flex items-center">
              <CalendarDays size={14} className="absolute left-3 text-[color:var(--ink-soft)] pointer-events-none" />
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as DateRangeId)}
                aria-label="Date range"
                className="h-[36px] rounded-full bg-[color:var(--surface)] border border-[color:var(--line)] pl-[32px] pr-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] cursor-pointer"
              >
                {DATE_RANGES.map((r) => <option key={r.id} value={r.id}>{r.id === "all" ? "All dates" : r.label}</option>)}
              </select>
            </label>
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
          {(["All", ...[...PRIORITIES].reverse()] as (RadiologyPriority | "All")[]).map((p) => (
            <button key={p} aria-pressed={priority === p} onClick={() => setPriority(p)} className={chip(priority === p)}>
              {p === "All" ? "Any priority" : p}
              <span className={`font-mono text-[11px] ${priority === p ? "text-white/80" : "text-[color:var(--ink-soft)]"}`}>{priorityCount(p)}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter by modality">
          {modalities.map((m) => (
            <button key={m} aria-pressed={modality === m} onClick={() => setModality(m)} className={chip(modality === m)}>
              {m === "All" ? "All modalities" : m}
              {m !== "All" && <span className={`font-mono text-[11px] ${modality === m ? "text-white/80" : "text-[color:var(--ink-soft)]"}`}>{modalityCount(m)}</span>}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">No studies match these filters.</div>
      ) : (
        <ul>
          {visible.map((t) => {
            const late = overdueDays(t);
            const open = t.status === "Pending" || t.status === "Scan Done";
            const menu: RowAction[] = [
              ...PRIORITIES.filter((p) => p !== t.priority).map((p) => ({
                label: `Mark as ${p}`,
                disabled: !canWrite || !open,
                onClick: () => onSetPriority(t, p),
              })),
              { label: "View patient", onClick: () => onViewPatient(t) },
              { label: "Cancel study", disabled: !canWrite || !open, onClick: () => onCancel(t) },
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
                    {modalityOf(t.testName)} · {t.testName}
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
                    <button onClick={() => onMarkScanned(t)} className="inline-flex items-center gap-[6px] h-[32px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px] text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer whitespace-nowrap">
                      <ScanLine size={14} /> Mark scanned
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
