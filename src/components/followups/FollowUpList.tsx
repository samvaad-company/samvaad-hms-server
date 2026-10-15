"use client";

/**
 * Due follow-ups: patients who are to come back, soonest first. The doctor or the front desk marks each one
 * Done when the patient comes, or Missed when they are absent; a Missed one can be moved to a new date.
 */
import { useState } from "react";
import { Check, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { useRowActions } from "@/lib/api/useRowActions";
import { formatShortDay, todayIso } from "@/lib/dates";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import { usePagination } from "@/components/shared/Pagination";
import type { DoctorDTO, FollowUpDTO, FollowUpSummaryDTO, PatientDTO } from "@/types/api";

const FILTERS = [
  { id: "Pending", label: "Pending" },
  { id: "Done", label: "Done" },
  { id: "Missed", label: "Missed" },
  { id: "All", label: "All" },
] as const;

const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };

function DateChip({ f }: { f: FollowUpDTO }) {
  const today = todayIso();
  const cls =
    f.status === "Done" ? "bg-[#e8fbef] text-[#0b7a3b]"
    : f.status === "Missed" ? "bg-[#ffe9e9] text-[#e0001b]"
    : f.dueOn < today ? "bg-[#ffe3e6] text-[#e0001b]"
    : f.dueOn === today ? "bg-[#fff2d6] text-[#a35a00]"
    : "bg-[color:var(--subtle-2)] text-[color:var(--ink)]";
  return (
    <span className={`inline-flex items-center h-[22px] px-[10px] rounded-full text-[12px] font-medium whitespace-nowrap ${cls}`}
      title={f.status === "Pending" && f.dueOn < today ? "Overdue" : undefined}>
      {f.status === "Missed" ? "Missed · " : ""}{formatShortDay(f.dueOn)}
    </span>
  );
}

function ScheduleModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  const { run, loading, error } = useMutation();
  const [form, setForm] = useState({ patientId: "", doctorId: "", reason: "", dueOn: plusDays(7) });
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    await run(() => api.post("/followups", { patientId: Number(form.patientId), doctorId: form.doctorId ? Number(form.doctorId) : undefined, reason: form.reason, dueOn: form.dueOn }));
    onSaved();
    onClose();
  }
  const ok = form.patientId && form.reason.trim().length >= 2 && form.dueOn >= todayIso();

  return (
    <Modal open onClose={onClose} title="Schedule a follow-up" width={460}
      footer={
        <>
          <button onClick={onClose} className="text-[13px] text-[color:var(--ink)] border border-[color:var(--line)] px-4 py-[6px] rounded-[8px] hover:bg-[color:var(--subtle)] cursor-pointer">Cancel</button>
          <button onClick={save} disabled={loading || !ok} className="text-[13px] font-medium text-white bg-[color:var(--brand)] px-4 py-[6px] rounded-[8px] hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">
            {loading ? "Saving…" : "Schedule"}
          </button>
        </>
      }>
      <div className="flex flex-col gap-3">
        <FormRow label="Patient" required>
          <SearchSelect placeholder="Search patient by name, ID or phone…" value={form.patientId} onChange={v => set("patientId", v)}
            options={patients.map(p => ({ value: String(p.id), label: p.name, hint: `${p.patientId ?? ""} · ${p.phone}` }))} />
        </FormRow>
        <FormRow label="Doctor" hint="Leave empty to use your own account if you are a doctor.">
          <SearchSelect placeholder="Search doctor…" value={form.doctorId} onChange={v => set("doctorId", v)}
            options={doctors.map(d => ({ value: String(d.id), label: d.name, hint: d.specialty }))} />
        </FormRow>
        <FormRow label="Reason" required><FormInput placeholder="e.g. Suture removal and wound inspection" value={form.reason} onChange={v => set("reason", v)} /></FormRow>
        <FormRow label="Due on" required error={form.dueOn && form.dueOn < todayIso() ? "Can't be in the past" : undefined}>
          <FormInput type="date" min={todayIso()} value={form.dueOn} onChange={v => set("dueOn", v)} />
          <div className="flex gap-2 mt-2">
            {[["1 week", 7], ["2 weeks", 14], ["1 month", 30]].map(([l, n]) => (
              <button key={l} type="button" onClick={() => set("dueOn", plusDays(Number(n)))}
                className="h-[24px] px-3 rounded-full text-[11.5px] border border-[color:var(--line)] text-[color:var(--ink-soft)] hover:border-[color:var(--brand)] hover:text-[color:var(--brand)] cursor-pointer">{l}</button>
            ))}
          </div>
        </FormRow>
        {error && <p className="text-[12px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</p>}
      </div>
    </Modal>
  );
}

