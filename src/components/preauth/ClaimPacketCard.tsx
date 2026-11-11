"use client";

/**
 * "One PDF for the insurer": once a pre-auth form is filled, signed and stamped, this puts the form together with the prescriptions, the
 * patient's lab and radiology reports, their Aadhaar and PAN cards, the policy and any other file into a single PDF with a contents page.
 * It is a short step-by-step dialog: form, prescriptions (by date range), reports (by date range), ID and policy, other files.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { FileStack, Upload } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { api } from "@/lib/api/client";
import { useItem } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { useHospital } from "@/components/shared/DocumentLetterhead";
import { buildExactPdf, hasExactForm } from "@/lib/preauth/exact";
import { downloadPdf, elementToPdf, fileToPdf, mergePacket, prescriptionToPdf, type PacketSection } from "@/lib/preauth/packet";
import type { PacketContentDTO, PacketDocKind, PacketDocumentOption, PacketOptionsDTO, PreauthDTO, PreauthValues } from "@/types/preauth";
import { formatDate, toIsoDate, todayIso } from "@/lib/dates";

const SLOTS: { kind: Exclude<PacketDocKind, "other">; label: string }[] = [
  { kind: "aadhaar", label: "Aadhaar card" },
  { kind: "pan", label: "PAN card" },
  { kind: "policy", label: "Policy of the patient" },
];
const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";
const btn = "inline-flex h-[34px] items-center gap-2 rounded-full px-4 text-[13px] cursor-pointer disabled:opacity-50";
const size = (b: number) => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`);

function Row({ children }: { children: React.ReactNode }) { return <div className="flex items-center gap-3 border-t border-[color:var(--subtle-2)] py-[9px] first:border-t-0">{children}</div>; }

const STEPS = ["Form", "Prescriptions", "Lab & radiology", "ID & policy", "Other files"] as const;
const inputCls = "h-[34px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 text-[13px]";
const iso = (d: string) => toIsoDate(d);
const inRange = (d: string, from: string, to: string) => { const x = iso(d); return !x || ((!from || x >= from) && (!to || x <= to)); };

/** The patient (fixed: the PDF is for the form's own patient) and a date range with a Fetch button. */
function RangeBar({ patient, from, to, onFrom, onTo, onFetch, label }: { patient: string; from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void; onFetch: () => void; label: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-end gap-3 rounded-[10px] bg-[color:var(--subtle)] p-3">
      <label className="flex min-w-[180px] flex-1 flex-col gap-1"><span className="text-[11px] text-[color:var(--ink-soft)]">Patient</span><input value={patient} readOnly className={`${inputCls} bg-[color:var(--surface)] font-medium`} aria-label="Patient" /></label>
      <label className="flex flex-col gap-1"><span className="text-[11px] text-[color:var(--ink-soft)]">From</span><input type="date" value={from} max={to || undefined} onChange={(e) => onFrom(e.target.value)} className={inputCls} aria-label="From date" /></label>
      <label className="flex flex-col gap-1"><span className="text-[11px] text-[color:var(--ink-soft)]">To</span><input type="date" value={to} min={from || undefined} onChange={(e) => onTo(e.target.value)} className={inputCls} aria-label="To date" /></label>
      <button type="button" onClick={onFetch} className={`${btn} bg-[color:var(--brand)] text-white hover:bg-[color:var(--brand-hover)]`}>{label}</button>
    </div>
  );
}

