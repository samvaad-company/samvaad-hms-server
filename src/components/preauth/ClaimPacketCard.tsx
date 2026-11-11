"use client";

/**
 * "One PDF for the insurer": once a pre-auth form is filled, signed and stamped, this puts the form together with the prescription, the
 * patient's reports, their Aadhaar and PAN cards and the policy, into a single PDF with a contents page. The papers are chosen from what
 * the hospital already holds for the patient; a missing Aadhaar, PAN or policy can be uploaded right here.
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
import { formatDate } from "@/lib/dates";

const SLOTS: { kind: Exclude<PacketDocKind, "other">; label: string }[] = [
  { kind: "aadhaar", label: "Aadhaar card" },
  { kind: "pan", label: "PAN card" },
  { kind: "policy", label: "Policy of the patient" },
];
const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";
const btn = "inline-flex h-[34px] items-center gap-2 rounded-full px-4 text-[13px] cursor-pointer disabled:opacity-50";
const size = (b: number) => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`);

function Row({ children }: { children: React.ReactNode }) { return <div className="flex items-center gap-3 border-t border-[color:var(--subtle-2)] py-[9px] first:border-t-0">{children}</div>; }

function PacketDialog({ form, values, getElement, onClose }: { form: PreauthDTO; values: PreauthValues; getElement: () => HTMLElement | null; onClose: () => void }) {
  const hospital = useHospital();
  const { item: options, reload } = useItem<PacketOptionsDTO>(`/preauth/${form.id}/packet`);
  const [rx, setRx] = useState<Set<number>>(new Set());
  const [reports, setReports] = useState<Set<string>>(new Set());
  const [slot, setSlot] = useState<Record<string, number | "">>({ aadhaar: "", pan: "", policy: "" });
  const [others, setOthers] = useState<Set<number>>(new Set());
  const [saveCopy, setSaveCopy] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ pages: number; missing: string[] } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const seeded = useRef(false);
  const pick = useRef<HTMLInputElement>(null);
  const pickFor = useRef<string>("");

  // Start with the newest prescription, every report with a file, and the newest paper of each kind.
  useEffect(() => {
    if (!options || seeded.current) return;
    seeded.current = true;
    setRx(new Set(options.prescriptions.slice(0, 1).map((r) => r.id)));
    setReports(new Set(options.reports.map((r) => r.key)));
    setSlot(Object.fromEntries(SLOTS.map((s) => [s.kind, options.documents.find((d) => d.kind === s.kind)?.id ?? ""])));
  }, [options]);

  const docs = options?.documents ?? [];
  const byKind = (k: PacketDocKind) => docs.filter((d) => d.kind === k);
  const otherDocs = docs.filter((d) => d.kind === "other");
  const missing = SLOTS.filter((s) => slot[s.kind] === "").map((s) => s.label);
  const toggle = <T,>(set: Set<T>, v: T): Set<T> => { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); return n; };

  async function upload(kind: string, file: File) {
    setError(""); setUploading(kind);
    try {
      const body = new FormData();
      body.append("file", file); body.append("kind", kind);
      const res = await fetch(`/api/preauth/${form.id}/packet/upload`, { method: "POST", body, credentials: "same-origin" });
      const json = (await res.json().catch(() => null)) as { data?: { id: number }; error?: { message?: string } } | null;
      if (!res.ok || !json?.data) throw new Error(json?.error?.message ?? "That file couldn't be uploaded.");
      reload();
      setSlot((s) => ({ ...s, [kind]: json.data!.id }));
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); } finally { setUploading(null); }
  }

  async function build() {
    if (!options) return;
    setError(""); setDone(null);
    try {
      setBusy("Preparing the form…");
      let formPdf: PDFDocument;
      if (hasExactForm(form.formKey)) formPdf = await PDFDocument.load(new Uint8Array(await (await buildExactPdf(form, values)).arrayBuffer()));
      else {
        const el = getElement();
        if (!el) throw new Error("Open the form once, then try again.");
        formPdf = await elementToPdf(el);
      }
      setBusy("Collecting the papers…");
      const docIds = [...SLOTS.map((s) => slot[s.kind]).filter((v): v is number => v !== ""), ...others];
      const content = await api.post<PacketContentDTO>(`/preauth/${form.id}/packet`, { prescriptions: [...rx], reports: [...reports], documents: docIds });
      setBusy("Putting it together…");
      const sections: PacketSection[] = [{ title: `Pre-auth form - ${form.formName}`, pdf: formPdf }];
      for (const p of content.prescriptions) sections.push({ title: `Prescription ${p.rxNumber}`, pdf: await prescriptionToPdf(p, hospital.name) });
      const byKey = new Map(content.files.map((f) => [f.key, f]));
      const order = [...reports].map((k) => byKey.get(k)).filter((f): f is NonNullable<typeof f> => !!f);
      for (const f of order) sections.push({ title: f.label, pdf: await fileToPdf(f) });
      for (const id of docIds) { const f = byKey.get(`document:${id}`); if (f) sections.push({ title: f.label, pdf: await fileToPdf(f) }); }
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
  const total = useMemo(() => 1 + rx.size + reports.size + SLOTS.filter((s) => slot[s.kind] !== "").length + others.size, [rx, reports, slot, others]);

  return (
    <Modal open onClose={busy ? () => undefined : onClose} width={760} title="One PDF for the insurer" subtitle={`${form.patientName} · ${form.formName}. Choose what goes in; the form comes first, then each paper in the order below.`}
      footer={<>
        <label className="mr-auto flex cursor-pointer items-center gap-2 text-[12px] text-[color:var(--ink-soft)]"><input type="checkbox" checked={saveCopy} onChange={(e) => setSaveCopy(e.target.checked)} /> Also keep a copy in the patient&apos;s documents</label>
        <button onClick={onClose} disabled={!!busy} className={`${btn} border border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]`}>{done ? "Close" : "Cancel"}</button>
        <button onClick={build} disabled={!options || !!busy || !options.ready} className={`${btn} bg-[color:var(--brand)] text-white hover:bg-[color:var(--brand-hover)]`}>{busy ?? `Create the PDF (${total} ${total === 1 ? "item" : "items"})`}</button>
      </>}>
      {!options ? <p className="py-8 text-center text-[13px] text-[color:var(--ink-soft)]">Looking up what is on file…</p> : (
        <div className="flex flex-col gap-5">
          <input ref={pick} type="file" accept={ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(pickFor.current, f); }} />
          <section>
            <h4 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-[color:var(--ink-soft)]">1 · Pre-auth form</h4>
            <Row><input type="checkbox" checked disabled /><span className="text-[13px] text-[color:var(--ink)]">{form.formName} — filled, signed and stamped</span></Row>
          </section>

          <section>
            <h4 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-[color:var(--ink-soft)]">2 · Prescription</h4>
            {options.prescriptions.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">No prescription on file for this patient.</p> : options.prescriptions.map((r) => (
              <Row key={r.id}><input type="checkbox" checked={rx.has(r.id)} onChange={() => setRx((s) => toggle(s, r.id))} />
                <span className="flex-1 text-[13px] text-[color:var(--ink)]">{r.rxNumber} · {formatDate(r.date)} · {r.doctor}<span className="text-[color:var(--ink-soft)]"> — {r.diagnosis || "no diagnosis"}, {r.medicineCount} {r.medicineCount === 1 ? "medicine" : "medicines"}</span></span></Row>
            ))}
          </section>

          <section>
            <h4 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-[color:var(--ink-soft)]">3 · Reports</h4>
            {options.reports.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">No uploaded reports for this patient.</p> : options.reports.map((r) => (
              <Row key={r.key}><input type="checkbox" checked={reports.has(r.key)} onChange={() => setReports((s) => toggle(s, r.key))} />
                <span className="flex-1 text-[13px] text-[color:var(--ink)]">{r.group} · {r.name}<span className="text-[color:var(--ink-soft)]"> — {formatDate(r.date)} · {r.fileName}</span></span></Row>
            ))}
          </section>

          <section>
            <h4 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-[color:var(--ink-soft)]">4–6 · Aadhaar, PAN and policy</h4>
            {SLOTS.map((s, i) => (
              <Row key={s.kind}>
                <span className="w-[150px] shrink-0 text-[13px] font-medium text-[color:var(--ink)]">{i + 4}. {s.label}</span>
                <select value={slot[s.kind]} onChange={(e) => setSlot((x) => ({ ...x, [s.kind]: e.target.value === "" ? "" : Number(e.target.value) }))}
                  className="h-[34px] min-w-0 flex-1 rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 text-[13px]">
                  <option value="">{byKind(s.kind).length ? "Leave out" : "Not on file — upload one"}</option>
                  {byKind(s.kind).map((d) => <option key={d.id} value={d.id}>{docLabel(d)}</option>)}
                  {otherDocs.length > 0 && <optgroup label="Other papers on file">{otherDocs.map((d) => <option key={d.id} value={d.id}>{docLabel(d)}</option>)}</optgroup>}
                </select>
                <button type="button" disabled={uploading !== null} onClick={() => { pickFor.current = s.kind; pick.current?.click(); }} className={`${btn} border border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]`}><Upload size={13} /> {uploading === s.kind ? "Uploading…" : "Upload"}</button>
              </Row>
            ))}
          </section>

          {otherDocs.length > 0 && (
            <section>
              <h4 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-[color:var(--ink-soft)]">Anything else on file (optional)</h4>
              {otherDocs.map((d) => (
                <Row key={d.id}><input type="checkbox" checked={others.has(d.id)} onChange={() => setOthers((s) => toggle(s, d.id))} /><span className="flex-1 text-[13px] text-[color:var(--ink)]">{docLabel(d)}<span className="text-[color:var(--ink-soft)]"> · {d.category}</span></span></Row>
              ))}
            </section>
          )}

          {missing.length > 0 && !done && <p className="rounded-[8px] bg-[#fff6dd] px-3 py-2 text-[12px] text-[#7a4a00]">Not included yet: {missing.join(", ")}. You can still create the PDF without {missing.length === 1 ? "it" : "them"}.</p>}
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
        <p className="text-[12px] text-[color:var(--ink-soft)]">The form is signed and stamped. Combine it with the prescription, the patient&apos;s reports, Aadhaar, PAN and policy into a single PDF.</p>
      </div>
      <button type="button" onClick={() => setOpen(true)} className={`${btn} bg-[color:var(--brand)] text-white hover:bg-[color:var(--brand-hover)]`}><FileStack size={14} /> Combine into one PDF</button>
      {open && <PacketDialog form={form} values={values} getElement={getElement} onClose={() => setOpen(false)} />}
    </section>
  );
}
