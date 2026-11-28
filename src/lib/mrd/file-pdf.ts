/**
 * The whole MRD file as one PDF: the checklist first, then — for every item the checker ticked — the records the system holds
 * for it (written out as pages) and the files behind it (uploaded reports and scans, put in as they are). Runs in the browser.
 */
import type { PDFDocument, PDFFont, PDFPage } from "pdf-lib";
import { api } from "@/lib/api/client";
import { formatDate } from "@/lib/dates";
import { bmiOf, filledFields } from "@/lib/consultation/templates";
import { MRD_CHECKLIST_ITEMS, drawChecklistPage, safe, type MrdChecklistData } from "@/lib/mrd/checklist";
import { isAdmissionConsent, isCounselling, isDischargeSummary, isInsuranceDoc, isReportDoc, type MrdFileData } from "@/lib/mrd/file-data";
import { buildCaseFilePdf } from "@/lib/casefile/pdf";
import type { Consultation } from "@/types/consultation";
import type { DocumentDTO } from "@/types/api";

const A4: [number, number] = [595.28, 841.89];
const M = 44;

type Progress = (done: number, total: number, label: string) => void;

class Writer {
  page!: PDFPage;
  y = 0;
  private title = "";
  constructor(private pdf: PDFDocument, private font: PDFFont, private bold: PDFFont, private rgb: typeof import("pdf-lib").rgb, private head: { hospital: string; patient: string }) {}

  private ink() { return this.rgb(0.1, 0.12, 0.16); }
  private soft() { return this.rgb(0.42, 0.45, 0.5); }

  width(t: string, size: number, bold = false) { return (bold ? this.bold : this.font).widthOfTextAtSize(safe(t), size); }

  /** A new page for an item (or the continuation of one), with the running header. */
  begin(title: string, cont = false) {
    this.title = title;
    this.page = this.pdf.addPage(A4);
    const p = this.page;
    p.drawText(safe(this.head.hospital).slice(0, 70), { x: M, y: A4[1] - 26, size: 8, font: this.font, color: this.soft() });
    const r = safe(this.head.patient);
    p.drawText(r, { x: A4[0] - M - this.font.widthOfTextAtSize(r, 8), y: A4[1] - 26, size: 8, font: this.font, color: this.soft() });
    p.drawLine({ start: { x: M, y: A4[1] - 32 }, end: { x: A4[0] - M, y: A4[1] - 32 }, thickness: 0.5, color: this.rgb(0.75, 0.77, 0.8) });
    this.y = A4[1] - 58;
    p.drawText(safe(cont ? `${title} (continued)` : title), { x: M, y: this.y, size: 14, font: this.bold, color: this.ink() });
    this.y -= 24;
  }

  ensure(h: number) { if (this.y - h < M + 14) this.begin(this.title, true); }

  gap(n = 8) { this.y -= n; }

  sub(text: string) {
    this.ensure(30); this.gap(6);
    this.page.drawText(safe(text), { x: M, y: this.y, size: 11, font: this.bold, color: this.ink() });
    this.y -= 16;
  }

