"use client";

/**
 * The patient list beside the detail view: search, quick filters, and one compact row per
 * patient. It lives in the /patients layout, so it stays mounted (scroll position, search,
 * filter) while you move between patients. Rows are memoised: picking a patient re-renders
 * only the row that lost the highlight and the row that gained it.
 */
import { memo, useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { useList } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import { PatientIdCardModal } from "@/components/shared/PatientIdCardModal";
import type { PatientDTO } from "@/types/api";

const FILTER_IDS = ["All", "Today", "Completed", "Cancelled"] as const;

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
        selected ? "bg-[#e8f7f7] border-[#9fd8d9]" : "border-transparent hover:bg-[#f6f6f6]"
      }`}
    >
      <div className="w-8 h-8 rounded-full bg-[#e8f7f7] text-[#009598] flex items-center justify-center text-[11px] font-medium shrink-0">
        {initialsOf(patient.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-[#11111c] truncate">{patient.name}</div>
        <div className="text-[12px] font-light text-[#57575f] truncate">
          {patient.patientId} · {patient.gender?.[0]} · {patient.age}y
        </div>
      </div>
      <RowMenu actions={actions} />
    </div>
  );
});

export function PatientListPane({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { id: selectedParam } = useParams<{ id?: string }>();
  const selectedId = selectedParam ? Number(selectedParam) : null;
  const { can } = useAuth();
  const canWrite = can("patients", "write");
  const { items: patients, loading, reload } = useList<PatientDTO>("/patients", { all: true });
  const [filter, setFilter] = useState<(typeof FILTER_IDS)[number]>("All");
  const [search, setSearch] = useState("");
  const [idCardFor, setIdCardFor] = useState<PatientDTO | null>(null);
  const { dialog, remove } = useRowActions("patients", reload);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of patients) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [patients]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients
      .filter(p => (filter === "All" || p.status === filter) &&
        (!q || p.name.toLowerCase().includes(q) || (p.patientId ?? "").toLowerCase().includes(q) || p.phone.includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [patients, filter, search]);

  const open = useCallback((id: number) => router.push(`/patients/${id}`), [router]);
  const askDelete = useCallback((p: PatientDTO) => {
    remove(p.id, p.name);
  }, [remove]);

  return (
    <aside className={`flex flex-col bg-white border-r border-[#dedee1] min-h-0 ${className}`}>
      {dialog}
      {idCardFor && <PatientIdCardModal patient={idCardFor} onClose={() => setIdCardFor(null)} />}

      <div className="px-4 pt-4 pb-3 flex flex-col gap-3 border-b border-[#f0f0f0]">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-medium text-[#11111c]">Patients</h2>
          <span className="text-[12px] font-mono text-[#57575f]">{patients.length}</span>
        </div>
        <label className="flex items-center gap-2 h-[38px] px-3 bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] focus-within:border-[#009598] focus-within:bg-white transition-colors">
          <Search size={15} strokeWidth={1.5} className="text-[#57575f] shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, mobile, ID…"
            className="flex-1 min-w-0 bg-transparent text-[13px] text-[#11111c] placeholder:text-[#57575f] placeholder:opacity-60 focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {FILTER_IDS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-[4px] rounded-full text-[12px] border transition-colors cursor-pointer ${
                filter === f ? "bg-[#e8f7f7] border-[#9fd8d9] text-[#009598]" : "border-[#dedee1] text-[#57575f] hover:bg-[#f6f6f6]"
              }`}>
              {f === "All" ? "All" : `${f} (${counts[f] ?? 0})`}
            </button>
          ))}
        </div>
        {canWrite && (
          <Link href="/patients/new"
            className="inline-flex items-center justify-center gap-2 h-[38px] rounded-[8px] bg-[#009598] text-white text-[13px] hover:bg-[#007f82] transition-colors">
            <Plus size={15} /> New patient
          </Link>
        )}
      </div>

      <div role="listbox" aria-label="Patients" className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-[2px]">
        {loading && patients.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-[#57575f]">Loading patients…</div>
        ) : visible.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-[#57575f]">No patients found.</div>
        ) : (
          visible.map(p => (
            <PatientListRow key={p.id} patient={p} selected={p.id === selectedId}
              canWrite={canWrite} onOpen={open} onCard={setIdCardFor} onDelete={askDelete} />
          ))
        )}
      </div>
    </aside>
  );
}
