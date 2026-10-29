"use client";

/**
 * MRD → Registers: the birth and death registers. Entries are permanent — a correction is an amendment, a new entry
 * that supersedes the old one, which stays readable. "Print (12 months)" builds the register with the hospital
 * letterhead and opens the print dialog (choose Save as PDF there).
 */
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Plus, Printer } from "lucide-react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { printElement } from "@/lib/print";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import { DocumentLetterhead, useHospital } from "@/components/shared/DocumentLetterhead";
import { MRD_REGISTERS, type MrdRegisterDTO, type MrdRegisterEntryDTO, type MrdRegisterFieldDTO, type MrdRegisterKind } from "@/types/api";
import { attempt, DialogButtons, dmy, ErrorNote, fieldLabel, mono, outlineBtn, primaryBtn, td, th, todayLocal } from "@/components/mrd/shared";

function EntryDialog({ register, amends, onClose, onDone }: { register: MrdRegisterDTO; amends: MrdRegisterEntryDTO | null; onClose: () => void; onDone: () => void }) {
  const { run, loading, error, reset } = useMutation();
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...(amends?.data ?? {}) }));
  const [entryDate, setEntryDate] = useState(amends?.entryDate ?? todayLocal());
  const [reportTo, setReportTo] = useState(amends?.reportTo ?? "");
  const [reason, setReason] = useState("");
  const set = (k: string, v: string) => setValues((x) => ({ ...x, [k]: v }));
  const close = () => { reset(); onClose(); };
  const singular = register.title.toLowerCase();
  const missing = register.fields.some((f) => f.required && !(values[f.key] ?? "").trim()) || (amends && reason.trim().length < 3);

  async function submit() {
    const body = { ...values, entryDate, reportTo: reportTo.trim(), ...(amends ? { amendmentReason: reason.trim() } : {}) };
    const path = amends ? `/mrd/registers/${register.kind}/${amends.id}/amend` : `/mrd/registers/${register.kind}`;
    if (await attempt(run(() => api.post(path, body)))) { onDone(); close(); }
  }

  const input = (f: MrdRegisterFieldDTO) => {
    const v = values[f.key] ?? "";
    if (f.kind === "select") return <FormSelect value={v} onChange={(x) => set(f.key, x)} placeholder="Select" options={(f.options ?? []).map((o) => ({ value: o, label: o }))} />;
    if (f.suggestions) {
      const id = `sugg-${register.kind}-${f.key}`;
      return (<><input list={id} value={v} onChange={(e) => set(f.key, e.target.value)} className="h-[42px] w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] px-[14px] text-[14px] focus:border-[color:var(--brand)] focus:bg-[color:var(--surface)] focus:outline-none" /><datalist id={id}>{f.suggestions.map((s) => <option key={s} value={s} />)}</datalist></>);
    }
    return <FormInput type={f.kind === "number" ? "number" : f.kind === "time" ? "time" : "text"} value={v} onChange={(x) => set(f.key, x)} />;
  };

  return (
    <Modal open onClose={close} width={640} title={amends ? `Amend ${amends.entryNo}` : `File a ${singular} entry`}
      subtitle={amends ? "A new entry is filed that supersedes this one; the original stays on the register." : "Filed entries are permanent - corrections are amendments, never edits."}
      footer={<DialogButtons onCancel={close} onConfirm={submit} label={amends ? "File amendment" : "File entry"} loading={loading} disabled={!!missing} />}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        {register.fields.map((f) => (
          <div key={f.key} className="flex flex-col gap-2"><span className={fieldLabel}>{f.label}{f.required && " *"}</span>{input(f)}</div>
        ))}
        <div className="flex flex-col gap-2 col-start-1"><span className={fieldLabel}>Entry date</span><FormInput type="date" value={entryDate} onChange={setEntryDate} max={todayLocal()} /></div>
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Report to (authority)</span><FormInput value={reportTo} onChange={setReportTo} placeholder="e.g. Municipal registrar" /></div>
        {amends && <div className="col-span-2 flex flex-col gap-2"><span className={fieldLabel}>Reason for the correction *</span><FormInput value={reason} onChange={setReason} /></div>}
        <div className="col-span-2"><ErrorNote message={error?.message} /></div>
      </div>
    </Modal>
  );
}

