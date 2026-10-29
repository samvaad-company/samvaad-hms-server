"use client";

/**
 * Cross-match worklist. Requesting one holds the unit for the patient — a unit can be held by only one open
 * cross-match. The laboratory then enters the result; only a compatible result can be issued.
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { useHydrated } from "@/lib/use-hydrated";
import { usePagination } from "@/components/shared/Pagination";
import { Modal } from "@/components/shared/Modal";
import { FormSelect } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import type { BloodCrossmatchDTO, BloodUnitDTO, PatientDTO } from "@/types/api";
import { btn, compatible, Empty, mono, Pill, SectionHead, stamp, td, th } from "@/components/bloodbank/shared";

async function attempt(p: Promise<unknown>) { try { await p; return true; } catch { return false; } }
const label = "text-[14px] font-medium text-[color:var(--ink)]";

function RequestDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { items: units } = useList<BloodUnitDTO>("/blood-bank/units", { all: true, status: "Available" });
  const { run, loading, error, reset } = useMutation();
  const [patientId, setPatientId] = useState("");
  const [unitId, setUnitId] = useState("");
  const patient = patients.find((p) => String(p.id) === patientId);
  // Only units that are in date and could be given to this patient, soonest-expiring first.
  const ready = units.filter((u) => u.status === "Available" && !u.expired && u.serologyDone).sort((a, b) => a.expiryOn.localeCompare(b.expiryOn));
  const fits = ready.filter((u) => compatible(patient?.bloodGroup, u));
  const close = () => { reset(); onClose(); };
  async function request() {
    if (!(await attempt(run(() => api.post("/blood-bank/crossmatches", { patientId: Number(patientId), unitId: Number(unitId) }))))) return;
    setPatientId(""); setUnitId(""); onDone(); close();
  }
  return (
    <Modal open={open} onClose={close} width={460} title="Request a cross-match"
      subtitle="The unit is reserved atomically - two simultaneous requests resolve to exactly one winner; the loser sees the holding cross-match."
      footer={<>
        <button onClick={close} className="h-[36px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 text-[13px] font-medium text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer">Cancel</button>
        <button onClick={request} disabled={loading || !patientId || !unitId} className="h-[36px] rounded-[8px] bg-[color:var(--brand)] px-5 text-[13px] font-medium text-white hover:bg-[color:var(--brand-hover)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{loading ? "Requesting…" : "Request"}</button>
      </>}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={label}>Patient</span>
          <SearchSelect placeholder="Search patient..." value={patientId} onChange={(v) => { setPatientId(v); setUnitId(""); }}
            options={patients.map((p) => ({ value: String(p.id), label: p.name, hint: `${p.patientId ?? ""} ${p.bloodGroup ?? ""}` }))} />
          {patient && <p className="text-[12px] text-[color:var(--ink-soft)]">{patient.bloodGroup ? `Blood group on record: ${patient.bloodGroup}` : "No blood group on record — the unit can't be checked against it, so confirm the patient's group first."}</p>}
        </div>
        <div className="flex flex-col gap-2"><span className={label}>Unit (available only - the five-flag serology gate)</span>
          <FormSelect placeholder="Pick a unit..." value={unitId} onChange={setUnitId}
            options={fits.map((u) => ({ value: String(u.id), label: `${u.unitNo} · ${u.bloodGroup} · ${u.component} · exp ${u.expiryOn}` }))} />
          {ready.length > fits.length && <p className="text-[12px] text-[color:var(--ink-soft)]">{ready.length - fits.length} units are hidden — ABO / Rh incompatible with this patient.</p>}
          {ready.length === 0 && <p className="text-[12px] text-[#8a5300]">No unit is available — check quarantine and serology.</p>}
        </div>
        {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
      </div>
    </Modal>
  );
}

export function CrossmatchView({ canWrite }: { canWrite: boolean }) {
  const hydrated = useHydrated();
  const { items, reload, loading } = useList<BloodCrossmatchDTO>("/blood-bank/crossmatches", { all: true });
  const { run, error, reset } = useMutation();
  const [requesting, setRequesting] = useState(false);
  const { rows, bar } = usePagination(items, "cross-matches");

  async function act(id: number, path: string, body?: unknown) {
    reset();
    if (await attempt(run(() => api.post(`/blood-bank/crossmatches/${id}/${path}`, body)))) reload();
  }

  return (
    <div>
      <SectionHead title="Cross-match worklist"
        action={hydrated && canWrite ? <button onClick={() => setRequesting(true)} className={btn.primary}><Plus size={14} /> Request cross-match</button> : undefined} />
      {error && <p role="alert" className="mx-5 mb-3 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
      <div className="mx-5 mb-4 overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
        <table className="w-full min-w-[980px] text-left">
          <thead><tr className="border-b border-[color:var(--line)]">{["XM no", "Patient", "Unit", "Requested", "Result", "Status", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                <td className={`${td} ${mono}`}>{x.xmNo}</td>
                <td className={td}>{x.patientName} <span className="font-mono text-[12px] text-[color:var(--ink-soft)]">{x.patientCode}</span></td>
                <td className={`${td} ${mono}`}>{x.unitNo} <span className="font-sans text-[color:var(--ink-soft)]">{x.unitGroup}</span></td>
                <td className={`${td} ${mono}`}>{stamp(x.requestedAt)}</td>
                <td className={`${td} ${mono} ${x.result === "compatible" ? "text-[#0b7a47]" : x.result === "incompatible" ? "text-[#c8001a]" : "text-[color:var(--ink-soft)]"}`}>{x.result}</td>
                <td className={td}><Pill tone={x.status}>{x.status}</Pill></td>
                <td className={`${td} text-right`}>
                  {canWrite && (
                    <div className="flex justify-end gap-2">
                      {x.status === "requested" && (<>
                        <button onClick={() => act(x.id, "result", { result: "compatible" })} className={`${btn.base} ${btn.ghost} !text-[#0b7a47]`}>Compatible</button>
                        <button onClick={() => act(x.id, "result", { result: "incompatible" })} className={`${btn.base} ${btn.ghost} !text-[#c8001a]`}>Incompatible</button>
                      </>)}
                      {x.status === "resulted" && x.result === "compatible" && <button onClick={() => act(x.id, "issue")} className={`${btn.base} ${btn.solid}`}>Issue</button>}
                      {(x.status === "requested" || x.status === "resulted") && <button onClick={() => act(x.id, "cancel")} className="h-[30px] px-2 text-[13px] text-[color:var(--ink)] hover:underline cursor-pointer">Cancel</button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <Empty>No cross-matches yet.</Empty>}
      </div>
      {bar}
      <RequestDialog open={requesting} onClose={() => setRequesting(false)} onDone={reload} />
    </div>
  );
}
