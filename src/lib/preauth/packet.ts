"use client";

/**
 * The claim packet: the signed and stamped pre-auth form, the prescription, the patient's reports and their Aadhaar, PAN and policy,
 * put together as one PDF — with a contents page up front and a small label on every page saying what it is. Everything is merged in
 * the browser; nothing is sent anywhere.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { imagesToPdf } from "@/lib/image-pdf";
import type { PacketFileDTO, PacketPrescriptionDTO } from "@/types/preauth";

const A4: [number, number] = [595.28, 841.89];
const INK = rgb(0.1, 0.12, 0.2);
const SOFT = rgb(0.42, 0.45, 0.52);

const latin = (s: string) => String(s ?? "").replace(/₹/g, "Rs ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\x7e\xa0-\xff]/g, "?");

export interface PacketSection { title: string; pdf: PDFDocument }

function dataUrlBytes(url: string): Uint8Array {
  const b64 = url.slice(url.indexOf(",") + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** A paper as a PDF: a PDF is used as it is, a picture is placed on A4 pages. */
export async function fileToPdf(file: PacketFileDTO): Promise<PDFDocument> {
  const bytes = dataUrlBytes(file.dataUrl);
  if (file.mimeType === "application/pdf" || /\.pdf$/i.test(file.fileName)) return PDFDocument.load(bytes, { ignoreEncryption: true });
  const picture = new File([bytes as BlobPart], file.fileName, { type: file.mimeType });
  return PDFDocument.load(new Uint8Array(await (await imagesToPdf([picture])).arrayBuffer()));
}

/** The pre-auth form, when the insurer has no PDF of its own: the page as shown, captured and cut into A4 pages. */
export async function elementToPdf(el: HTMLElement): Promise<PDFDocument> {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(el, { scale: 1.6, backgroundColor: "#ffffff", useCORS: true });
  const doc = await PDFDocument.create();
  const pageH = Math.floor((canvas.width * A4[1]) / A4[0]);
  for (let y = 0; y < canvas.height; y += pageH) {
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.min(pageH, canvas.height - y);
    slice.getContext("2d")?.drawImage(canvas, 0, y, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
    const img = await doc.embedPng(slice.toDataURL("image/png"));
    const page = doc.addPage(A4);
    const w = A4[0], h = (slice.height / canvas.width) * A4[0];
    page.drawImage(img, { x: 0, y: A4[1] - h, width: w, height: h });
  }
  return doc;
}

/** A prescription as a clean one-page PDF. */
export async function prescriptionToPdf(rx: PacketPrescriptionDTO, hospital: string): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage(A4);
  const M = 48;
  let y = A4[1] - M;
  const text = (s: string, x: number, size: number, f: PDFFont = font, color = INK) => page.drawText(latin(s), { x, y, size, font: f, color });
  const wrap = (s: string, width: number, size: number, f: PDFFont): string[] => {
    const lines: string[] = [];
    let line = "";
    for (const word of latin(s).split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(next, size) > width && line) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };
  const rule = () => { page.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 0.6, color: rgb(0.8, 0.82, 0.86) }); y -= 14; };

  text(hospital || "Hospital", M, 15, bold); y -= 18;
  text("PRESCRIPTION", M, 10, bold, SOFT);
  text(`No. ${rx.rxNumber}`, A4[0] - M - bold.widthOfTextAtSize(latin(`No. ${rx.rxNumber}`), 10), 10, bold); y -= 14;
  rule();
  text(`Patient: ${rx.patientName}${rx.patientAge ? `, ${rx.patientAge} yrs` : ""}${rx.gender ? `, ${rx.gender}` : ""}`, M, 11, bold); y -= 15;
  text(`Date: ${rx.date}`, M, 10); text(`Doctor: ${rx.doctor}`, M + 200, 10); y -= 15;
  if (rx.allergies) { text(`Allergies: ${rx.allergies}`, M, 10, font, rgb(0.7, 0.1, 0.1)); y -= 15; }
  if (rx.diagnosis) { for (const l of wrap(`Diagnosis: ${rx.diagnosis}`, A4[0] - M * 2, 10, font)) { text(l, M, 10); y -= 13; } }
  y -= 4; rule();

  text("Medicine", M, 9, bold, SOFT); text("Dose", M + 190, 9, bold, SOFT); text("Frequency", M + 260, 9, bold, SOFT); text("Duration", M + 350, 9, bold, SOFT); text("Instructions", M + 420, 9, bold, SOFT); y -= 14;
  for (const [n, it] of rx.items.entries()) {
    if (y < M + 40) { page = doc.addPage(A4); y = A4[1] - M; }
    const name = wrap(`${n + 1}. ${it.medicineName}`, 180, 10, bold);
    const note = wrap(it.instructions ?? "", A4[0] - M - (M + 420), 9, font);
    const rows = Math.max(name.length, note.length, 1);
    text(it.dosage, M + 190, 10); text(it.frequency, M + 260, 10); text(it.duration, M + 350, 10);
    for (let r = 0; r < rows; r++) { if (name[r]) text(name[r], M, 10, bold); if (note[r]) text(note[r], M + 420, 9); y -= 13; }
    y -= 4;
  }
  if (rx.items.length === 0) { text("No medicines listed.", M, 10, font, SOFT); y -= 14; }
  return doc;
}