function RegisterDocument({ reg }: { reg: MrdRegisterDTO }) {
  const hospital = useHospital();
  return (
    <div className="bg-white p-8 text-[11px] text-black" style={{ width: 1000 }}>
      <DocumentLetterhead hospital={hospital} compact />
      <h1 className="mt-4 text-[18px] font-semibold">{reg.title}</h1>
      <p className="text-[12px]">{reg.entries.length} {reg.entries.length === 1 ? "entry" : "entries"} · last 12 months · printed {dmy(todayLocal())}</p>
      <table className="mt-3 w-full border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-black">{["Entry no", "Date", ...reg.fields.map((f) => f.label), "Report to", "Filed by"].map((c) => <th key={c} className="py-[6px] pr-2 text-[10px] font-bold uppercase tracking-wide">{c}</th>)}</tr>
        </thead>
        <tbody>
          {reg.entries.map((e) => (
            <tr key={e.id} className="border-b border-[#ddd] align-top">
              <td className="py-[5px] pr-2 font-mono whitespace-nowrap">{e.entryNo}{e.supersededBy ? <span className="block">(amended)</span> : e.amendsId ? <span className="block">(amendment)</span> : null}</td>
              <td className="py-[5px] pr-2 whitespace-nowrap">{dmy(e.entryDate)}</td>
              {reg.fields.map((f) => <td key={f.key} className="py-[5px] pr-2">{e.data[f.key] ?? ""}</td>)}
              <td className="py-[5px] pr-2">{e.reportTo}</td>
              <td className="py-[5px] pr-2">{e.filedBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {reg.entries.length === 0 && <p className="mt-3">No entries in the last 12 months.</p>}
    </div>
  );
}

export function RegistersView({ canWrite }: { canWrite: boolean }) {
  const [kind, setKind] = useState<MrdRegisterKind>("birth");
  const [reg, setReg] = useState<MrdRegisterDTO | null>(null);
  const [printDoc, setPrintDoc] = useState<MrdRegisterDTO | null>(null);
  const [busy, setBusy] = useState<"load" | "print" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filing, setFiling] = useState<{ register: MrdRegisterDTO; amends: MrdRegisterEntryDTO | null } | null>(null);
  const docRef = useRef<HTMLDivElement>(null);

  async function fetchRegister(months?: number) { return api.get<MrdRegisterDTO>(`/mrd/registers/${kind}`, months ? { months } : undefined); }
  async function load() {
    setBusy("load"); setError(null);
    try { setReg(await fetchRegister()); } catch (e) { setError(e instanceof Error ? e.message : "The register could not be loaded."); } finally { setBusy(null); }
  }
  async function print() {
    setBusy("print"); setError(null);
    try {
      const r = await fetchRegister(12);
      flushSync(() => setPrintDoc(r));
      printElement(docRef.current?.firstElementChild as HTMLElement | null, `${r.title} - last 12 months`);
    } catch (e) { setError(e instanceof Error ? e.message : "The register could not be printed."); } finally { setBusy(null); }
  }
  async function openFiling(amends: MrdRegisterEntryDTO | null) {
    setError(null);
    try { setFiling({ register: reg && reg.kind === kind ? reg : await fetchRegister(), amends }); } catch (e) { setError(e instanceof Error ? e.message : "The form could not be opened."); }
  }

  const entries = reg && reg.kind === kind ? [...reg.entries].reverse() : [];
  return (
    <div className="px-5 pb-5 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-[220px]"><FormSelect value={kind} onChange={(v) => { setKind(v as MrdRegisterKind); setReg(null); }} options={MRD_REGISTERS.map((r) => ({ value: r.kind, label: r.title }))} /></div>
        <button onClick={load} disabled={busy !== null} className={outlineBtn + " !h-[36px]"}>{busy === "load" ? "Loading…" : "Load entries"}</button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={print} disabled={busy !== null} className={outlineBtn + " !h-[36px]"}><Printer size={14} /> {busy === "print" ? "Preparing…" : "Print (12 months)"}</button>
          {canWrite && <button onClick={() => openFiling(null)} className={primaryBtn}><Plus size={15} /> File entry</button>}
        </div>
      </div>
      <div className="mt-3"><ErrorNote message={error} /></div>
      {!reg || reg.kind !== kind ? (
        <div className="mt-3 rounded-[10px] border border-dashed border-[color:var(--line)] py-12 text-center text-[14px] text-[color:var(--ink-soft)]">Pick a register and load its entries (kept on the server - this needs internet).</div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
          <table className="w-full text-left" style={{ minWidth: 220 + reg.fields.length * 130 }}>
            <thead><tr className="border-b border-[color:var(--line)]">{["Entry no", "Date", ...reg.fields.map((f) => f.label), "Report to", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className={`border-b border-[color:var(--line)] last:border-b-0 align-top ${e.supersededBy ? "text-[color:var(--ink-soft)]" : "hover:bg-[color:var(--faint)]"}`}>
                  <td className={`${td} ${mono} whitespace-nowrap`}>{e.entryNo}{e.supersededBy && <span className="block font-sans text-[11px]">amended</span>}{e.amendsId && <span className="block font-sans text-[11px] text-[color:var(--ink-soft)]">amendment</span>}</td>
                  <td className={`${td} ${mono} whitespace-nowrap`}>{dmy(e.entryDate)}</td>
                  {reg.fields.map((f) => <td key={f.key} className={td}>{e.data[f.key] || "—"}</td>)}
                  <td className={td}>{e.reportTo || "—"}</td>
                  <td className={`${td} text-right`}>{canWrite && !e.supersededBy && <button onClick={() => openFiling(e)} className="text-[13px] text-[color:var(--ink)] hover:underline cursor-pointer">Amend</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && <div className="py-10 text-center text-[14px] text-[color:var(--ink-soft)]">No entries filed yet.</div>}
        </div>
      )}
      {filing && <EntryDialog key={filing.amends?.id ?? "new"} register={filing.register} amends={filing.amends} onClose={() => setFiling(null)} onDone={() => { void load(); }} />}
      <div ref={docRef} aria-hidden style={{ position: "absolute", left: -99999, top: 0 }}>{printDoc && <RegisterDocument reg={printDoc} />}</div>
    </div>
  );
}
