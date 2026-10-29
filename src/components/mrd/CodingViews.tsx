"use client";

/**
 * MRD coding. The queue of discharged charts waiting for their ICD-10 codes, the chart dialog (codes, deficiencies,
 * mark coded, sign off, reopen) and the dashboard. A chart can't be marked coded without a principal diagnosis or
 * while a deficiency is open, and a signed-off chart is locked until it is reopened with a reason.
 */
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import { CODING_STATUSES, DEFICIENCY_KINDS, type CodeEntryDTO, type CodingStatus, type MrdCodingCaseDTO, type MrdCodingSummaryDTO, type MrdDeficiencyDTO } from "@/types/api";
import { attempt, Chips, cancelBtn, dayMonth, Empty, ErrorNote, fieldLabel, mono, outlineBtn, Pill, primaryBtn, stampShort, StatCard, StatGrid, td, th } from "@/components/mrd/shared";

const ICD10 = /^[A-TV-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/;
const PROC = /^[A-Z0-9]{3,8}$/;
const EDITABLE: CodingStatus[] = ["Pending", "In review", "Deficient"];

function CodeList({ title, hint, entries, onChange, pattern, disabled }: { title: string; hint: string; entries: CodeEntryDTO[]; onChange: (e: CodeEntryDTO[]) => void; pattern: RegExp; disabled: boolean }) {
  const [code, setCode] = useState("");
  const [text, setText] = useState("");
  const clean = code.trim().toUpperCase();
  const valid = pattern.test(clean) && !entries.some((e) => e.code === clean);
  const add = () => { onChange([...entries, { code: clean, text: text.trim() }]); setCode(""); setText(""); };
  return (
    <div className="flex flex-col gap-2">
      <span className={fieldLabel}>{title} <span className="font-normal text-[color:var(--ink-soft)]">{hint}</span></span>
      {entries.length > 0 && (
        <ul className="flex flex-col gap-1">
          {entries.map((e) => (
            <li key={e.code} className="flex items-center gap-3 rounded-[8px] bg-[color:var(--subtle)] px-3 py-[6px] text-[14px]">
              <span className={`${mono} w-[84px] shrink-0 font-medium`}>{e.code}</span><span className="min-w-0 flex-1 truncate">{e.text || "—"}</span>
              {!disabled && <button onClick={() => onChange(entries.filter((x) => x.code !== e.code))} aria-label={`Remove ${e.code}`} className="text-[color:var(--ink-soft)] hover:text-[#c8001a] cursor-pointer"><X size={14} /></button>}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <div className="grid gap-2" style={{ gridTemplateColumns: "110px minmax(0,1fr) auto" }}>
          <FormInput value={code} onChange={(v) => setCode(v.toUpperCase())} placeholder="Code" />
          <FormInput value={text} onChange={setText} placeholder="Description" />
          <button onClick={add} disabled={!valid} className={outlineBtn + " !h-[42px]"}><Plus size={14} /> Add</button>
        </div>
      )}
    </div>
  );
}

function CaseDialog({ id, canWrite, onClose }: { id: number; canWrite: boolean; onClose: () => void }) {
  const { items: cases } = useList<MrdCodingCaseDTO>("/mrd/coding", { all: true });
  const { items: defs } = useList<MrdDeficiencyDTO>(`/mrd/coding/${id}/deficiencies`);
  const c = cases.find((x) => x.id === id) ?? null;
  const { run, loading, error, reset } = useMutation();
  const [principal, setPrincipal] = useState<string | null>(null);
  const [principalText, setPrincipalText] = useState<string | null>(null);
  const [secondary, setSecondary] = useState<CodeEntryDTO[] | null>(null);
  const [procedures, setProcedures] = useState<CodeEntryDTO[] | null>(null);
  const [defKind, setDefKind] = useState<string>(DEFICIENCY_KINDS[0]);
  const [defNote, setDefNote] = useState("");
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState("");
  if (!c) return null;

  const editable = canWrite && EDITABLE.includes(c.status);
  const code = (principal ?? c.principalDxCode).trim().toUpperCase();
  const text = principalText ?? c.principalDxText;
  const sec = secondary ?? c.secondaryDx;
  const proc = procedures ?? c.procedures;
  const principalOk = ICD10.test(code);
  const close = () => { reset(); onClose(); };
  const dirty = principal !== null || principalText !== null || secondary !== null || procedures !== null;
  const post = (path: string, body?: unknown) => attempt(run(() => api.post(path, body ?? {})));

  async function save() {
    const ok = await attempt(run(() => api.patch(`/mrd/coding/${c!.id}`, { principalDxCode: code, principalDxText: text, secondaryDx: sec, procedures: proc })));
    if (ok) { setPrincipal(null); setPrincipalText(null); setSecondary(null); setProcedures(null); }
    return ok;
  }
  async function markCoded() { if (dirty && !(await save())) return; await post(`/mrd/coding/${c!.id}/coded`); }
  async function addDeficiency() { if (await post(`/mrd/coding/${c!.id}/deficiencies`, { kind: defKind, note: defNote.trim() || undefined })) setDefNote(""); }
  async function reopen() { if (await post(`/mrd/coding/${c!.id}/reopen`, { reason: reason.trim() })) { setReopening(false); setReason(""); } }

  return (
    <Modal open onClose={close} width={780} title={`${c.patientName} · ${c.admissionNo}`}
      subtitle={`${c.patientCode} · ${c.doctor || "no doctor recorded"} · admitted ${c.admittedOn || "-"}`}
      footer={
        <>
          <button onClick={close} className={cancelBtn}>Close</button>
          {canWrite && c.status === "Pending" && <button onClick={() => post(`/mrd/coding/${c.id}/start`)} disabled={loading} className={outlineBtn + " !h-[36px]"}>Start review</button>}
          {editable && <button onClick={save} disabled={loading || !dirty || (!!code && !principalOk)} className={outlineBtn + " !h-[36px]"}>Save codes</button>}
          {editable && <button onClick={markCoded} disabled={loading || !principalOk || c.openDeficiencies > 0} title={!principalOk ? "Enter a valid ICD-10 principal diagnosis" : c.openDeficiencies > 0 ? "Resolve the open deficiencies first" : undefined} className={primaryBtn}>Mark coded</button>}
          {canWrite && c.status === "Coded" && <button onClick={() => post(`/mrd/coding/${c.id}/sign-off`)} disabled={loading} className={primaryBtn}>Sign off</button>}
          {canWrite && (c.status === "Coded" || c.status === "Signed off") && <button onClick={() => setReopening(true)} disabled={loading} className={outlineBtn + " !h-[36px]"}>Reopen</button>}
        </>
      }>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-[color:var(--ink-soft)]">
          <Pill>{c.status}</Pill>
          {c.coderName && <span>Coded by {c.coderName}{c.codedAt ? ` · ${stampShort(c.codedAt)}` : ""}</span>}
          {c.signedOffBy && <span>Signed off by {c.signedOffBy}{c.signedOffAt ? ` · ${stampShort(c.signedOffAt)}` : ""}</span>}
          {!editable && c.status !== "Pending" && <span>Locked — {c.status === "Deficient" ? "" : "reopen to change the codes"}</span>}
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "150px minmax(0,1fr)" }}>
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Principal diagnosis <span className="text-[#ff0004]">*</span></span>
            <FormInput value={code} onChange={(v) => setPrincipal(v.toUpperCase())} placeholder="ICD-10, e.g. E03.9" disabled={!editable} error={!!code && !principalOk} />
          </div>
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Description</span>
            <FormInput value={text} onChange={setPrincipalText} disabled={!editable} />
          </div>
        </div>
        <CodeList title="Secondary diagnoses" hint="(ICD-10)" entries={sec} onChange={setSecondary} pattern={ICD10} disabled={!editable} />
        <CodeList title="Procedures" hint="(ICD-10-PCS / CPT)" entries={proc} onChange={setProcedures} pattern={PROC} disabled={!editable} />

        <div className="flex flex-col gap-2 border-t border-[color:var(--line)] pt-4">
          <span className={fieldLabel}>Deficiencies <span className="font-normal text-[color:var(--ink-soft)]">— anything missing from the chart that stops it being coded</span></span>
          {defs.length === 0 && <p className="text-[13px] text-[color:var(--ink-soft)]">None raised.</p>}
          <ul className="flex flex-col gap-1">
            {defs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-[8px] bg-[color:var(--subtle)] px-3 py-[6px] text-[14px]">
                <Pill>{d.status}</Pill>
                <span className="min-w-0 flex-1">{d.kind}{d.note && <span className="text-[color:var(--ink-soft)]"> — {d.note}</span>}<span className="block text-[12px] text-[color:var(--ink-soft)]">raised by {d.raisedBy} · {stampShort(d.raisedAt)}{d.resolvedAt ? ` · resolved ${stampShort(d.resolvedAt)} by ${d.resolvedBy}` : ""}</span></span>
                {canWrite && d.status === "Open" && <button onClick={() => post(`/mrd/deficiencies/${d.id}/resolve`)} disabled={loading} className={outlineBtn}>Resolve</button>}
              </li>
            ))}
          </ul>
          {canWrite && c.status !== "Signed off" && (
            <div className="grid gap-2" style={{ gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr) auto" }}>
              <FormSelect value={defKind} onChange={setDefKind} options={DEFICIENCY_KINDS.map((k) => ({ value: k, label: k }))} />
              <FormInput value={defNote} onChange={setDefNote} placeholder="Note (needed for Other)" />
              <button onClick={addDeficiency} disabled={loading || (defKind === "Other" && !defNote.trim())} className={outlineBtn + " !h-[42px]"}><Plus size={14} /> Raise</button>
            </div>
          )}
        </div>

        {reopening && (
          <div className="flex flex-col gap-2 rounded-[10px] border border-[color:var(--line)] p-3">
            <span className={fieldLabel}>Why is this chart being reopened?</span>
            <div className="grid gap-2" style={{ gridTemplateColumns: "minmax(0,1fr) auto auto" }}>
              <FormInput value={reason} onChange={setReason} placeholder="Kept in the audit log" />
              <button onClick={reopen} disabled={loading || reason.trim().length < 3} className={primaryBtn + " !h-[42px]"}>Reopen</button>
              <button onClick={() => setReopening(false)} className={cancelBtn + " !h-[42px]"}>Not now</button>
            </div>
          </div>
        )}
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

const CHIPS = [{ id: "All", label: "All" }, ...CODING_STATUSES.map((s) => ({ id: s, label: s }))] as const;

export function CodingQueueView({ canWrite }: { canWrite: boolean }) {
  const [status, setStatus] = useState<"All" | CodingStatus>("All");
  const { items, loading } = useList<MrdCodingCaseDTO>("/mrd/coding", { all: true, status: status === "All" ? undefined : status });
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="px-5 pb-5 pt-4">
      <Chips items={CHIPS} value={status} onChange={setStatus} />
      <div className="mt-3 overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
        <table className="w-full min-w-[760px] text-left">
          <thead><tr className="border-b border-[color:var(--line)]">{["Patient", "Admission", "Status", "Principal dx", "Queued", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                <td className={td}>{c.patientName} <span className={`${mono} text-[12px] text-[color:var(--ink-soft)]`}>{c.patientCode}</span></td>
                <td className={`${td} ${mono} font-medium`}>{c.admissionNo}</td>
                <td className={td}><Pill>{c.status}</Pill>{c.openDeficiencies > 0 && <span className="ml-2 text-[12px] text-[#c8001a]">{c.openDeficiencies} open</span>}</td>
                <td className={`${td} ${mono} font-medium`}>{c.principalDxCode || "—"}</td>
                <td className={td}>{dayMonth(c.queuedAt)}</td>
                <td className={`${td} text-right`}><button onClick={() => setOpen(c.id)} className={outlineBtn}>Open</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <Empty>{status === "All" ? "No discharged charts are waiting for coding." : `No charts are ${status.toLowerCase()}.`}</Empty>}
      </div>
      {open !== null && <CaseDialog key={open} id={open} canWrite={canWrite} onClose={() => setOpen(null)} />}
    </div>
  );
}

export function CodingDashboardView() {
  const { item: s } = useItem<MrdCodingSummaryDTO>("/mrd/coding/summary");
  const v = (n: number | undefined) => (s ? n ?? 0 : "–");
  return (
    <StatGrid cols={4}>
      <StatCard mono label="Awaiting coding" value={v(s?.awaitingCoding)} />
      <StatCard mono label="Pending" value={v(s?.pending)} />
      <StatCard mono label="Deficient" value={v(s?.deficient)} />
      <StatCard mono label="Coded (await sign-off)" value={v(s?.coded)} />
      <StatCard mono label="Signed off" value={v(s?.signedOff)} />
      <StatCard mono label="Open deficiencies" value={v(s?.openDeficiencies)} />
      <StatCard mono label="Pending file requests" value={v(s?.pendingFileRequests)} />
    </StatGrid>
  );
}