  wrap(text: string, size: number, max: number, bold = false): string[] {
    const out: string[] = [];
    for (const para of safe(text).split(/\r?\n/)) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const t = line ? `${line} ${word}` : word;
        if (this.width(t, size, bold) <= max) { line = t; continue; }
        if (line) out.push(line);
        // A word longer than the line is cut to fit.
        let w = word;
        while (this.width(w, size, bold) > max && w.length > 1) { let n = w.length; while (n > 1 && this.width(w.slice(0, n), size, bold) > max) n--; out.push(w.slice(0, n)); w = w.slice(n); }
        line = w;
      }
      out.push(line);
    }
    return out;
  }

  para(text: string, size = 10, indent = 0) {
    for (const l of this.wrap(text, size, A4[0] - 2 * M - indent)) {
      this.ensure(size + 5);
      this.page.drawText(l, { x: M + indent, y: this.y, size, font: this.font, color: this.ink() });
      this.y -= size + 4;
    }
  }

  /** "Label: value" lines in two columns. */
  kv(pairs: [string, string][]) {
    const col = (A4[0] - 2 * M) / 2;
    const rows = pairs.filter(([, v]) => v && v.trim());
    for (let i = 0; i < rows.length; i += 2) {
      const cells = rows.slice(i, i + 2).map(([k, v]) => ({ k, lines: this.wrap(v, 10, col - 100) }));
      const h = Math.max(...cells.map((c) => c.lines.length)) * 14;
      this.ensure(h + 4);
      cells.forEach((c, j) => {
        const x = M + j * col;
        this.page.drawText(safe(c.k), { x, y: this.y, size: 9, font: this.bold, color: this.soft() });
        c.lines.forEach((l, n) => this.page.drawText(l, { x: x + 92, y: this.y - n * 14, size: 10, font: this.font, color: this.ink() }));
      });
      this.y -= h + 4;
    }
  }

  table(cols: { label: string; w: number }[], rows: string[][]) {
    const total = A4[0] - 2 * M;
    const sum = cols.reduce((a, c) => a + c.w, 0);
    const widths = cols.map((c) => (c.w / sum) * total);
    const header = () => {
      this.ensure(30);
      this.page.drawRectangle({ x: M, y: this.y - 5, width: total, height: 18, color: this.rgb(0.93, 0.94, 0.96) });
      let x = M;
      cols.forEach((c, i) => { this.page.drawText(safe(c.label), { x: x + 4, y: this.y, size: 8.5, font: this.bold, color: this.ink() }); x += widths[i]; });
      this.y -= 20;
    };
    header();
    for (const r of rows) {
      const cells = r.map((t, i) => this.wrap(t || "–", 9, widths[i] - 8));
      const h = Math.max(...cells.map((c) => c.length)) * 12 + 6;
      if (this.y - h < M + 14) { this.begin(this.title, true); header(); }
      let x = M;
      cells.forEach((lines, i) => { lines.forEach((l, n) => this.page.drawText(l, { x: x + 4, y: this.y - n * 12, size: 9, font: this.font, color: this.ink() })); x += widths[i]; });
      this.y -= h;
      this.page.drawLine({ start: { x: M, y: this.y + 8 }, end: { x: M + total, y: this.y + 8 }, thickness: 0.3, color: this.rgb(0.82, 0.84, 0.87) });
    }
    this.gap(6);
  }

  async image(dataUrl: string, maxW: number, maxH: number) {
    try {
      const bytes = dataToBytes(dataUrl);
      const img = /^data:image\/jpe?g/i.test(dataUrl) ? await this.pdf.embedJpg(bytes) : await this.pdf.embedPng(bytes);
      const k = Math.min(maxW / img.width, maxH / img.height, 1);
      this.ensure(img.height * k + 10);
      this.page.drawImage(img, { x: M, y: this.y - img.height * k, width: img.width * k, height: img.height * k });
      this.y -= img.height * k + 8;
    } catch { /* an unreadable signature image is skipped */ }
  }
}

function dataToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const dt = (date?: string | null, time?: string | null) => [date ? formatDate(date) : "", time ?? ""].filter(Boolean).join(" ");
const stamp = (iso?: string | null) => (iso ? `${formatDate(iso.slice(0, 10))} ${iso.slice(11, 16)}` : "");

function consultationText(c: Consultation): string[] {
  const out: string[] = [];
  if (c.chiefComplaint?.trim()) out.push(`Chief complaint: ${c.chiefComplaint}`);
  const h = c.history;
  for (const [k, v] of [["Past history", h?.past], ["Family history", h?.family], ["Personal history", h?.personal], ["Medication history", h?.medical]] as const) if (v?.trim()) out.push(`${k}: ${v}`);
  const v = c.vitals;
  const bmi = v ? bmiOf(v.weight, v.height) : "";
  const vit = v ? [v.bp && `BP ${v.bp}`, v.pulse && `Pulse ${v.pulse}`, v.temp && `Temp ${v.temp} F`, v.spo2 && `SpO2 ${v.spo2}%`, v.weight && `Weight ${v.weight} kg`, v.height && `Height ${v.height} cm`, bmi && `BMI ${bmi}`].filter(Boolean) : [];
  if (vit.length) out.push(`Vitals: ${vit.join(", ")}`);
  const gen = filledFields(c.general ?? []);
  if (gen.length) out.push(`General examination: ${gen.map((f) => `${f.label} ${f.value}`).join(", ")}`);
  for (const s of c.systemic ?? []) { const f = filledFields(s.fields); if (f.length) out.push(`${s.title}: ${f.map((x) => `${x.label} ${x.value}`).join(", ")}`); }
  if (c.investigations?.length) out.push(`Investigations advised: ${c.investigations.join(", ")}`);
  if (c.secondaryDiagnosis?.trim()) out.push(`Secondary diagnosis: ${c.secondaryDiagnosis}`);
  if (c.advice) { const a = [c.advice.diet && `Diet: ${c.advice.diet}`, c.advice.exercise && `Exercise: ${c.advice.exercise}`, c.advice.other && c.advice.other].filter(Boolean); if (a.length) out.push(`Advice: ${a.join("; ")}`); }
  if (c.followUp) out.push(`Follow-up: ${formatDate(c.followUp)}`);
  return out;
}

