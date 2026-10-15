"use client";

/**
 * The patient list beside the detail view: search, quick filters, and one compact row per
 * patient. It loads a page at a time and fetches the next page when you scroll to the bottom —
 * search and filters are applied by the server, so they cover every patient, not just the ones
 * already loaded. It lives in the /patients layout, so it stays mounted (scroll position, search,
 * filter) while you move between patients. Rows are memoised: picking a patient re-renders only
 * the row that lost the highlight and the row that gained it.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Search } from "lucide-react";
import { useInfiniteList, useItem } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api/client";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import { PatientIdCardModal } from "@/components/shared/PatientIdCardModal";
import type { PatientDTO } from "@/types/api";

const FILTER_IDS = ["All", "Today", "Completed", "Cancelled"] as const;
const PAGE_SIZE = 40;

interface PatientSummary { total: number; Today: number; Upcoming: number; Completed: number; Cancelled: number }

const initialsOf = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

const PatientListRow = memo(function PatientListRow({
  patient, selected, canWrite, onOpen, onCard, onDelete,
}: {
  patient: PatientDTO;
  selected: boolean;
  canWrite: boolean;
  onOpen: (id: number) => void;
  onCard: (p: PatientDTO) => void;
  onDelete: (p: PatientDTO) => void;
}) {
  const actions = useMemo<RowAction[]>(() => [
    { label: "Print ID card", onClick: () => onCard(patient) },
    ...(canWrite ? [{ label: "Delete", danger: true, onClick: () => onDelete(patient) }] : []),
  ], [patient, canWrite, onCard, onDelete]);

  return (
    <div
      role="option"
      aria-selected={selected}
      onClick={() => onOpen(patient.id)}
      className={`flex items-center gap-3 px-3 py-[10px] rounded-[8px] cursor-pointer border transition-colors ${
        selected ? "bg-[color:var(--brand-soft)] border-[color:var(--brand-ring)]" : "border-transparent hover:bg-[color:var(--subtle)]"
      }`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0 transition-colors ${
        selected ? "bg-[color:var(--brand)] text-white ring-2 ring-[color:var(--brand-ring)]" : "bg-[color:var(--brand-soft)] text-[color:var(--brand)]"
      }`}>
        {initialsOf(patient.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-[color:var(--ink)] truncate">{patient.name}</div>
        <div className="text-[12px] font-light text-[color:var(--ink-soft)] truncate">
          {patient.patientId} · {patient.gender?.[0]} · {patient.age}y
        </div>
      </div>
      <RowMenu actions={actions} compact />
    </div>
  );
});

export function PatientListPane({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { id: selectedParam } = useParams<{ id?: string }>();
  const selectedId = selectedParam ? Number(selectedParam) : null;
  const { can } = useAuth();
  const canWrite = can("patients", "write");

  const [filter, setFilter] = useState<(typeof FILTER_IDS)[number]>("All");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [idCardFor, setIdCardFor] = useState<PatientDTO | null>(null);

  // Typing is instant; the server is asked once the user pauses.
  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = useMemo(
    () => ({ sort: "name:asc", ...(term ? { search: term } : {}), ...(filter !== "All" ? { status: filter } : {}) }),
    [term, filter],
  );
  const { items: patients, total, loading, loadingMore, hasMore, error, loadMore, reload } = useInfiniteList<PatientDTO>("/patients", params, PAGE_SIZE);
  const { item: summary } = useItem<PatientSummary>("/patients/summary");
  const { dialog, ask } = useRowActions("patients", reload);

  // ── Infinite scroll: when the bottom marker comes into view, fetch the next page ──
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = listRef.current;
    const end = endRef.current;
    if (!root || !end || !hasMore) return;
    const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) loadMore(); }, { root, rootMargin: "240px" });
    io.observe(end);
    // Re-created whenever rows are added, so a short page that still leaves the marker in view keeps loading.
    return () => io.disconnect();
  }, [hasMore, loadMore, patients.length]);

  // A new search or filter starts from the top.
  const paramsKey = `${term}|${filter}`;
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = 0; }, [paramsKey]);

  const open = useCallback((id: number) => router.push(`/patients/${id}`), [router]);
  const askDelete = useCallback((p: PatientDTO) => {
    ask({
      title: "Delete record",
      message: `Delete ${p.name}? This action cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
      action: async () => {
        await api.del(`/patients/${p.id}`);
        if (selectedId === p.id) router.push("/patients"); // don't leave a deleted patient on screen
      },
    });
  }, [ask, router, selectedId]);

  return (
    <aside className={`flex flex-col bg-[color:var(--surface)] border-r border-[color:var(--line)] min-h-0 ${className}`}>
      {dialog}
      {idCardFor && <PatientIdCardModal patient={idCardFor} onClose={() => setIdCardFor(null)} />}

      <div className="px-4 pt-4 pb-3 flex flex-col gap-3 border-b border-[color:var(--subtle-2)]">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-medium text-[color:var(--ink)]">Patients</h2>
          <span className="text-[12px] font-mono text-[color:var(--ink-soft)]" title="Patients matching the search and filter">{loading ? "…" : total}</span>
        </div>
        <label className="flex items-center gap-2 h-[38px] px-3 bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] focus-within:border-[color:var(--brand)] focus-within:bg-[color:var(--surface)] transition-colors">
          <Search size={15} strokeWidth={1.5} className="text-[color:var(--ink-soft)] shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, mobile, ID…"
            className="flex-1 min-w-0 bg-transparent text-[13px] text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] placeholder:opacity-60 focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {FILTER_IDS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-[4px] rounded-full text-[12px] border transition-colors cursor-pointer ${
                filter === f ? "bg-[color:var(--brand-soft)] border-[color:var(--brand-ring)] text-[color:var(--brand)]" : "border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]"
              }`}>
              {f === "All" ? "All" : `${f}${summary ? ` (${summary[f]})` : ""}`}
            </button>
          ))}
        </div>
        {canWrite && (
          <Link href="/patients/new"
            className="inline-flex items-center justify-center gap-2 h-[38px] rounded-[8px] bg-[color:var(--brand)] text-white text-[13px] hover:bg-[color:var(--brand-hover)] transition-colors">
            <Plus size={15} /> New patient
          </Link>
        )}
      </div>

      <div ref={listRef} role="listbox" aria-label="Patients" className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-[2px]">
        {loading ? (
          <div className="py-10 flex flex-col items-center gap-2 text-[13px] text-[color:var(--ink-soft)]">
            <Loader2 size={20} className="animate-spin text-[color:var(--brand)]" /> {term || filter !== "All" ? "Searching…" : "Loading patients…"}
          </div>
        ) : error && patients.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-[#ff0004]">
            Couldn&apos;t load patients. <button onClick={reload} className="underline cursor-pointer">Try again</button>
          </div>
        ) : patients.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-[color:var(--ink-soft)]">{term || filter !== "All" ? "No patients match." : "No patients found."}</div>
        ) : (
          <>
            {patients.map(p => (
              <PatientListRow key={p.id} patient={p} selected={p.id === selectedId}
                canWrite={canWrite} onOpen={open} onCard={setIdCardFor} onDelete={askDelete} />
            ))}
            <div ref={endRef} className="py-3 text-center text-[12px] text-[color:var(--ink-soft)]">
              {loadingMore ? (
                <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin text-[color:var(--brand)]" /> Loading more…</span>
              ) : error ? (
                <button onClick={loadMore} className="text-[#ff0004] underline cursor-pointer">Couldn&apos;t load more — try again</button>
              ) : hasMore ? null : patients.length > 12 ? (
                <span>All {total} loaded</span>
              ) : null}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
