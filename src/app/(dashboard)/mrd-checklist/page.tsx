"use client";

/**
 * MRD file: pick an admission, the system fetches that patient's records and ticks the checklist items it can find,
 * the checker adjusts the ticks, and one PDF is made — the checklist followed by the documents behind every ticked item.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCheck, Download, Loader2, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useList } from "@/lib/api/hooks";
import { useHospital, hospitalAddress } from "@/components/shared/DocumentLetterhead";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { downloadBlob, printBlob } from "@/lib/preauth/exact";
import { MRD_CHECKLIST_ITEMS } from "@/lib/mrd/checklist";
import { evidenceFor, loadMrdFile, type MrdFileData } from "@/lib/mrd/file-data";
import { buildMrdFilePdf } from "@/lib/mrd/file-pdf";
import { MrdShell, todayLocal, outlineBtn, primaryBtn } from "@/components/mrd/shared";
import { formatDate } from "@/lib/dates";
import type { IpdRecordDTO } from "@/types/api";

const input = "h-[36px] w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] px-3 text-[13px] text-[color:var(--ink)] focus:border-[color:var(--brand)] focus:bg-[color:var(--surface)] focus:outline-none";
const label = "mb-1 block text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]";

export default function MrdFilePage() {
  const { user } = useAuth();
  const hospital = useHospital();
  const { items: admissions } = useList<IpdRecordDTO>("/ipd", { all: true });

  const [admissionId, setAdmissionId] = useState("");
  const [file, setFile] = useState<MrdFileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [hospitalName, setHospitalName] = useState("");
  const [patientName, setPatientName] = useState("");
  const [ipdNo, setIpdNo] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [dischargeDate, setDischargeDate] = useState("");
  const [checked, setChecked] = useState<number[]>([]);
  const [staffName, setStaffName] = useState("");
  const [date, setDate] = useState(todayLocal());

  const [building, setBuilding] = useState<{ done: number; total: number; label: string } | null>(null);
  const [result, setResult] = useState<{ blob: Blob; url: string; notes: string[]; stale: boolean } | null>(null);
  const [buildError, setBuildError] = useState("");
  const urlRef = useRef<string | null>(null);

  useEffect(() => { if (hospital.name) setHospitalName((cur) => cur || [hospital.name, hospitalAddress(hospital)].filter(Boolean).join(", ")); }, [hospital]);
  useEffect(() => { if (user?.name) setStaffName((cur) => cur || user.name); }, [user?.name]);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const options = useMemo(() => admissions.map((a) => ({ value: String(a.id), label: a.patientName, hint: `${a.admissionNo} · ${a.status}` })), [admissions]);
  const evidence = useMemo(() => (file ? evidenceFor(file) : null), [file]);

  async function pick(id: string) {
    setAdmissionId(id);
    const a = admissions.find((x) => String(x.id) === id);
    if (!a) return;
    setPatientName(a.patientName);
    setIpdNo(a.admissionNo);
    setAdmissionDate(formatDate(a.admissionDate));
    setDischargeDate(a.dischargeDate ? formatDate(a.dischargeDate) : "");
    setFile(null); setResult(null); setLoadError(""); setLoading(true);
    try {
      const data = await loadMrdFile(a);
      setFile(data);
      // The checker starts from what the system found.
      setChecked(evidenceFor(data).flatMap((e, i) => (e.count > 0 ? [i] : [])));
    } catch (e) {
      setLoadError((e as Error).message || "The patient's records could not be read.");
    } finally { setLoading(false); }
  }

  // Any change after a PDF was made marks it out of date.
  useEffect(() => { setResult((r) => (r && !r.stale ? { ...r, stale: true } : r)); }, [hospitalName, patientName, ipdNo, admissionDate, dischargeDate, checked, staffName, date]);

  const toggle = (i: number) => setChecked((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]));
  const allOn = checked.length === MRD_CHECKLIST_ITEMS.length;

  async function create() {
    if (!file) return;
    setBuilding({ done: 0, total: 1, label: "Starting" }); setBuildError("");
    try {
      const { blob, notes } = await buildMrdFilePdf({
        checklist: { hospitalName, patientName, ipdNo, admissionDate, dischargeDate, checked, staffName, date: date ? formatDate(date) : "" },
        file,
        onProgress: (done, total, l) => setBuilding({ done, total, label: l }),
      });
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setResult({ blob, url, notes, stale: false });
    } catch (e) {
      setBuildError((e as Error).message || "The PDF could not be made.");
    } finally { setBuilding(null); }
  }

  const fileName = `MRD file - ${patientName || "patient"}${ipdNo ? ` - ${ipdNo.replace(/\//g, "-")}` : ""}.pdf`;
  const ready = result && !result.stale;

  return (
    <MrdShell
      icon={<ClipboardCheck size={16} />}
      title="MRD file"
      note="Check a patient's file and make the full document"
      right={
        <div className="flex gap-2">
          <button className={outlineBtn} disabled={!result} onClick={() => result && printBlob(result.blob)}><Printer size={14} /> Print</button>
          <button className={outlineBtn} disabled={!result} onClick={() => result && downloadBlob(result.blob, fileName)}><Download size={14} /> Download PDF</button>
          <button className={primaryBtn} disabled={!file || !!building} onClick={create}>{building ? <Loader2 size={14} className="animate-spin" /> : null}{building ? "Making…" : ready ? "Make again" : "Make full document"}</button>
        </div>
      }
    >
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <section>
            <p className={label}>Admission</p>
            <SearchSelect placeholder="Search by patient or admission number…" value={admissionId} onChange={pick} options={options} />
            <p className="mt-1 text-[12px] text-[color:var(--ink-soft)]">
              {loading ? "Fetching the patient's records…" : file ? "Records fetched. Items with records on file are ticked." : "Picking one fetches its prescriptions, notes, charts, reports, consents, bills and documents."}
            </p>
            {loadError && <p role="alert" className="mt-2 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{loadError}</p>}
            {file && file.missing.length > 0 && <p className="mt-2 rounded-[8px] bg-[#fff2d6] px-3 py-2 text-[12px] text-[#8a5300]">Could not read: {file.missing.join(", ")}. Those items may show as empty.</p>}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className={label}>Hospital</label><input className={input} value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} /></div>
            <div><label className={label}>Patient name</label><input className={input} value={patientName} onChange={(e) => setPatientName(e.target.value)} /></div>
            <div><label className={label}>IPD No.</label><input className={input} value={ipdNo} onChange={(e) => setIpdNo(e.target.value)} /></div>
            <div><label className={label}>Admission date</label><input className={input} value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} /></div>
            <div><label className={label}>Discharge date</label><input className={input} value={dischargeDate} onChange={(e) => setDischargeDate(e.target.value)} /></div>
          </section>

          <section>
            <div className="mb-2 flex items-center">
              <p className={`${label} !mb-0`}>File checklist · {checked.length} of {MRD_CHECKLIST_ITEMS.length}</p>
              <button type="button" onClick={() => setChecked(allOn ? [] : MRD_CHECKLIST_ITEMS.map((_, i) => i))} className="ml-auto cursor-pointer text-[12px] font-medium text-[color:var(--brand)] hover:underline">{allOn ? "Clear all" : "Tick all"}</button>
            </div>
            <div className="overflow-hidden rounded-[10px] border border-[color:var(--line)]">
              {MRD_CHECKLIST_ITEMS.map((item, i) => {
                const e = evidence?.[i];
                return (
                  <label key={item} className={`flex cursor-pointer items-center gap-3 px-3 py-[9px] text-[13px] text-[color:var(--ink)] hover:bg-[color:var(--subtle)] ${i > 0 ? "border-t border-[color:var(--subtle-2)]" : ""}`}>
                    <input type="checkbox" checked={checked.includes(i)} onChange={() => toggle(i)} className="h-4 w-4 shrink-0 accent-[color:var(--brand)]" />
                    <span className="w-5 shrink-0 text-[color:var(--ink-soft)]">{i + 1}.</span>
                    <span className="min-w-0 flex-1">{item}</span>
                    {e && i < 17 && (e.count > 0
                      ? <span className="shrink-0 rounded-full border border-[#9fe3c6] bg-[#dffff3] px-2 text-[11px] text-[#0b7a47]">{e.text}</span>
                      : <span className="shrink-0 rounded-full border border-[color:var(--line)] bg-[color:var(--subtle)] px-2 text-[11px] text-[color:var(--ink-soft)]">nothing found</span>)}
                  </label>
                );
              })}
            </div>
            <p className="mt-1 text-[12px] text-[color:var(--ink-soft)]">Ticked items with records go into the PDF after the checklist. Items 18 to 20 are the checker&apos;s own confirmation.</p>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div><label className={label}>MRD staff name</label><input className={input} value={staffName} onChange={(e) => setStaffName(e.target.value)} /></div>
            <div><label className={label}>Date</label><input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <p className="text-[12px] text-[color:var(--ink-soft)] sm:col-span-2">The signature is left blank on the checklist page, to be signed by hand.</p>
          </section>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <p className={label}>Document</p>
          {building && (
            <div className="rounded-[10px] border border-[color:var(--line)] p-5">
              <p className="text-[13px] text-[color:var(--ink)]">{building.label}</p>
              <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-[color:var(--subtle-2)]"><div className="h-full bg-[color:var(--brand)] transition-all" style={{ width: `${Math.round((building.done / Math.max(1, building.total)) * 100)}%` }} /></div>
            </div>
          )}
          {buildError && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{buildError}</p>}
          {!building && result && (
            <>
              {result.stale && <p className="mb-2 rounded-[8px] bg-[#fff2d6] px-3 py-2 text-[12px] text-[#8a5300]">You changed something since this was made. Press “Make again” to update it.</p>}
              {result.notes.length > 0 && <ul className="mb-2 list-disc rounded-[8px] bg-[#fff2d6] py-2 pl-7 pr-3 text-[12px] text-[#8a5300]">{result.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
              <div className="overflow-hidden rounded-[10px] border border-[color:var(--line)] bg-[color:var(--subtle)]">
                <iframe title="MRD file preview" src={result.url} className="h-[780px] w-full" />
              </div>
            </>
          )}
          {!building && !result && !buildError && (
            <div className="rounded-[10px] border border-dashed border-[color:var(--line)] p-10 text-center text-[13px] text-[color:var(--ink-soft)]">
              {file ? "Check the ticks, then press “Make full document”." : "Pick an admission to begin."}
            </div>
          )}
        </div>
      </div>
    </MrdShell>
  );
}