function RescheduleModal({ f, onClose, onSaved }: { f: FollowUpDTO; onClose: () => void; onSaved: () => void }) {
  const { run, loading, error } = useMutation();
  const [dueOn, setDueOn] = useState(plusDays(7));
  async function save() { await run(() => api.post(`/followups/${f.id}/reschedule`, { dueOn })); onSaved(); onClose(); }
  return (
    <Modal open onClose={onClose} title={`Reschedule — ${f.patientName}`} width={400}
      footer={
        <>
          <button onClick={onClose} className="text-[13px] text-[color:var(--ink)] border border-[color:var(--line)] px-4 py-[6px] rounded-[8px] hover:bg-[color:var(--subtle)] cursor-pointer">Cancel</button>
          <button onClick={save} disabled={loading || dueOn < todayIso()} className="text-[13px] font-medium text-white bg-[color:var(--brand)] px-4 py-[6px] rounded-[8px] hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">{loading ? "Saving…" : "Reschedule"}</button>
        </>
      }>
      <div className="flex flex-col gap-3">
        <p className="text-[12.5px] text-[color:var(--ink-soft)]">{f.reason}. It goes back to Pending on the new date.</p>
        <FormRow label="New date"><FormInput type="date" min={todayIso()} value={dueOn} onChange={setDueOn} /></FormRow>
        {error && <p className="text-[12px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</p>}
      </div>
    </Modal>
  );
}

export function FollowUpList() {
  const { can } = useAuth();
  const canWrite = can("followups", "write");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("Pending");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<null | { kind: "new" } | { kind: "move"; f: FollowUpDTO }>(null);

  const { items, loading, reload } = useList<FollowUpDTO>("/followups", { all: true, ...(filter !== "All" ? { status: filter } : {}), ...(search.trim() ? { search: search.trim() } : {}) });
  const { item: summary, reload: reloadSummary } = useItem<FollowUpSummaryDTO>("/followups/summary");
  const { dialog, remove, mutate } = useRowActions("followups", () => { reload(); reloadSummary(); });
  const { rows, bar } = usePagination(items, "follow-ups");
  const { run } = useMutation();
  const refresh = () => { reload(); reloadSummary(); };

  const mark = (f: FollowUpDTO, what: "done" | "missed") => run(() => api.post(`/followups/${f.id}/${what}`)).then(refresh);

  const actionsFor = (f: FollowUpDTO): RowAction[] => !canWrite ? [] : [
    { label: "Reschedule", onClick: () => setModal({ kind: "move", f }) },
    ...(f.status !== "Pending" ? [{ label: "Back to pending", onClick: () => void run(() => api.post(`/followups/${f.id}/reopen`)).then(refresh) }] : []),
    { label: "Delete", danger: true, onClick: () => remove(f.id, `${f.patientName}'s follow-up`) },
  ];

  const count = (id: string) => id === "All" ? (summary ? summary.pending + summary.done + summary.missed : undefined) : summary ? { Pending: summary.pending, Done: summary.done, Missed: summary.missed }[id] : undefined;
  void mutate;

  return (
    <>
      {dialog}
      <div className="flex items-center gap-5 px-5 py-[10px] text-[12px] text-[color:var(--ink-soft)] flex-wrap">
        <span>Overdue <b className="ml-1 text-[14px] font-mono text-[#e0001b]">{summary?.overdue ?? "–"}</b></span>
        <span>Due today <b className="ml-1 text-[14px] font-mono text-[color:var(--ink)]">{summary?.dueToday ?? "–"}</b></span>
        <span>Next 14 days <b className="ml-1 text-[14px] font-mono text-[color:var(--ink)]">{summary?.next14 ?? "–"}</b></span>
        {canWrite && (
          <button onClick={() => setModal({ kind: "new" })} className="ml-auto h-[30px] px-3 rounded-[8px] bg-[color:var(--brand)] text-white text-[12.5px] font-medium hover:bg-[color:var(--brand-hover)] cursor-pointer">+ Schedule</button>
        )}
      </div>

      <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient, doctor or reason…" aria-label="Search follow-ups"
          className="h-[34px] flex-1 min-w-[220px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px] text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] focus:outline-none focus:border-[color:var(--brand)]" />
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
              className={`h-[28px] px-3 rounded-full text-[12px] border cursor-pointer transition-colors ${filter === f.id ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--ink)] font-medium" : "border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]"}`}>
              {f.label}{count(f.id) !== undefined && <span className="ml-1 font-mono text-[11px] opacity-70">{count(f.id)}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-4 flex flex-col gap-2">
        {loading ? (
          <p className="py-12 text-center text-[13px] text-[color:var(--ink-soft)]">Loading follow-ups…</p>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-[color:var(--ink-soft)]">{search || filter !== "Pending" ? "No follow-ups match." : "Nothing is due. All follow-ups are marked."}</p>
        ) : rows.map(f => (
          <div key={f.id} className="flex items-center gap-3 rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-[9px] hover:border-[color:var(--brand-ring)] transition-colors">
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-[color:var(--ink)] truncate leading-[18px]">{f.patientName}</p>
              <p className="text-[11.5px] text-[color:var(--ink-soft)] truncate leading-[16px]">
                {[f.patientCode, f.reason, f.doctor].filter(Boolean).join(" · ")}
                <span className="opacity-80"> · booked by {f.createdByRole || "staff"}{f.status !== "Pending" && f.resolvedByRole ? `, marked ${f.status.toLowerCase()} by ${f.resolvedByRole}` : ""}</span>
              </p>
            </div>
            <DateChip f={f} />
            {canWrite && f.status !== "Done" && (
              <button onClick={() => mark(f, "done")} className="inline-flex items-center gap-1 h-[28px] px-3 rounded-[8px] border border-[color:var(--line)] text-[12px] text-[color:var(--ink)] hover:bg-[#e8fbef] hover:border-[#b6e8cf] cursor-pointer"><Check size={13} /> Done</button>
            )}
            {canWrite && f.status === "Pending" && (
              <button onClick={() => mark(f, "missed")} title="The patient was absent" className="inline-flex items-center gap-1 h-[28px] px-3 rounded-[8px] border border-[color:var(--line)] text-[12px] text-[color:var(--ink)] hover:bg-[#ffe9e9] hover:border-[#ffc9c9] cursor-pointer"><X size={13} /> Missed</button>
            )}
            {canWrite && <RowMenu actions={actionsFor(f)} compact />}
          </div>
        ))}
      </div>
      {bar}

      {modal?.kind === "new" && <ScheduleModal onClose={() => setModal(null)} onSaved={refresh} />}
      {modal?.kind === "move" && <RescheduleModal f={modal.f} onClose={() => setModal(null)} onSaved={refresh} />}
    </>
  );
}