export async function buildMrdFilePdf(opts: {
  checklist: MrdChecklistData;
  file: MrdFileData;
  onProgress?: Progress;
}): Promise<{ blob: Blob; notes: string[] }> {
  const { checklist, file, onProgress } = opts;
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const notes: string[] = [];
  const cf = file.caseFile;
  const a = file.admission;
  const w = new Writer(pdf, font, bold, rgb, { hospital: checklist.hospitalName, patient: `${checklist.patientName}${checklist.ipdNo ? `  |  ${checklist.ipdNo}` : ""}` });

  const ticked = new Set(checklist.checked);
  const jobs = MRD_CHECKLIST_ITEMS.map((_, i) => i).filter((i) => ticked.has(i));
  let done = 0;
  const step = (label: string) => onProgress?.(done, jobs.length + 1, label);

  step("Checklist");
  await drawChecklistPage(pdf, checklist);
  const tag = (i: number) => `${i + 1}. ${MRD_CHECKLIST_ITEMS[i]}`;

  /** Another PDF's pages, or an image as a page, with a small caption in the top margin. */
  async function attach(caption: string, bytes: Uint8Array, mime: string, name: string): Promise<boolean> {
    try {
      const start = pdf.getPageCount();
      if (/pdf/i.test(mime) || /\.pdf$/i.test(name)) {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        (await pdf.copyPages(src, src.getPageIndices())).forEach((p) => pdf.addPage(p));
      } else if (/^image\/(png|jpe?g)/i.test(mime) || /\.(png|jpe?g)$/i.test(name)) {
        const img = /png/i.test(mime) || /\.png$/i.test(name) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        const page = pdf.addPage(A4);
        const k = Math.min((A4[0] - 2 * M) / img.width, (A4[1] - 2 * M - 20) / img.height);
        page.drawImage(img, { x: (A4[0] - img.width * k) / 2, y: A4[1] - M - 14 - img.height * k, width: img.width * k, height: img.height * k });
      } else return false;
      for (let p = start; p < pdf.getPageCount(); p++) {
        const pg = pdf.getPage(p);
        const { height } = pg.getSize();
        pg.drawText(safe(caption).slice(0, 110), { x: 14, y: height - 14, size: 7.5, font, color: rgb(0.42, 0.45, 0.5) });
      }
      return true;
    } catch { return false; }
  }

  const fetchBytes = async (url: string) => {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error(String(res.status));
    return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get("content-type") ?? "" };
  };
  const attachDocument = async (caption: string, d: DocumentDTO) => {
    try {
      const { bytes, mime } = await fetchBytes(d.url);
      if (!(await attach(`${caption} - ${d.title || d.fileName}`, bytes, d.mimeType || mime, d.fileName))) notes.push(`${d.title || d.fileName} could not be put in (not a PDF or picture)`);
    } catch { notes.push(`${d.title || d.fileName} could not be fetched`); }
  };
  const attachCaseForms = async (keys: string[], caption: string) => {
    if (!cf) return;
    const present = keys.filter((k) => (cf.forms[k]?.version ?? 0) > 0);
    if (!present.length) return;
    try {
      const blob = await buildCaseFilePdf(cf, present);
      await attach(caption, new Uint8Array(await blob.arrayBuffer()), "application/pdf", "case.pdf");
    } catch { notes.push(`${caption}: the case file forms could not be added`); }
  };

  for (const i of jobs) {
    step(tag(i));
    switch (i) {
      case 0: {
        w.begin(tag(i));
        const p = file.patient;
        w.kv([
          ["Patient name", a.patientName], ["Age / Gender", `${a.patientAge} yrs${a.gender ? ` / ${a.gender}` : ""}`],
          ["Date of birth", p?.dob ? formatDate(p.dob) : ""], ["UHID", a.patientId], ["IPD No.", a.admissionNo], ["Admission date", formatDate(a.admissionDate)],
          ["Discharge date", a.dischargeDate ? formatDate(a.dischargeDate) : ""], ["Ward / Bed", [a.ward, a.bed].filter(Boolean).join(" / ")],
          ["Doctor", a.doctor], ["Admission type", a.admissionType], ["Phone", p?.phone ?? ""], ["Address", [p?.address, p?.addressLine2, p?.city].filter(Boolean).join(", ")],
          ["Family contact", [a.familyName, a.familyRelation, a.familyPhone].filter(Boolean).join(", ")], ["Allergies", cf?.patient.allergies ?? ""],
        ]);
        break;
      }
      case 1: {
        w.begin(tag(i));
        w.kv([["Diagnosis", a.diagnosis]]);
        await attachCaseForms(["diagnosis_plan"], tag(i));
        break;
      }
      case 2: {
        const first = [...file.prescriptions].filter((r) => r.consultation).sort((x, y) => x.id - y.id)[0];
        if (first?.consultation) {
          w.begin(tag(i));
          w.para(`${first.rxNumber}  |  ${first.date}  |  ${first.doctor}`, 9);
          w.gap(4);
          consultationText(first.consultation).forEach((l) => { w.para(l, 10); w.gap(2); });
        }
        await attachCaseForms(["admission_history", "past_history", "physical_exam"], tag(i));
        break;
      }
      case 3: {
        const list = cf?.linked.prescriptions ?? [];
        if (list.length) {
          w.begin(tag(i));
          for (const r of list) {
            w.sub(`${r.rx}  -  ${r.date}  -  ${r.doctor}`);
            if (r.diagnosis) w.para(`Diagnosis: ${r.diagnosis}`, 9.5);
            w.gap(2);
            w.table([{ label: "Medicine", w: 3 }, { label: "Dosage", w: 1.4 }, { label: "Frequency", w: 1.4 }, { label: "Duration", w: 1.2 }, { label: "Instructions", w: 2.4 }], r.items.map((m) => [m.name, m.dosage, m.frequency, m.duration, m.instructions]));
          }
        }
        break;
      }
      case 4:
      case 5: {
        const mine = file.consents.filter((c) => isAdmissionConsent(c.consent) === (i === 5));
        if (mine.length) {
          w.begin(tag(i));
          for (const { consent: c, doc } of mine) {
            w.sub(c.formTitle);
            w.kv([
              ["Status", c.status], ["Made", stamp(c.madeAt)], ["Signed by", [c.signerName, c.signerRelation].filter(Boolean).join(", ")], ["Signed on", stamp(c.signedAt)],
              ["Signed via", c.signedVia ?? ""], ["Witness", c.witnessName ?? ""], ["Language", c.language],
            ]);
            const text = doc?.texts?.[doc.language]?.body ?? doc?.texts?.English?.body ?? c.formBody;
            if (text) { w.gap(2); w.para(text.slice(0, 3500), 9); }
            if (doc?.signatureData) { w.gap(4); await w.image(doc.signatureData, 200, 70); }
            w.gap(10);
          }
          for (const { consent: c } of mine) {
            const d = c.signedDocumentId != null ? file.documents.find((x) => x.id === c.signedDocumentId) : undefined;
            if (d) await attachDocument(`${tag(i)} - signed copy`, d);
          }
        }
        break;
      }
      case 6: {
        const rows = [
          ...(cf?.linked.dailyNotes ?? []).map((n) => ({ ...n, kind: "Daily note" })),
          ...(cf?.linked.doctorNotes ?? []).map((n) => ({ ...n, kind: "Doctor round" })),
        ].sort((x, y) => `${x.date} ${x.time}`.localeCompare(`${y.date} ${y.time}`)).filter((n) => !isDischargeSummary(n.text));
        if (rows.length) {
          w.begin(tag(i));
          w.table([{ label: "Date / time", w: 1.5 }, { label: "Type", w: 1.2 }, { label: "By", w: 1.5 }, { label: "Note", w: 5 }], rows.map((n) => [dt(n.date, n.time), n.kind, n.by, n.text]));
        }
        break;
      }
      case 7: {
        const vit = cf?.linked.vitals ?? [];
        const hand = cf?.linked.handovers ?? [];
        if (vit.length || hand.length) {
          w.begin(tag(i));
          if (vit.length) {
            w.sub("Vitals chart");
            w.table([{ label: "Date / time", w: 1.7 }, { label: "Temp F", w: 1 }, { label: "Pulse", w: 1 }, { label: "RR", w: 0.8 }, { label: "BP", w: 1.1 }, { label: "SpO2", w: 0.9 }, { label: "By", w: 1.5 }, { label: "Note", w: 2 }],
              vit.map((v) => [dt(v.date, v.time), v.tempF != null ? String(v.tempF) : "", v.pulse != null ? String(v.pulse) : "", v.rr != null ? String(v.rr) : "", v.bp, v.spo2 != null ? `${v.spo2}%` : "", v.by, v.note]));
          }
          if (hand.length) {
            w.sub("Nursing handover notes");
            w.table([{ label: "Date", w: 1.4 }, { label: "Shift", w: 1.2 }, { label: "By", w: 1.5 }, { label: "Note", w: 5 }], hand.map((h) => [formatDate(h.date), h.shift, h.author, h.note]));
          }
        }
        await attachCaseForms(["tpr_chart", "io_chart", "nursing_handover"], tag(i));
        break;
      }
      case 8: {
        const tests = [...file.lab.map((t) => ({ kind: "Lab", name: t.testName, date: t.date, status: t.status, order: t.orderNumber, id: t.id, has: t.hasReport })), ...file.radiology.map((t) => ({ kind: "Radiology", name: t.testName, date: t.date, status: t.status, order: t.orderNumber, id: t.id, has: t.hasReport }))];
        const docs = file.documents.filter(isReportDoc);
        if (tests.length || docs.length) {
          w.begin(tag(i));
          if (tests.length) w.table([{ label: "Test", w: 3 }, { label: "Type", w: 1.2 }, { label: "Date", w: 1.5 }, { label: "Status", w: 1.3 }, { label: "Order no.", w: 1.7 }, { label: "Report file", w: 1.2 }], tests.map((t) => [t.name, t.kind, formatDate(t.date), t.status, t.order, t.has ? "Attached" : "None"]));
          if (docs.length) { w.sub("Reports filed with the patient"); w.table([{ label: "Document", w: 4 }, { label: "Category", w: 2 }, { label: "Filed", w: 1.5 }], docs.map((d) => [d.title || d.fileName, d.category, formatDate(d.createdAt.slice(0, 10))])); }
        }
        for (const t of tests.filter((x) => x.has)) {
          try {
            const r = await api.get<{ fileName: string; fileUrl: string }>(`/${t.kind === "Lab" ? "lab" : "radiology"}/${t.id}/report`);
            const mime = /^data:([^;,]+)/.exec(r.fileUrl)?.[1] ?? "";
            if (!(await attach(`${tag(i)} - ${t.name}`, dataToBytes(r.fileUrl), mime, r.fileName))) notes.push(`${t.name} report could not be put in (not a PDF or picture)`);
          } catch { notes.push(`${t.name} report could not be fetched`); }
        }
        for (const d of docs) await attachDocument(tag(i), d);
        break;
      }
      case 9: {
        const doc = a.doctor.replace(/^Dr\.?\s*/i, "");
        const rows = (cf?.linked.doctorNotes ?? []).filter((n) => n.by && doc && !n.by.includes(doc));
        if (rows.length) {
          w.begin(tag(i));
          w.table([{ label: "Date / time", w: 1.5 }, { label: "Doctor", w: 1.6 }, { label: "Consultation", w: 5 }], rows.map((n) => [dt(n.date, n.time), n.by, n.text]));
        }
        break;
      }
      case 10: {
        const meds = cf?.linked.medicines ?? [];
        const iv = cf?.linked.ivLines ?? [];
        if (meds.length || iv.length) {
          w.begin(tag(i));
          if (meds.length) w.table([{ label: "Medicine", w: 3 }, { label: "Dosage", w: 1.3 }, { label: "Frequency", w: 1.3 }, { label: "Route", w: 1 }, { label: "Start", w: 1.4 }, { label: "End", w: 1.4 }, { label: "Status", w: 1.1 }], meds.map((m) => [m.name, m.dosage, m.frequency, m.route, formatDate(m.start), m.end ? formatDate(m.end) : "", m.status]));
          if (iv.length) { w.sub("IV fluids"); w.table([{ label: "Date / time", w: 1.6 }, { label: "Fluid", w: 3 }, { label: "Volume ml", w: 1 }, { label: "Rate ml/hr", w: 1 }, { label: "Status", w: 1.2 }, { label: "By", w: 1.5 }], iv.map((x) => [dt(x.date, x.time), x.fluid, String(x.volumeMl), String(x.rateMlHr), x.status, x.by])); }
        }
        await attachCaseForms(["treatment_sheet"], tag(i));
        break;
      }
      case 11:
      case 12: {
        if (file.ot.length) {
          w.begin(tag(i));
          for (const o of file.ot) {
            w.sub(`${o.surgeryName || o.procedure}  -  ${o.bookingNo}`);
            w.kv(i === 11
              ? [["Date", formatDate(o.scheduledDate)], ["Time", o.scheduledTime], ["Status", o.status], ["OT room", o.otRoom], ["Surgeon", o.surgeon], ["Co-surgeon", o.coSurgeon], ["Anaesthetist", o.anesthetist], ["Anaesthesia", o.anaesthesiaType], ["Procedure", o.procedure], ["Started", stamp(o.startedAt)], ["Ended", stamp(o.endedAt)], ["Special requirements", o.specialRequirements]]
              : [["Scrub nurse", o.scrubNurse], ["Circulating nurse", o.circulatingNurse], ["Technicians", o.technicians.join(", ")], ["Equipment", o.equipment.join(", ")], ["Date", formatDate(o.scheduledDate)], ["Status", o.status]]);
            w.gap(6);
          }
        }
        break;
      }
      case 13: {
        const rows = (cf?.linked.dailyNotes ?? []).filter((n) => isCounselling(n.text));
        if (rows.length) { w.begin(tag(i)); w.table([{ label: "Date / time", w: 1.5 }, { label: "By", w: 1.5 }, { label: "Note", w: 6 }], rows.map((n) => [dt(n.date, n.time), n.by, n.text])); }
        break;
      }
      case 14: {
        const rows = (cf?.linked.dailyNotes ?? []).filter((n) => isDischargeSummary(n.text));
        if (rows.length) { w.begin(tag(i)); rows.forEach((n) => { w.para(`${dt(n.date, n.time)}  -  ${n.by}`, 9); w.gap(2); w.para(n.text, 10); w.gap(8); }); }
        break;
      }
      case 15: {
        if (file.bills.length) {
          w.begin(tag(i));
          for (const b of file.bills) {
            w.sub(`${b.billNumber}  -  ${b.type}  -  ${formatDate(b.date)}${b.billTime ? ` ${b.billTime}` : ""}`);
            if (b.items?.length) w.table([{ label: "Service", w: 4 }, { label: "Qty", w: 0.8 }, { label: "Rate", w: 1.2 }, { label: "Amount", w: 1.3 }], b.items.map((x) => [x.name, String(x.quantity), String(x.unitPrice), String(x.amount)]));
            w.kv([["Amount", String(b.amount)], ["Discount", String(b.discount)], ["GST", String(b.gst)], ["Total", String(b.total)], ["Status", b.status], ["Payment", b.payType === "Cashless" ? `Cashless - ${b.tpaName ?? ""} ${b.policyNumber ?? ""}` : b.paymentMode ?? b.payType ?? ""]]);
            w.gap(6);
          }
        }
        break;
      }
      case 16: {
        const docs = file.documents.filter(isInsuranceDoc);
        if (docs.length) {
          w.begin(tag(i));
          w.table([{ label: "Document", w: 4 }, { label: "Category", w: 2 }, { label: "Reference", w: 2 }, { label: "Filed", w: 1.5 }], docs.map((d) => [d.title || d.fileName, d.category, d.referenceNo, formatDate(d.createdAt.slice(0, 10))]));
          for (const d of docs) await attachDocument(tag(i), d);
        }
        break;
      }
      default: break; // 18, 19, 20 are the checker's own verification
    }
    done++;
  }

  // Page numbers across the whole file.
  const total = pdf.getPageCount();
  pdf.getPages().forEach((p, n) => {
    const t = `Page ${n + 1} of ${total}`;
    p.drawText(t, { x: p.getWidth() / 2 - font.widthOfTextAtSize(t, 8) / 2, y: 16, size: 8, font, color: rgb(0.42, 0.45, 0.5) });
  });
  onProgress?.(jobs.length + 1, jobs.length + 1, "Done");
  return { blob: new Blob([(await pdf.save()) as BlobPart], { type: "application/pdf" }), notes };
}
