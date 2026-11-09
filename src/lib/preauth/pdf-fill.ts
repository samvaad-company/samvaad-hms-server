/**
 * Fills the insurer's own PDF form: each detail goes into the box it belongs to on the real form, one character to a box, ticks in the
 * tick boxes, the doctor's signature and stamp and the hospital's stamp where the form has room for them. What does not fit in the
 * boxes is printed in full on a continuation sheet added at the end, and the box is marked with a star.
 * Works in the browser and in Node (pdf-lib), from a template that says where each box is (see public/preauth/*.json).
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { PREAUTH_FIELDS, type PreauthValues } from "../../types/preauth";

type Cell = [number, number, number, number];
interface Row { p: number; cells: Cell[] }
interface Spot { p: number; x: number; y: number; w: number; h: number }

export interface PdfTemplate {
  pdf: string;
  pages: number;
  fields: Record<string, { kind: "comb" | "box"; rows: Row[]; repeat?: boolean } | { kind: "gpla"; cells: Spot[] }>;
  checks: Record<string, Record<string, Spot>>;
  chronic: Record<string, { check?: Spot; mm?: Row; yy?: Row; details?: Row[]; text?: { kind: "comb" | "box"; rows: Row[] } }>;
  images: Record<"hospitalStamp" | "doctorSignature" | "doctorStamp", Spot>;
}

export interface FillOptions {
  doctorSignatureImg?: string | null;
  doctorStampImg?: string | null;
  hospitalStampImg?: string | null;
  /** yyyy-mm-dd for the declaration date when the form has none of its own. */
  defaultDate?: string | null;
  patientName?: string;
  formName?: string;
}

const DATE_KEYS = new Set(["dob", "firstConsultDate", "injuryDate", "expectedDelivery", "admissionDate", "declDate"]);
const TIME_KEYS = new Set(["admissionTime", "declTime"]);
const AS_TYPED = new Set(["hospitalEmail", "insuredEmail"]);
const INK = rgb(0.05, 0.1, 0.45);

/** Helvetica can only print Latin-1: swap the rest for something readable. */
const latin = (s: string) => s.replace(/₹/g, "Rs ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\x7e\xa0-\xff]/g, "?");

function dataUrlBytes(url: string): { bytes: Uint8Array; type: "png" | "jpg" } | null {
  const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(url);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type: m[1] === "png" ? "png" : "jpg" };
}

function digits(key: string, v: string): string {
  if (DATE_KEYS.has(key)) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v); if (m) return m[3] + m[2] + m[1]; }
  if (TIME_KEYS.has(key)) { const m = /^(\d{1,2}):(\d{2})/.exec(v); if (m) return m[1].padStart(2, "0") + m[2]; }
  return v;
}