export interface PacketInput {
  title: string;
  patient: string;
  insurer: string;
  hospital: string;
  sections: PacketSection[];
}

/** Puts the sections together behind a contents page and labels every page. */
export async function mergePacket(input: PacketInput): Promise<{ blob: Blob; pages: number }> {
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const cover = out.addPage(A4);
  const total = 1 + input.sections.reduce((n, s) => n + s.pdf.getPageCount(), 0);

  let at = 2;
  const toc: { title: string; from: number; to: number }[] = [];
  for (const s of input.sections) {
    const copied = await out.copyPages(s.pdf, s.pdf.getPageIndices());
    const from = at;
    for (const [i, p] of copied.entries()) {
      out.addPage(p);
      const label = latin(`${input.title}  |  ${s.title}${copied.length > 1 ? `  (${i + 1}/${copied.length})` : ""}  |  page ${at} of ${total}`);
      const { width, height } = p.getSize();
      // A thin label in the top margin, on a white strip so it reads over anything.
      p.drawRectangle({ x: 0, y: height - 11, width, height: 11, color: rgb(1, 1, 1), opacity: 0.92 });
      p.drawText(label, { x: 14, y: height - 8.5, size: 6.5, font, color: SOFT });
      at += 1;
    }
    toc.push({ title: s.title, from, to: at - 1 });
  }

  const M = 56;
  let y = A4[1] - 80;
  const line = (s: string, size: number, f: PDFFont = font, color = INK, x = M) => { cover.drawText(latin(s), { x, y, size, font: f, color }); };
  line(input.hospital || "Hospital", 12, bold, SOFT); y -= 34;
  line("Claim packet", 26, bold); y -= 26;
  line(input.title, 12, font, SOFT); y -= 36;
  line(`Patient: ${input.patient}`, 12, bold); y -= 18;
  line(`Insurer / TPA: ${input.insurer}`, 12); y -= 18;
  line(`Prepared on ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`, 10, font, SOFT); y -= 40;
  cover.drawLine({ start: { x: M, y: y + 12 }, end: { x: A4[0] - M, y: y + 12 }, thickness: 0.7, color: rgb(0.8, 0.82, 0.86) });
  line("Contents", 12, bold); y -= 24;
  for (const [i, t] of toc.entries()) {
    line(`${i + 1}.  ${t.title}`, 11);
    const range = t.from === t.to ? `page ${t.from}` : `pages ${t.from}-${t.to}`;
    line(range, 11, font, SOFT, A4[0] - M - font.widthOfTextAtSize(range, 11));
    y -= 20;
  }
  cover.drawText(latin(`${total} pages`), { x: M, y: 50, size: 9, font, color: SOFT });

  const bytes = await out.save();
  return { blob: new Blob([bytes as BlobPart], { type: "application/pdf" }), pages: total };
}

export function downloadPdf(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.replace(/[\\/:*?"<>|]+/g, "-");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export type { PDFPage };
