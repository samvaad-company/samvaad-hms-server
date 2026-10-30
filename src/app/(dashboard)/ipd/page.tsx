"use client";

/**
 * Inpatients: everyone in hospital with their bed, doctor and nurse, how long they have been in, and what is
 * happening right now (doses, drips, whether the doctor has seen them today). Admit from the button at the top.
 */
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, BedDouble, Droplets, Pill, Scale, UserRound, UserX, Plus, Search, BellRing } from "lucide-react";
import { tw } from "@/lib/design-system";
import { api } from "@/lib/api/client";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { useRowActions } from "@/lib/api/useRowActions";
import { useHydrated } from "@/lib/use-hydrated";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import { DataTable } from "@/components/shared/DataTable";
import { usePagination } from "@/components/shared/Pagination";
import { Modal } from "@/components/shared/Modal";
import { done } from "@/components/ipd/nurse/shared";
import { FormRow, FormSelect, FormTextarea } from "@/components/shared/FormRow";
import { AdmitDialog } from "@/components/ipd/AdmitDialog";
import type { IpdBoardDTO, IpdLiveDTO, IpdRecordDTO, StaffDTO, WardDTO } from "@/types/api";

const COLUMNS = [
  { label: "Bed", width: "120px" },
  { label: "Patient", width: "minmax(220px,1.6fr)" },
  { label: "Doctor & nurses", width: "minmax(170px,1.1fr)" },
  { label: "Stay", width: "110px" },
  { label: "Right now", width: "minmax(170px,1fr)" },
  { label: "", width: "40px", align: "right" as const },
];
const MIN_WIDTH = 900;

type Tab = "admitted" | "discharged" | "all";
type Sort = "stay" | "newest" | "bed" | "patient";
const SORTS: { id: Sort; label: string }[] = [
  { id: "stay", label: "Longest stay" },
  { id: "newest", label: "Newest admission" },
  { id: "bed", label: "Bed" },
  { id: "patient", label: "Patient A–Z" },
];

/** In hospital this many days or more needs a second look — a long stay is a cost and a risk. */
const LONG_STAY_DAYS = 10;

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
const initial = (g: string) => (g ? g[0].toUpperCase() : "");

const chip = (active: boolean) =>
  `inline-flex items-center gap-[6px] h-[30px] px-3 rounded-full border text-[12px] whitespace-nowrap cursor-pointer transition-colors ${
    active
      ? "bg-[color:var(--ink)] border-[color:var(--ink)] text-[color:var(--surface)]"
      : "bg-[color:var(--surface)] border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"
  }`;

/** What matters about a patient this minute, most urgent first. */
function rightNow(r: IpdRecordDTO, live: IpdLiveDTO | undefined): { text: string; tone: "bad" | "warn" | "ok" | "muted"; sub?: string } {
  if (r.status === "Discharged") return { text: "Discharged", tone: "muted" };
  if (!live) return { text: "—", tone: "muted" };
  if (live.dosesMissed > 0) return { text: `${live.dosesMissed} ${live.dosesMissed === 1 ? "dose" : "doses"} missed`, tone: "bad", sub: live.seenToday ? undefined : "Not seen today" };
  if (live.dosesDue > 0) return { text: `${live.dosesDue} ${live.dosesDue === 1 ? "dose" : "doses"} due`, tone: "warn" };
  if (live.ivRunning > 0) return { text: "IV running", tone: "ok", sub: live.seenToday ? undefined : "Not seen today" };
  if (live.seenToday) return { text: `Seen today${live.lastRoundAt ? ` · ${live.lastRoundAt.split(" ").slice(1).join(" ")}` : ""}`, tone: "ok", sub: live.lastRoundBy ?? undefined };
  return { text: "Not seen today", tone: "muted", sub: live.nextDoseAt ? `Next dose ${time(live.nextDoseAt)}` : undefined };
}
const TONE = { bad: "text-[#c8001a] font-medium", warn: "text-[#a35a00] font-medium", ok: "text-[#0b7a47]", muted: "text-[color:var(--ink-soft)]" } as const;

function IpdPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { can } = useAuth();
  const hydrated = useHydrated();
  const canWrite = can("ipd", "write");

  const { items: records, reload } = useList<IpdRecordDTO>("/ipd", { all: true });
  const { item: board, reload: reloadBoard } = useItem<IpdBoardDTO>("/ipd/board");
  const { items: wards } = useList<WardDTO>("/wards");
  const { items: staff } = useList<StaffDTO>("/staff", { all: true });
  const refresh = () => { reload(); reloadBoard(); };
  const { dialog, remove, mutate, ask } = useRowActions("ipd", refresh);

  const [admitOpen, setAdmitOpen] = useState(search.get("admit") === "1");
  const [tab, setTab] = useState<Tab>("admitted");
  const [ward, setWard] = useState("");
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<{ mine: boolean; doses: boolean; iv: boolean; noNurse: boolean; mlc: boolean; longStay: boolean; missed: boolean }>(
    { mine: false, doses: false, iv: false, noNurse: false, mlc: false, longStay: false, missed: false },
  );
  const [sort, setSort] = useState<Sort>("stay");
  const toggle = (k: keyof typeof only) => setOnly((o) => ({ ...o, [k]: !o[k] }));

  const live = useMemo(() => new Map((board?.live ?? []).map((l) => [l.admissionId, l])), [board]);
  const admitted = records.filter((r) => r.status !== "Discharged");
  const discharged = records.filter((r) => r.status === "Discharged");
  const nurses = staff.filter((s) => /nurse/i.test(s.role) && s.status === "Active");
  const wardNames = wards.length ? wards.map((w) => w.name) : [...new Set(records.map((r) => r.ward).filter(Boolean))];

  // Counts on the chips are of what the tab, ward and search already narrowed to, so each matches what clicking it shows.
  const needle = q.trim().toLowerCase();
  const base = records.filter((r) => {
    if (tab === "admitted" && r.status === "Discharged") return false;
    if (tab === "discharged" && r.status !== "Discharged") return false;
    if (ward && r.ward !== ward) return false;
    return !needle || [r.patientName, r.patientId, r.admissionNo, r.doctor, r.diagnosis, r.bed].some((v) => (v ?? "").toLowerCase().includes(needle));
  });
  const L = (r: IpdRecordDTO) => live.get(r.id);
  const checks: Record<string, (r: IpdRecordDTO) => boolean> = {
    mine: (r) => Boolean(L(r)?.mine),
    doses: (r) => (L(r)?.dosesDue ?? 0) > 0 || (L(r)?.dosesMissed ?? 0) > 0,
    iv: (r) => (L(r)?.ivRunning ?? 0) > 0,
    noNurse: (r) => r.status !== "Discharged" && !r.primaryNurseId,
    mlc: (r) => r.isMlc,
    longStay: (r) => r.status !== "Discharged" && (L(r)?.stayDay ?? 0) >= LONG_STAY_DAYS,
    missed: (r) => (L(r)?.dosesMissed ?? 0) > 0,
  };
  const count = (k: keyof typeof only) => base.filter(checks[k]).length;
  const visible = base
    .filter((r) => (Object.keys(only) as (keyof typeof only)[]).every((k) => !only[k] || checks[k](r)))
    .sort((a, b) => {
      if (sort === "newest") return b.admissionDate.localeCompare(a.admissionDate) || b.id - a.id;
      if (sort === "bed") return (a.bed || "~").localeCompare(b.bed || "~", undefined, { numeric: true });
      if (sort === "patient") return a.patientName.localeCompare(b.patientName);
      return a.admissionDate.localeCompare(b.admissionDate) || a.id - b.id;
    });
  const { rows: paged, bar } = usePagination(visible, "admissions");

  // Assign / change the primary nurse.
  const [nurseFor, setNurseFor] = useState<IpdRecordDTO | null>(null);
  const [nurseId, setNurseId] = useState("");
  const { run: runNurse, loading: nurseSaving } = useMutation();
  async function saveNurse() {
    if (!nurseFor) return;
    if (!(await done(runNurse(() => api.patch(`/ipd/${nurseFor.id}`, { primaryNurseId: nurseId ? Number(nurseId) : null }))))) return;
    setNurseFor(null);
    refresh();
  }

  // Quick doctor round from the list.
  const [roundTarget, setRoundTarget] = useState<IpdRecordDTO | null>(null);
  const [findings, setFindings] = useState("");
  const [orders, setOrders] = useState("");
  const { run: runRound, loading: roundSaving } = useMutation();
  async function saveRound() {
    if (!roundTarget) return;
    const content = [findings.trim() && `Findings: ${findings.trim()}`, orders.trim() && `Orders: ${orders.trim()}`].filter(Boolean).join("\n\n");
    if (!content) return;
    if (!(await done(runRound(() => api.post("/ipd/notes", { admissionId: roundTarget.id, noteType: "Doctor Round", content }))))) return;
    setRoundTarget(null);
    setFindings(""); setOrders("");
    refresh();
  }

  const actionsFor = (r: IpdRecordDTO): RowAction[] => [
    { label: "View admission", onClick: () => router.push(`/ipd/${r.id}`) },
    ...(canWrite ? [
      { label: "Add doctor round", disabled: r.status === "Discharged", onClick: () => { setRoundTarget(r); setFindings(""); setOrders(""); } },
      { label: r.primaryNurse ? "Change nurse" : "Assign nurse", disabled: r.status === "Discharged", onClick: () => { setNurseFor(r); setNurseId(r.primaryNurseId ? String(r.primaryNurseId) : ""); } },
      { label: "Discharge", disabled: r.status === "Discharged", onClick: () => ask({ title: "Discharge patient", message: `Discharge ${r.patientName}${r.bed ? ` and free bed ${r.bed}` : ""}?`, confirmLabel: "Discharge", action: () => api.post(`/ipd/${r.id}/discharge`) }) },
      { label: "Move to ICU", disabled: r.status === "ICU" || r.status === "Discharged", onClick: () => mutate(() => api.patch(`/ipd/${r.id}`, { status: "ICU" })) },
      { label: "Delete", danger: true, onClick: () => remove(r.id, r.patientName) },
    ] : []),
  ];

  const longStayCount = count("longStay");
  const missedCount = count("missed");

  return (
    <>
      {dialog}
      <AdmitDialog open={admitOpen} onClose={() => setAdmitOpen(false)} onAdmitted={refresh} />

      <div className={`${tw.gutterX} pt-[16px] pb-3 flex items-center gap-3 flex-wrap`}>
        <BedDouble size={18} className="text-[color:var(--ink-soft)]" />
        <h1 className="text-[17px] font-semibold text-[color:var(--ink)]">Inpatients</h1>
        <span className="text-[13px] text-[color:var(--ink-soft)]">{admitted.length} admitted</span>
        {board?.rounds && board.rounds.total > 0 && (
          <span className="inline-flex items-center h-[24px] px-3 rounded-full border border-[#f3cf7d] bg-[#fff6dd] text-[12px] text-[#8a5300]">
            Rounds: {board.rounds.seen} of {board.rounds.total} seen
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <select value={ward} onChange={(e) => setWard(e.target.value)} aria-label="Ward"
            className="h-[34px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px] text-[color:var(--ink)] cursor-pointer">
            <option value="">All wards</option>
            {wardNames.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <Link href="/beds" className="inline-flex items-center gap-2 h-[34px] px-3 rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] text-[13px] text-[color:var(--ink)] hover:bg-[color:var(--subtle)] transition-colors">
            <BedDouble size={14} /> Bed board
          </Link>
          <button onClick={() => toggle("mlc")} aria-pressed={only.mlc}
            className={`inline-flex items-center gap-2 h-[34px] px-3 rounded-[8px] border text-[13px] cursor-pointer transition-colors ${only.mlc ? "bg-[color:var(--ink)] border-[color:var(--ink)] text-[color:var(--surface)]" : "border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>
            <Scale size={14} /> MLC {count("mlc") > 0 && <span className="font-mono text-[11px] opacity-80">{count("mlc")}</span>}
          </button>
          {hydrated && canWrite && (
            <button onClick={() => setAdmitOpen(true)} className="inline-flex items-center gap-2 h-[34px] px-4 rounded-[8px] bg-[color:var(--brand)] text-[13px] font-medium text-white hover:bg-[color:var(--brand-hover)] cursor-pointer transition-colors">
              <Plus size={14} /> Admit patient
            </button>
          )}
        </div>
      </div>

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
          <div className="flex items-center gap-3 flex-wrap px-5 py-3 border-b border-[color:var(--line)]">
            <div className="relative w-[260px] max-w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, UHID, ADM"
                className="h-[34px] w-full rounded-[8px] bg-[color:var(--surface)] border border-[color:var(--line)] pl-[32px] pr-3 text-[13px] text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] focus:outline-none focus:border-[color:var(--brand)]" />
            </div>
            <div role="group" aria-label="Admission status" className="inline-flex p-[3px] rounded-[8px] bg-[color:var(--subtle)]">
              {([["admitted", "Admitted now", admitted.length], ["discharged", "Discharged", discharged.length], ["all", "All", records.length]] as const).map(([id, label, n]) => (
                <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id}
                  className={`h-[28px] px-3 rounded-[6px] text-[13px] cursor-pointer ${tab === id ? "bg-[color:var(--surface)] text-[color:var(--ink)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>
                  {label} <span className="ml-1 font-mono text-[11px]">{n}</span>
                </button>
              ))}
            </div>
            <span className="mx-1 h-5 w-px bg-[color:var(--line)]" />
            <button onClick={() => toggle("mine")} aria-pressed={only.mine} className={chip(only.mine)}><UserRound size={13} /> My patients <span className="font-mono text-[11px] opacity-70">{count("mine")}</span></button>
            <button onClick={() => toggle("doses")} aria-pressed={only.doses} className={chip(only.doses)}><Pill size={13} /> Doses due <span className="font-mono text-[11px] opacity-70">{count("doses")}</span></button>
            <button onClick={() => toggle("iv")} aria-pressed={only.iv} className={chip(only.iv)}><Droplets size={13} /> IV running <span className="font-mono text-[11px] opacity-70">{count("iv")}</span></button>
            <button onClick={() => toggle("noNurse")} aria-pressed={only.noNurse} className={chip(only.noNurse)}><UserX size={13} /> No nurse <span className="font-mono text-[11px] opacity-70">{count("noNurse")}</span></button>
            <label className="ml-auto relative inline-flex items-center">
              <ArrowUpDown size={13} className="absolute left-3 text-[color:var(--ink-soft)] pointer-events-none" />
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort admissions"
                className="h-[34px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] pl-[30px] pr-3 text-[13px] text-[color:var(--ink)] cursor-pointer">
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
          </div>

          {(longStayCount > 0 || missedCount > 0) && (
            <div className="mx-5 mt-4 flex items-center gap-3 flex-wrap rounded-[10px] border border-[color:var(--line)] px-4 py-3">
              <BellRing size={15} className="text-[color:var(--ink-soft)]" />
              <span className="text-[14px] font-medium text-[color:var(--ink)]">Needs attention</span>
              {longStayCount > 0 && (
                <button onClick={() => toggle("longStay")} aria-pressed={only.longStay}
                  className={`inline-flex items-center gap-[6px] h-[24px] px-3 rounded-full border border-[#f3cf7d] text-[12px] cursor-pointer ${only.longStay ? "bg-[#f3cf7d] text-[#5c3a00]" : "bg-[#fff6dd] text-[#8a5300]"}`}>
                  In for {LONG_STAY_DAYS}+ days <span className="font-mono">{longStayCount}</span>
                </button>
              )}
              {missedCount > 0 && (
                <button onClick={() => toggle("missed")} aria-pressed={only.missed}
                  className={`inline-flex items-center gap-[6px] h-[24px] px-3 rounded-full border border-[#f4a3ac] text-[12px] cursor-pointer ${only.missed ? "bg-[#f4a3ac] text-[#5c0010]" : "bg-[#ffe3e5] text-[#b3001b]"}`}>
                  Doses missed <span className="font-mono">{missedCount}</span>
                </button>
              )}
            </div>
          )}

          <div className="mt-3">
            <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
              {visible.length === 0 ? (
                <div className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">
                  {records.length === 0 ? "No admissions yet." : "No admissions match these filters."}
                </div>
              ) : paged.map((r) => {
                const lv = live.get(r.id);
                const now = rightNow(r, lv);
                const open = () => router.push(`/ipd/${r.id}`);
                return (
                  <div key={r.id} role="link" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === "Enter") open(); }}
                    className={`${tw.table.dataRow} !h-auto py-[10px] cursor-pointer focus:outline-none focus-visible:bg-[color:var(--faint)]`}
                    style={{ gridTemplateColumns: "var(--cols)" }}>
                    <div className="min-w-0">
                      {r.bed ? <p className="font-mono text-[14px] font-semibold text-[color:var(--ink)] leading-[18px]">{r.bed}</p>
                        : <p className="text-[13px] text-[color:var(--ink-soft)] leading-[18px]">No bed</p>}
                      <p className="text-[12px] text-[color:var(--ink-soft)] truncate leading-[16px]">{r.ward || "—"}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-baseline gap-2 min-w-0 leading-[19px]">
                        <span className="text-[15px] font-semibold text-[color:var(--ink)] truncate">{r.patientName}</span>
                        <span className="text-[12px] text-[color:var(--ink-soft)] shrink-0">{[initial(r.gender), `${r.patientAge}y`].filter(Boolean).join(" · ")}</span>
                        {r.isMlc && <span className="shrink-0 rounded-full border border-[#f4a3ac] bg-[#ffe3e5] px-2 text-[10px] font-semibold text-[#b3001b]">MLC</span>}
                      </p>
                      <p className="text-[12px] text-[color:var(--ink-soft)] truncate leading-[16px]">
                        <span className="font-mono">{r.admissionNo}</span>{r.diagnosis ? ` · ${r.diagnosis}` : ""}
                      </p>
                    </div>
                    <div className="min-w-0 text-[13px] leading-[18px]" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <p className="truncate text-[color:var(--ink)]">{r.doctor || <span className="text-[color:var(--ink-soft)]">No doctor yet</span>}</p>
                      {r.primaryNurse ? (
                        <p className="truncate text-[12px] text-[color:var(--ink-soft)]">{r.primaryNurse}</p>
                      ) : r.status !== "Discharged" && canWrite ? (
                        <button onClick={() => { setNurseFor(r); setNurseId(""); }} className="text-[12px] text-[color:var(--brand)] hover:underline cursor-pointer">+ Assign nurse</button>
                      ) : <p className="text-[12px] text-[color:var(--ink-soft)]">—</p>}
                    </div>
                    <div className="text-[13px] leading-[18px]">
                      <p className="font-medium text-[color:var(--ink)]">{r.status === "Discharged" ? "—" : `Day ${lv?.stayDay ?? 1}`}</p>
                      <p className="text-[12px] text-[color:var(--ink-soft)]">{r.admissionType}</p>
                    </div>
                    <div className="min-w-0 text-[13px] leading-[18px]">
                      <p className={`truncate ${TONE[now.tone]}`}>{now.text}</p>
                      {now.sub && <p className="truncate text-[12px] text-[color:var(--ink-soft)]">{now.sub}</p>}
                    </div>
                    <div className="flex justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <RowMenu actions={actionsFor(r)} compact />
                    </div>
                  </div>
                );
              })}
            </DataTable>
          </div>
          {bar}
        </div>
      </div>

      <Modal open={!!nurseFor} onClose={() => setNurseFor(null)} title={nurseFor ? `Primary nurse — ${nurseFor.patientName}` : ""} width={440}
        footer={<>
          <button onClick={() => setNurseFor(null)} className="text-[13px] text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
          <button onClick={saveNurse} disabled={nurseSaving} className="text-[13px] text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">{nurseSaving ? "Saving…" : "Save"}</button>
        </>}>
        <FormRow label="Nurse" hint={nurses.length === 0 ? "No nurses found in Staff." : undefined}>
          <FormSelect placeholder="Assign later" value={nurseId} onChange={setNurseId}
            options={[{ value: "", label: "Unassigned" }, ...nurses.map((n) => ({ value: String(n.id), label: `${n.name} · ${n.department}` }))]} />
        </FormRow>
      </Modal>

      <Modal open={!!roundTarget} onClose={() => setRoundTarget(null)} title={roundTarget ? `Add doctor round — ${roundTarget.patientName}` : ""}
        footer={<>
          <button onClick={() => setRoundTarget(null)} className="text-[13px] text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
          <button onClick={saveRound} disabled={roundSaving || (!findings.trim() && !orders.trim())} className="text-[13px] text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">{roundSaving ? "Saving…" : "Add round"}</button>
        </>}>
        <div className="flex flex-col gap-4">
          <FormRow label="Findings"><FormTextarea placeholder="Clinical findings on this round…" rows={3} value={findings} onChange={setFindings} /></FormRow>
          <FormRow label="Orders"><FormTextarea placeholder="Orders / instructions…" rows={3} value={orders} onChange={setOrders} /></FormRow>
        </div>
      </Modal>
    </>
  );
}

export default function IpdPage() {
  return (
    <Suspense fallback={null}>
      <IpdPageInner />
    </Suspense>
  );
}