export async function fillPreauthPdf(pdfBytes: Uint8Array, tpl: PdfTemplate, values: PreauthValues, opts: FillOptions = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();
  const overflow: { label: string; text: string }[] = [];

  // The form's own wording for a few details that live under other keys.
  const v: PreauthValues = { ...values };
  v.declDoctorName = v.declDoctorName || v.doctorName || "";
  v.declDate = v.declDate || opts.defaultDate || "";

  const topToPdf = (p: PDFPage, y: number, h: number) => p.getHeight() - y - h;

  function centred(p: PDFPage, ch: string, [x, y, w, h]: Cell, size = 8) {
    const tw = bold.widthOfTextAtSize(ch, size);
    p.drawText(ch, { x: x + (w - tw) / 2, y: topToPdf(p, y, h) + (h - size * 0.72) / 2, size, font: bold, color: INK });
  }
  function cross(p: PDFPage, s: Spot) {
    // A tick mark: a short stroke down to the bottom, then a long stroke up to the top right.
    const H = p.getHeight();
    const a = { x: s.x + s.w * 0.16, y: H - (s.y + s.h * 0.55) };
    const b = { x: s.x + s.w * 0.42, y: H - (s.y + s.h * 0.86) };
    const c = { x: s.x + s.w * 0.92, y: H - (s.y + s.h * 0.08) };
    const opt = { thickness: 1.5, color: INK };
    p.drawLine({ start: a, end: b, ...opt });
    p.drawLine({ start: b, end: c, ...opt });
  }
  const checkSpot = (key: string, option: string) => tpl.checks[key]?.[option];

  // ── Text in boxes ──
  for (const [key, f] of Object.entries(tpl.fields)) {
    const raw = (v[key] ?? "").toString().trim();
    if (!raw) continue;
    const label = PREAUTH_FIELDS[key]?.label ?? key;

    if (f.kind === "gpla") {
      raw.split("|").forEach((part, i) => { const s = f.cells[i]; if (part && s) { cross(pages[s.p], s); centred(pages[s.p], part.slice(0, 2), [s.x, s.y, s.w, s.h], 7); } });
      continue;
    }
    if (f.kind === "box") {
      const text = latin(key === "maternity" ? raw.split("|").map((x, i) => (x ? `${"GPLA"[i]}${x}` : "")).filter(Boolean).join(" ") : raw);
      // Fill the boxes in turn, breaking on spaces; whatever is left over goes to the continuation sheet.
      let rest = text;
      for (let i = 0; i < f.rows.length && rest; i++) {
        const row = f.rows[i], [x, y, w, h] = row.cells[0];
        const p = pages[row.p];
        let size = 8.5;
        while (size > 5.5 && font.widthOfTextAtSize(rest, size) > w - 4) size -= 0.5;
        let take = rest;
        if (font.widthOfTextAtSize(take, size) > w - 4) {
          let cut = take.length;
          while (cut > 1 && font.widthOfTextAtSize(take.slice(0, cut), size) > w - 4) cut--;
          const sp = take.lastIndexOf(" ", cut);
          take = take.slice(0, sp > cut * 0.5 ? sp : cut);
        }
        p.drawText(take, { x: x + 2, y: topToPdf(p, y, h) + 2.6, size, font, color: INK });
        rest = rest.slice(take.length).trimStart();
      }
      if (rest) overflow.push({ label, text });
      continue;
    }
    // Comb boxes: one character to a box.
    let text = latin(digits(key, raw));
    if (!AS_TYPED.has(key)) text = text.toUpperCase();
    if (DATE_KEYS.has(key) || TIME_KEYS.has(key)) text = text.replace(/\D/g, "");
    if (f.repeat) {
      // The same answer in each place the form asks for it (e.g. the date at the foot of two pages).
      for (const row of f.rows) row.cells.forEach((cell, i) => { if (text[i] && text[i] !== " ") centred(pages[row.p], text[i], cell); });
      continue;
    }
    const capacity = f.rows.reduce((n, r) => n + r.cells.length, 0);
    const truncated = text.length > capacity;
    if (truncated) overflow.push({ label, text: latin(raw) });
    const shown = truncated ? text.slice(0, capacity - 1) + "*" : text;
    let at = 0;
    for (const row of f.rows) {
      for (const cell of row.cells) { if (at < shown.length) { const ch = shown[at++]; if (ch !== " ") centred(pages[row.p], ch, cell); } }
    }
  }

  // ── Ticks ──
  const pick = (key: string): string[] => (v[key] ?? "").split("|").map((s) => s.trim()).filter(Boolean);
  for (const key of Object.keys(tpl.checks)) {
    for (const opt of pick(key)) { const s = checkSpot(key, opt); if (s) cross(pages[s.p], s); }
  }

  // ── Chronic illness: tick, and since when (MM / YY) ──
  for (const [key, c] of Object.entries(tpl.chronic)) {
    const raw = (v[key] ?? "").trim();
    if (!raw) continue;
    if (c.check) cross(pages[c.check.p], c.check);
    if (c.text) {
      // "since when": into the boxes if there are boxes (digits only when there are four), else written on the line.
      const row = c.text.rows[0];
      if (c.text.kind === "comb") {
        const n = row.cells.length;
        const m = /^(\d{1,2})\s*[\/\-.]\s*(\d{2,4})$/.exec(raw);
        const mm = m ? m[1].padStart(2, "0") : "", yy = m ? m[2] : "";
        // MM/YY into four boxes, MM/YY with the slash into five, MM and a four-digit year into six.
        const t = !m ? raw : n >= 6 ? mm + (yy.length === 2 ? `20${yy}` : yy) : n === 5 ? `${mm}/${yy.slice(-2)}` : mm + yy.slice(-2);
        row.cells.forEach((cell, i) => { if (t[i] && t[i] !== " ") centred(pages[row.p], t[i], cell); });
      } else {
        const [x, y, w, h] = row.cells[0]; const p = pages[row.p];
        const t = latin(raw);
        let size = 8; while (size > 5.5 && font.widthOfTextAtSize(t, size) > w - 2) size -= 0.5;
        p.drawText(t, { x: x + 1, y: topToPdf(p, y, h) + (h - size * 0.72) / 2 + 0.5, size, font, color: INK });
      }
    } else if (c.mm && c.yy) {
      const m = /^(\d{1,2})\s*[\/\-.]\s*(\d{2,4})$/.exec(raw);
      if (m) {
        const mm = m[1].padStart(2, "0"), yy = m[2].slice(-2);
        c.mm.cells.forEach((cell, i) => mm[i] && centred(pages[c.mm!.p], mm[i], cell));
        c.yy.cells.forEach((cell, i) => yy[i] && centred(pages[c.yy!.p], yy[i], cell));
      }
    } else if (c.details) {
      const text = latin(raw);
      let rest = text;
      for (const row of c.details) {
        if (!rest) break;
        const [x, y, w, h] = row.cells[0]; const p = pages[row.p];
        let cut = rest.length;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), 8) > w - 4) cut--;
        const sp = cut < rest.length ? rest.lastIndexOf(" ", cut) : -1;
        const take = cut < rest.length && sp > cut * 0.5 ? rest.slice(0, sp) : rest.slice(0, cut);
        p.drawText(take, { x: x + 2, y: topToPdf(p, y, h) + 2, size: 8, font, color: INK });
        rest = rest.slice(take.length).trimStart();
      }
      if (rest) overflow.push({ label: PREAUTH_FIELDS[key]?.label ?? key, text });
    }
  }

  // ── Signature, stamps ──
  async function place(url: string | null | undefined, spot: Spot) {
    if (!url) return;
    const img = dataUrlBytes(url);
    if (!img) return;
    try {
      const e = img.type === "png" ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
      const scale = Math.min(spot.w / e.width, spot.h / e.height);
      const w = e.width * scale, h = e.height * scale;
      const p = pages[spot.p];
      p.drawImage(e, { x: spot.x + (spot.w - w) / 2, y: p.getHeight() - spot.y - spot.h + (spot.h - h) / 2, width: w, height: h });
    } catch { /* a picture that can't be read is left off rather than failing the form */ }
  }
  await place(opts.hospitalStampImg, tpl.images.hospitalStamp);
  await place(opts.doctorSignatureImg, tpl.images.doctorSignature);
  await place(opts.doctorStampImg, tpl.images.doctorStamp);

  // ── Continuation sheet ──
  if (overflow.length) {
    const first = pages[0];
    const sheet = doc.addPage([first.getWidth(), first.getHeight()]);
    const margin = 54, width = sheet.getWidth() - margin * 2;
    let y = sheet.getHeight() - margin;
    const write = (text: string, size: number, f: PDFFont, after = 4) => {
      const gap = 3;
      for (const para of text.split("\n")) {
        let line = "";
        for (const word of para.split(" ")) {
          const next = line ? `${line} ${word}` : word;
          if (f.widthOfTextAtSize(next, size) > width && line) { sheet.drawText(line, { x: margin, y, size, font: f }); y -= size + gap; line = word; } else line = next;
        }
        sheet.drawText(line, { x: margin, y, size, font: f }); y -= size + gap;
      }
      y -= after;
    };
    write("CONTINUATION SHEET", 14, bold, 6);
    write(latin([opts.formName, opts.patientName].filter(Boolean).join(" · ")), 10, font, 8);
    write("These details did not fit in the boxes on the form (marked with *). They form part of the request.", 9, font, 12);
    for (const o of overflow) { write(o.label, 10, bold, 3); write(o.text, 10, font, 12); }
  }

  doc.setTitle(`Pre-authorisation request${opts.patientName ? ` — ${opts.patientName}` : ""}`);
  return doc.save();
}