function PacketDialog({ form, values, getElement, onClose }: { form: PreauthDTO; values: PreauthValues; getElement: () => HTMLElement | null; onClose: () => void }) {
  const hospital = useHospital();
  const { item: options, reload } = useItem<PacketOptionsDTO>(`/preauth/${form.id}/packet`);
  const [step, setStep] = useState(0);
  const [withForm, setWithForm] = useState(true);
  const [rx, setRx] = useState<Set<number>>(new Set());
  const [reports, setReports] = useState<Set<string>>(new Set());
  const [slot, setSlot] = useState<Record<string, number | "">>({ aadhaar: "", pan: "", policy: "" });
  const [extra, setExtra] = useState<{ id: number; name: string; on: boolean }[]>([]);
  // The range typed in, and the range last fetched (the lists show what was fetched).
  const [rxRange, setRxRange] = useState({ from: "", to: todayIso() });
  const [rxFetched, setRxFetched] = useState({ from: "", to: todayIso() });
  const [repRange, setRepRange] = useState({ from: "", to: todayIso() });
  const [repFetched, setRepFetched] = useState<{ from: string; to: string } | null>(null);
  const [saveCopy, setSaveCopy] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ pages: number; missing: string[] } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const seeded = useRef(false);
  const pick = useRef<HTMLInputElement>(null);
  const pickFor = useRef<string>("");

  // Start with the newest prescription and the newest paper of each kind.
  useEffect(() => {
    if (!options || seeded.current) return;
    seeded.current = true;
    setRx(new Set(options.prescriptions.slice(0, 1).map((r) => r.id)));
    setSlot(Object.fromEntries(SLOTS.map((s) => [s.kind, options.documents.find((d) => d.kind === s.kind)?.id ?? ""])));
  }, [options]);

  const docs = options?.documents ?? [];
  const byKind = (k: PacketDocKind) => docs.filter((d) => d.kind === k);
  const missing = SLOTS.filter((s) => slot[s.kind] === "").map((s) => s.label);
  const toggle = <T,>(set: Set<T>, v: T): Set<T> => { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); return n; };

  const rxList = (options?.prescriptions ?? []).filter((r) => inRange(r.date, rxFetched.from, rxFetched.to));
  const repList = repFetched ? (options?.reports ?? []).filter((r) => inRange(r.date, repFetched.from, repFetched.to)) : [];

  function fetchRx() {
    setRxFetched(rxRange);
    const keep = (options?.prescriptions ?? []).filter((r) => inRange(r.date, rxRange.from, rxRange.to) && rx.has(r.id)).map((r) => r.id);
    setRx(new Set(keep));
  }
  function fetchReports(r = repRange) {
    setRepFetched(r);
    setReports(new Set((options?.reports ?? []).filter((x) => inRange(x.date, r.from, r.to)).map((x) => x.key)));
  }
  function go(to: number) {
    // Arriving at the reports step the first time: the range chosen for prescriptions carries over, and the reports in it are fetched.
    if (to >= 2 && !repFetched) { setRepRange(rxFetched); fetchReports(rxFetched); }
    setStep(to);
  }

  async function upload(kind: string, file: File) {
    setError(""); setUploading(kind);
    try {
      const body = new FormData();
      body.append("file", file); body.append("kind", kind);
      const res = await fetch(`/api/preauth/${form.id}/packet/upload`, { method: "POST", body, credentials: "same-origin" });
      const json = (await res.json().catch(() => null)) as { data?: { id: number }; error?: { message?: string } } | null;
      if (!res.ok || !json?.data) throw new Error(json?.error?.message ?? "That file couldn't be uploaded.");
      if (kind === "other") setExtra((x) => [...x, { id: json.data!.id, name: file.name, on: true }]);
      else { reload(); setSlot((s) => ({ ...s, [kind]: json.data!.id })); }
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); } finally { setUploading(null); }
  }

  async function build() {
    if (!options) return;
    setError(""); setDone(null);
    try {
      setBusy("Preparing the form…");
      let formPdf: PDFDocument | null = null;
      if (withForm) {
        if (hasExactForm(form.formKey)) formPdf = await PDFDocument.load(new Uint8Array(await (await buildExactPdf(form, values)).arrayBuffer()));
        else {
          const el = getElement();
          if (!el) throw new Error("Open the form once, then try again.");
          formPdf = await elementToPdf(el);
        }
      }
      setBusy("Collecting the papers…");
      const others = extra.filter((e) => e.on).map((e) => e.id);
      const docIds = [...SLOTS.map((s) => slot[s.kind]).filter((v): v is number => v !== ""), ...others];
      const rxIds = rxList.filter((r) => rx.has(r.id)).map((r) => r.id);
      const repKeys = repList.filter((r) => reports.has(r.key)).map((r) => r.key);
      const content = await api.post<PacketContentDTO>(`/preauth/${form.id}/packet`, { prescriptions: rxIds, reports: repKeys, documents: docIds });
      setBusy("Putting it together…");
      const sections: PacketSection[] = formPdf ? [{ title: `Pre-auth form - ${form.formName}`, pdf: formPdf }] : [];
      for (const p of content.prescriptions) sections.push({ title: `Prescription ${p.rxNumber}`, pdf: await prescriptionToPdf(p, hospital.name) });
      const byKey = new Map(content.files.map((f) => [f.key, f]));
      for (const k of repKeys) { const f = byKey.get(k); if (f) sections.push({ title: f.label, pdf: await fileToPdf(f) }); }
      for (const id of docIds) { const f = byKey.get(`document:${id}`); if (f) sections.push({ title: f.label, pdf: await fileToPdf(f) }); }
      if (sections.length === 0) throw new Error("Choose at least one thing to include.");
      const { blob, pages } = await mergePacket({ title: `${form.patientName} - ${form.formName}`, patient: form.patientName, insurer: form.formName, hospital: hospital.name, sections });
      const name = `Claim packet - ${form.patientName} - ${form.formName}.pdf`;
      downloadPdf(blob, name);
      if (saveCopy && form.patientId) {
        setBusy("Saving a copy to the patient's documents…");
        const body = new FormData();
        body.append("file", new File([blob], name, { type: "application/pdf" }));
        body.append("ownerType", "patient"); body.append("ownerId", String(form.patientId)); body.append("category", "Claim packet"); body.append("title", `Claim packet - ${form.formName}`);
        await fetch("/api/documents", { method: "POST", body, credentials: "same-origin" }).catch(() => null);
      }
      setDone({ pages, missing });
    } catch (e) { setError(e instanceof Error ? e.message : "The PDF couldn't be made."); } finally { setBusy(null); }
  }

  const docLabel = (d: PacketDocumentOption) => `${d.title || d.fileName} · ${size(d.sizeBytes)} · ${formatDate(d.uploadedAt.slice(0, 10))}`;
  const total = useMemo(
    () => (withForm ? 1 : 0) + rxList.filter((r) => rx.has(r.id)).length + repList.filter((r) => reports.has(r.key)).length + SLOTS.filter((s) => slot[s.kind] !== "").length + extra.filter((e) => e.on).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [withForm, rx, reports, slot, extra, options, rxFetched, repFetched],
  );
  const h = "mb-1 text-[12px] font-semibold uppercase tracking-wide text-[color:var(--ink-soft)]";
  const last = step === STEPS.length - 1;

  return (
    <Modal open onClose={busy ? () => undefined : onClose} width={760} title="One PDF for the insurer" subtitle={`${form.patientName} · ${form.formName}. Five short steps; the PDF is made at the end.`}
      footer={<>
        {last && <label className="mr-auto flex cursor-pointer items-center gap-2 text-[12px] text-[color:var(--ink-soft)]"><input type="checkbox" checked={saveCopy} onChange={(e) => setSaveCopy(e.target.checked)} /> Also keep a copy in the patient&apos;s documents</label>}
        {!last && <span className="mr-auto text-[12px] text-[color:var(--ink-soft)]">{total} {total === 1 ? "item" : "items"} chosen so far</span>}
        <button onClick={step === 0 ? onClose : () => setStep(step - 1)} disabled={!!busy} className={`${btn} border border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]`}>{step === 0 ? (done ? "Close" : "Cancel") : "Back"}</button>
        {last
          ? <button onClick={build} disabled={!options || !!busy || !options.ready || total === 0} className={`${btn} bg-[color:var(--brand)] text-white hover:bg-[color:var(--brand-hover)]`}>{busy ?? `Create the PDF (${total} ${total === 1 ? "item" : "items"})`}</button>
          : <button onClick={() => go(step + 1)} className={`${btn} bg-[color:var(--brand)] text-white hover:bg-[color:var(--brand-hover)]`}>Next</button>}
      </>}>
      {!options ? <p className="py-8 text-center text-[13px] text-[color:var(--ink-soft)]">Looking up what is on file…</p> : (
        <div className="flex flex-col gap-4">
          <input ref={pick} type="file" accept={ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(pickFor.current, f); }} />
          <ol className="flex items-center gap-1 overflow-x-auto">
            {STEPS.map((t, i) => (
              <li key={t} className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => go(i)} className={`flex items-center gap-2 rounded-full px-3 py-[5px] text-[12px] cursor-pointer ${i === step ? "bg-[color:var(--brand-soft)] text-[color:var(--brand)] font-medium" : i < step ? "text-[color:var(--ink)]" : "text-[color:var(--ink-soft)]"}`}>
                  <span className={`grid h-[18px] w-[18px] place-items-center rounded-full text-[10px] ${i <= step ? "bg-[color:var(--brand)] text-white" : "border border-[color:var(--line)]"}`}>{i < step ? "✓" : i + 1}</span>{t}
                </button>
                {i < STEPS.length - 1 && <span className="h-px w-4 bg-[color:var(--line)]" />}
              </li>
            ))}
          </ol>

          {step === 0 && (
            <section>
              <h4 className={h}>Pre-auth form</h4>
              <Row><input type="checkbox" checked={withForm} onChange={(e) => setWithForm(e.target.checked)} /><span className="text-[13px] text-[color:var(--ink)]">{form.formName} — filled, signed and stamped <span className="text-[color:var(--ink-soft)]">(goes first in the PDF)</span></span></Row>
            </section>
          )}

          {step === 1 && (
            <section>
              <h4 className={h}>Prescriptions</h4>
              <RangeBar patient={form.patientName} from={rxRange.from} to={rxRange.to} onFrom={(v) => setRxRange((r) => ({ ...r, from: v }))} onTo={(v) => setRxRange((r) => ({ ...r, to: v }))} onFetch={fetchRx} label="Fetch prescriptions" />
              {rxList.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">No prescription for this patient in that range.</p> : rxList.map((r) => (
                <Row key={r.id}><input type="checkbox" checked={rx.has(r.id)} onChange={() => setRx((s) => toggle(s, r.id))} />
                  <span className="flex-1 text-[13px] text-[color:var(--ink)]">{r.rxNumber} · {formatDate(iso(r.date))} · {r.doctor}<span className="text-[color:var(--ink-soft)]"> — {r.diagnosis || "no diagnosis"}, {r.medicineCount} {r.medicineCount === 1 ? "medicine" : "medicines"}</span></span></Row>
              ))}
            </section>
          )}

          {step === 2 && (
            <section>
              <h4 className={h}>Lab and radiology reports</h4>
              <RangeBar patient={form.patientName} from={repRange.from} to={repRange.to} onFrom={(v) => setRepRange((r) => ({ ...r, from: v }))} onTo={(v) => setRepRange((r) => ({ ...r, to: v }))} onFetch={() => fetchReports()} label="Fetch reports" />
              {repList.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">No lab or radiology report with a file in that range.</p> : (["Lab", "Radiology"] as const).map((g) => {
                const rows = repList.filter((r) => r.group === g);
                return rows.length === 0 ? null : (
                  <div key={g} className="mb-2">
                    <p className="mt-1 text-[11px] font-semibold text-[color:var(--ink-soft)]">{g}</p>
                    {rows.map((r) => (
                      <Row key={r.key}><input type="checkbox" checked={reports.has(r.key)} onChange={() => setReports((s) => toggle(s, r.key))} />
                        <span className="flex-1 text-[13px] text-[color:var(--ink)]">{r.name}<span className="text-[color:var(--ink-soft)]"> — {formatDate(iso(r.date))} · {r.fileName}</span></span></Row>
                    ))}
                  </div>
                );
              })}
            </section>
          )}

          {step === 3 && (
            <section>
              <h4 className={h}>Aadhaar, PAN and policy</h4>
              {SLOTS.map((s) => (
                <Row key={s.kind}>
                  <span className="w-[150px] shrink-0 text-[13px] font-medium text-[color:var(--ink)]">{s.label}</span>
                  <select value={slot[s.kind]} onChange={(e) => setSlot((x) => ({ ...x, [s.kind]: e.target.value === "" ? "" : Number(e.target.value) }))}
                    className="h-[34px] min-w-0 flex-1 rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 text-[13px]">
                    <option value="">{byKind(s.kind).length ? "Leave out" : "Not on file — upload one"}</option>
                    {byKind(s.kind).map((d) => <option key={d.id} value={d.id}>{docLabel(d)}</option>)}
                  </select>
                  <button type="button" disabled={uploading !== null} onClick={() => { pickFor.current = s.kind; pick.current?.click(); }} className={`${btn} border border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]`}><Upload size={13} /> {uploading === s.kind ? "Uploading…" : "Upload"}</button>
                </Row>
              ))}
              {missing.length > 0 && <p className="mt-2 rounded-[8px] bg-[#fff6dd] px-3 py-2 text-[12px] text-[#7a4a00]">Not included yet: {missing.join(", ")}. You can still create the PDF without {missing.length === 1 ? "it" : "them"}.</p>}
            </section>
          )}

          {step === 4 && (
            <section>
              <h4 className={h}>Other files</h4>
              <p className="mb-2 text-[12px] text-[color:var(--ink-soft)]">Add any other paper the insurer asked for (PDF or picture). It goes at the end of the PDF.</p>
              {extra.map((e) => (
                <Row key={e.id}><input type="checkbox" checked={e.on} onChange={() => setExtra((x) => x.map((y) => (y.id === e.id ? { ...y, on: !y.on } : y)))} /><span className="flex-1 text-[13px] text-[color:var(--ink)]">{e.name}</span></Row>
              ))}
              <button type="button" disabled={uploading !== null} onClick={() => { pickFor.current = "other"; pick.current?.click(); }} className={`${btn} mt-2 border border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]`}><Upload size={13} /> {uploading === "other" ? "Uploading…" : "Upload a file"}</button>
              <p className="mt-4 text-[12px] text-[color:var(--ink-soft)]">Ready: {total} {total === 1 ? "item" : "items"} will go into the PDF.</p>
            </section>
          )}

          {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#ff0004]">{error}</p>}
          {done && <p className="rounded-[8px] bg-[#dffff3] px-3 py-2 text-[13px] text-[#0b7a47]">The PDF ({done.pages} pages) has been downloaded.{done.missing.length ? ` It does not include: ${done.missing.join(", ")}.` : ""}</p>}
        </div>
      )}
    </Modal>
  );
}

export function ClaimPacketCard({ form, values, getElement }: { form: PreauthDTO; values: PreauthValues; getElement: () => HTMLElement | null }) {
  const [open, setOpen] = useState(false);
  if (form.status !== "Ready") return null;
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3">
      <FileStack size={20} className="shrink-0 text-[color:var(--brand)]" />
      <div className="min-w-[220px] flex-1">
        <h3 className="text-[13px] font-semibold text-[color:var(--ink)]">One PDF for the insurer</h3>
        <p className="text-[12px] text-[color:var(--ink-soft)]">The form is signed and stamped. Combine it with the prescriptions, the patient&apos;s reports, Aadhaar, PAN, policy and any other file into a single PDF.</p>
      </div>
      <button type="button" onClick={() => setOpen(true)} className={`${btn} bg-[color:var(--brand)] text-white hover:bg-[color:var(--brand-hover)]`}><FileStack size={14} /> Combine into one PDF</button>
      {open && <PacketDialog form={form} values={values} getElement={getElement} onClose={() => setOpen(false)} />}
    </section>
  );
}
