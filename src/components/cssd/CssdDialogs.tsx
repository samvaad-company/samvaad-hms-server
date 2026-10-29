"use client";

/** CSSD dialogs: register a set, request one, start a cycle, pack, record a result, quarantine, issue, return, add a chamber. */
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { DEFAULT_CYCLE, DEFAULT_ISSUE_HOURS, PACKAGING, SET_TYPES, STERILIZATION_METHODS } from "@/types/cssd";
import type { CssdCaseDTO, CssdCycleDTO, CssdIssueDTO, CssdSetDTO, CssdSterilizerDTO, PatientDTO } from "@/types/api";
import { attempt, DialogButtons, ErrorNote, fieldLabel } from "@/components/mrd/shared";

interface Dept { id: number; name: string }
const useDepartments = () => useList<Dept>("/cssd/departments").items;

/** Shared shell: close resets the error; `submit` runs a POST and closes on success. */
function useAction(onClose: () => void, onDone?: () => void) {
  const { run, loading, error, reset } = useMutation();
  const close = () => { reset(); onClose(); };
  const submit = async (call: () => Promise<unknown>) => { if (await attempt(run(call))) { onDone?.(); close(); } };
  return { loading, error, close, submit };
}

export function RegisterSetDialog({ onClose }: { onClose: () => void }) {
  const depts = useDepartments();
  const { loading, error, close, submit } = useAction(onClose);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("Surgical");
  const [dept, setDept] = useState("");
  const [instruments, setInstruments] = useState("");
  const [charge, setCharge] = useState("");
  return (
    <Modal open onClose={close} width={460} title="Register instrument set" subtitle="The lifetime set number (CS-...) is minted on the server; the set starts dirty."
      footer={<DialogButtons onCancel={close} onConfirm={() => submit(() => api.post("/cssd/sets", { name: name.trim(), type, departmentId: dept ? Number(dept) : undefined, instruments, usageCharge: charge ? Number(charge) : 0 }))} label="Register" loading={loading} disabled={name.trim().length < 2} />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Set name</span><FormInput value={name} onChange={setName} placeholder="Major laparotomy set" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Type</span><FormSelect value={type} onChange={setType} options={SET_TYPES.map((t) => ({ value: t, label: t }))} /></div>
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Department</span><FormSelect value={dept} onChange={setDept} placeholder="—" options={[{ value: "", label: "—" }, ...depts.map((d) => ({ value: String(d.id), label: d.name }))]} /></div>
        </div>
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Instruments (one per line, &ldquo;Forceps x 4&rdquo;)</span>
          <textarea value={instruments} onChange={(e) => setInstruments(e.target.value)} rows={4} placeholder={"Artery forceps x 6\nNeedle holder x 2"}
            className="w-full resize-y rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] px-[14px] py-[10px] text-[14px] leading-[22px] focus:border-[color:var(--brand)] focus:bg-[color:var(--surface)] focus:outline-none" />
        </div>
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Usage charge (₹)</span><FormInput type="number" value={charge} onChange={setCharge} placeholder="0" min="0" />
          <p className="text-[12px] text-[color:var(--ink-soft)]">On issue, the usage fee posts to the patient&apos;s bill (IPD if admitted, otherwise OPD — pending).</p>
        </div>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function RequestDialog({ sets, presetSetId, onClose }: { sets: CssdSetDTO[]; presetSetId?: number; onClose: () => void }) {
  const depts = useDepartments();
  const { items: cases } = useList<CssdCaseDTO>("/cssd/cases");
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { loading, error, close, submit } = useAction(onClose);
  const [setId, setSetId] = useState(presetSetId ? String(presetSetId) : "");
  const [dept, setDept] = useState("");
  const [caseId, setCaseId] = useState("");
  const [patientId, setPatientId] = useState("");
  return (
    <Modal open onClose={close} width={460} title="Request a set" subtitle="Queues the set for CSSD; one live request/issue per set. Fulfilment issues it when sterile."
      footer={<DialogButtons onCancel={close} onConfirm={() => submit(() => api.post("/cssd/issues", { setId: Number(setId), departmentId: dept ? Number(dept) : undefined, caseId: caseId ? Number(caseId) : undefined, patientId: !caseId && patientId ? Number(patientId) : undefined }))} label="Queue request" loading={loading} disabled={!setId} />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Set</span>
          <SearchSelect placeholder="Pick a set…" value={setId} onChange={setSetId} options={sets.map((s) => ({ value: String(s.id), label: `${s.setNo}  ${s.name}`, hint: `${s.status} ${s.departmentName}` }))} />
        </div>
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Requesting department</span><FormSelect value={dept} onChange={setDept} placeholder="—" options={[{ value: "", label: "—" }, ...depts.map((d) => ({ value: String(d.id), label: d.name }))]} /></div>
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Surgical case (optional)</span>
          <FormSelect value={caseId} onChange={setCaseId} placeholder="—" options={[{ value: "", label: "—" }, ...cases.map((c) => ({ value: String(c.id), label: `${c.patientName} · ${c.procedure} · ${c.scheduledDate}` }))]} />
        </div>
        {!caseId && (
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Patient (optional)</span>
            <SearchSelect placeholder="Search a patient…" value={patientId} onChange={setPatientId} options={patients.map((p) => ({ value: String(p.id), label: p.name, hint: p.patientId }))} />
          </div>
        )}
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function StartCycleDialog({ sets, sterilizers, onClose }: { sets: CssdSetDTO[]; sterilizers: CssdSterilizerDTO[]; onClose: () => void }) {
  const { loading, error, close, submit } = useAction(onClose);
  const [chamber, setChamber] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [temp, setTemp] = useState("");
  const [pressure, setPressure] = useState("");
  const [exposure, setExposure] = useState("");
  const packed = sets.filter((s) => s.status === "Packed");
  const toggle = (id: number) => setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
  return (
    <Modal open onClose={close} width={460} title="Start sterilization cycle" subtitle="One running cycle per chamber; only PACKED sets load. The cycle number is minted on the server."
      footer={<DialogButtons onCancel={close} onConfirm={() => submit(() => api.post("/cssd/cycles", { sterilizerId: Number(chamber), setIds: picked, tempC: num(temp), pressurePsi: num(pressure), exposureMin: num(exposure) }))} label={`Start cycle (${picked.length})`} loading={loading} disabled={!chamber || picked.length === 0} />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Sterilizer</span>
          <FormSelect value={chamber} onChange={setChamber} placeholder="Pick a chamber..." options={sterilizers.filter((s) => s.active).map((s) => ({ value: String(s.id), label: `${s.name}${s.running ? " — running" : ""}` }))} />
        </div>
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Load (packed sets)</span>
          <ul className="max-h-[160px] overflow-y-auto rounded-[10px] border border-[color:var(--line)]">
            {packed.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-[6px] text-[14px] hover:bg-[color:var(--subtle)]">
                  <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 accent-[color:var(--brand)]" />
                  <span className="font-mono text-[13px]">{s.setNo}</span><span className="min-w-0 flex-1 truncate">{s.name}</span><span className="text-[12px] text-[color:var(--ink-soft)]">{s.packaging}</span>
                </label>
              </li>
            ))}
            {packed.length === 0 && <li className="px-3 py-4 text-center text-[13px] text-[color:var(--ink-soft)]">No packed sets. Pack a dirty set on the Board first.</li>}
          </ul>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Temp (°C)</span><FormInput type="number" value={temp} onChange={setTemp} placeholder={String(DEFAULT_CYCLE.tempC)} /></div>
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Pressure (psi)</span><FormInput type="number" value={pressure} onChange={setPressure} placeholder={String(DEFAULT_CYCLE.pressurePsi)} /></div>
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Exposure (min)</span><FormInput type="number" value={exposure} onChange={setExposure} placeholder={String(DEFAULT_CYCLE.exposureMin)} /></div>
        </div>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function PackDialog({ set, onClose }: { set: CssdSetDTO; onClose: () => void }) {
  const { loading, error, close, submit } = useAction(onClose);
  const [packaging, setPackaging] = useState<string>("Pouched");
  return (
    <Modal open onClose={close} width={420} title={`Pack ${set.setNo}`} subtitle={`${set.name} — cleaned, counted and sealed. Packaging decides how long it stays sterile.`}
      footer={<DialogButtons onCancel={close} onConfirm={() => submit(() => api.post(`/cssd/sets/${set.id}/pack`, { packaging }))} label="Pack" loading={loading} />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Packaging</span><FormSelect value={packaging} onChange={setPackaging} options={PACKAGING.map((p) => ({ value: p, label: p }))} /></div>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function ResultDialog({ cycle, onClose }: { cycle: CssdCycleDTO; onClose: () => void }) {
  const { loading, error, close, submit } = useAction(onClose);
  const [indicator, setIndicator] = useState<"pass" | "fail">("pass");
  const [note, setNote] = useState("");
  return (
    <Modal open onClose={close} width={440} title={`Record result — ${cycle.cycleNo}`} subtitle={`${cycle.sterilizerName} · ${cycle.load} ${cycle.load === 1 ? "set" : "sets"}. A pass makes the load sterile; a fail sends it back to dirty.`}
      footer={<DialogButtons onCancel={close} onConfirm={() => submit(() => api.post(`/cssd/cycles/${cycle.id}/result`, { indicator, note: note.trim() }))} label="Record result" loading={loading} danger={indicator === "fail"} />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Indicator</span>
          <div className="grid grid-cols-2 gap-3">
            {(["pass", "fail"] as const).map((v) => (
              <button key={v} onClick={() => setIndicator(v)} aria-pressed={indicator === v}
                className={`h-[42px] rounded-[10px] border text-[14px] font-medium cursor-pointer ${indicator === v ? (v === "pass" ? "border-[#9fe3c6] bg-[#dffff3] text-[#0b7a47]" : "border-[#f4a3ac] bg-[#ffe3e5] text-[#b3001b]") : "border-[color:var(--line)] hover:bg-[color:var(--subtle)]"}`}>{v === "pass" ? "Pass" : "Fail"}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Note (optional)</span><FormInput value={note} onChange={setNote} /></div>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function QuarantineDialog({ cycle, onClose }: { cycle: CssdCycleDTO; onClose: () => void }) {
  const { loading, error, close, submit } = useAction(onClose);
  const [reason, setReason] = useState("");
  return (
    <Modal open onClose={close} width={440} title={`Quarantine ${cycle.cycleNo}`} subtitle="Recall this cycle. Its sets still on the shelf go back to dirty; any already issued are flagged to investigate when they return."
      footer={<DialogButtons onCancel={close} onConfirm={() => submit(() => api.post(`/cssd/cycles/${cycle.id}/quarantine`, { reason: reason.trim() }))} label="Quarantine" loading={loading} disabled={reason.trim().length < 3} danger />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Reason</span><FormInput value={reason} onChange={setReason} placeholder="e.g. Biological indicator read late" /></div>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function IssueDialog({ issue, onClose }: { issue: CssdIssueDTO; onClose: () => void }) {
  const { loading, error, close, submit } = useAction(onClose);
  const [hours, setHours] = useState(String(DEFAULT_ISSUE_HOURS));
  return (
    <Modal open onClose={close} width={420} title={`Issue ${issue.setNo}`} subtitle={`${issue.setName}${issue.patientName ? ` · ${issue.patientName}` : ""}. The set must be sterile and in date.`}
      footer={<DialogButtons onCancel={close} onConfirm={() => submit(() => api.post(`/cssd/issues/${issue.id}/issue`, { hours: Number(hours) }))} label="Issue" loading={loading} disabled={!(Number(hours) >= 1)} />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Expected back after (hours)</span><FormInput type="number" value={hours} onChange={setHours} min="1" /></div>
        {issue.charge > 0 && <p className="text-[13px] text-[color:var(--ink-soft)]">₹{issue.charge.toLocaleString("en-IN")} posts to {issue.patientName ? `${issue.patientName}'s` : "the patient's"} bill{issue.patientName ? "" : " (no patient on this request, so nothing is billed)"}.</p>}
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function ReturnDialog({ issue, onClose }: { issue: CssdIssueDTO; onClose: () => void }) {
  const { loading, error, close, submit } = useAction(onClose);
  const [investigate, setInvestigate] = useState(false);
  const [note, setNote] = useState("");
  return (
    <Modal open onClose={close} width={440} title={`Return ${issue.setNo}`} subtitle={`${issue.setName} comes back dirty, to be cleaned and packed again.`}
      footer={<DialogButtons onCancel={close} onConfirm={() => submit(() => api.post(`/cssd/issues/${issue.id}/return`, { investigate, note: note.trim() }))} label="Return" loading={loading} disabled={investigate && note.trim().length < 3} />}>
      <div className="flex flex-col gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-[14px]"><input type="checkbox" checked={investigate} onChange={(e) => setInvestigate(e.target.checked)} className="h-4 w-4 accent-[color:var(--brand)]" /> Something needs investigating (missing or damaged instruments)</label>
        {investigate && <div className="flex flex-col gap-2"><span className={fieldLabel}>What happened?</span><FormInput value={note} onChange={setNote} placeholder="e.g. Two scissors missing from the count" /></div>}
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function SterilizerDialog({ onClose }: { onClose: () => void }) {
  const { loading, error, close, submit } = useAction(onClose);
  const [name, setName] = useState("");
  const [method, setMethod] = useState<string>(STERILIZATION_METHODS[0]);
  const [location, setLocation] = useState("");
  return (
    <Modal open onClose={close} width={420} title="Add sterilizer" subtitle="A chamber sets can be loaded into."
      footer={<DialogButtons onCancel={close} onConfirm={() => submit(() => api.post("/cssd/sterilizers", { name: name.trim(), method, location: location.trim() }))} label="Add" loading={loading} disabled={name.trim().length < 2} />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Name</span><FormInput value={name} onChange={setName} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Method</span><FormSelect value={method} onChange={setMethod} options={STERILIZATION_METHODS.map((m) => ({ value: m, label: m }))} /></div>
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Location</span><FormInput value={location} onChange={setLocation} placeholder="e.g. CSSD Main Hall" /></div>
        </div>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

