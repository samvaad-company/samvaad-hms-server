/**
 * Fills the insurer's own PDF form: each detail goes into the box it belongs to on the real form, one character to a box, ticks in the
 * tick boxes, the doctor's signature and stamp and the hospital's stamp where the form has room for them. What does not fit in the
 * boxes is printed in full on a continuation sheet added at the end, and the box is marked with a star.
 * Works in the browser and in Node (pdf-lib), from a template that says where each box is (see public/preauth/*.json).
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { PREAUTH_FIELDS, type PreauthValues } from "../../types/preauth";

type Cell = [number, number, number, number];
/** `b` is the box drawn around the answer on the form ([left, top, right, bottom]); typed text is kept inside it. */
interface Row { p: number; cells: Cell[]; b?: [number, number, number, number] }
interface Spot { p: number; x: number; y: number; w: number; h: number }

export interface PdfTemplate {
  pdf: string;
  pages: number;
  fields: Record<string, { kind: "comb" | "box"; rows: Row[]; repeat?: boolean } | { kind: "gpla"; cells: Spot[] }>;
  checks: Record<string, Record<string, Spot>>;
  chronic: Record<string, { check?: Spot; mm?: Row; yy?: Row; details?: Row[]; text?: { kind: "comb" | "box"; rows: Row[] } }>;
  /** Where each picture goes. A form that asks for the signature or stamp in more than one place lists every one. */
  images: Partial<Record<"hospitalStamp" | "doctorSignature" | "doctorStamp" | "patientSignature", Spot | Spot[]>>;
  /** What the form asks, in its order: a detail with no box of its own on the form is still printed, on the continuation sheet. */
  order?: { key: string; label: string }[];
  /** Guide text printed on the form where a date goes (DD/MM/YYYY): cleared when that date is filled in, so the date reads clearly. */
  hints?: { k: string; p: number; r: [number, number, number, number] }[];
}

export interface FillOptions {
  doctorSignatureImg?: string | null;
  doctorStampImg?: string | null;
  hospitalStampImg?: string | null;
  /** The patient's own signature, printed at each "Patient / Insured signature" place. */
  patientSignatureImg?: string | null;
  /** yyyy-mm-dd for the declaration date when the form has none of its own. */
  defaultDate?: string | null;
  patientName?: string;
  formName?: string;
}

const DATE_KEYS = new Set(["dob", "firstConsultDate", "injuryDate", "expectedDelivery", "admissionDate", "declDate"]);
const TIME_KEYS = new Set(["admissionTime", "declTime"]);
/** Boxes printed with guide letters in them (D D M M Y Y Y Y, H H M M, Y Y M M): a box that gets a digit is cleared first. */
const GUIDED_KEYS = new Set([...DATE_KEYS, ...TIME_KEYS, "age", "lmp"]);
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

  function centred(p: PDFPage, ch: string, [x, y, w, h]: Cell, size0?: number) {
    // Small printed boxes (under 8pt tall) get a smaller letter so it stays inside the box.
    const size = size0 ?? (h < 8 ? Math.max(5.5, h - 0.5) : 8);
    const tw = bold.widthOfTextAtSize(ch, size);
    p.drawText(ch, { x: x + (w - tw) / 2, y: topToPdf(p, y, h) + (h - size * 0.72) / 2, size, font: bold, color: INK });
  }
  /** Date and time boxes come printed with their guide letters (D D M M Y Y Y Y, H H M M): a box that gets a digit is cleared first, so the digit reads clearly. */
  function wipe(p: PDFPage, [x, y, w, h]: Cell) {
    p.drawRectangle({ x: x + 1.1, y: topToPdf(p, y, h) + 1.1, width: Math.max(1, w - 2.2), height: Math.max(1, h - 2.2), color: rgb(1, 1, 1) });
  }
  function cross(p: PDFPage, s: Spot) {
    // A tick mark: a short stroke down to the bottom, then a long stroke up to the top right.
    // Drawn square and centred in the box, however wide or tall the box is.
    const H = p.getHeight(), side = Math.min(s.w, s.h, 11), sx = s.x + (s.w - side) / 2, sy = s.y + (s.h - side) / 2;
    const a = { x: sx + side * 0.16, y: H - (sy + side * 0.55) };
    const b = { x: sx + side * 0.42, y: H - (sy + side * 0.86) };
    const c = { x: sx + side * 0.92, y: H - (sy + side * 0.08) };
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
    for (const hint of tpl.hints ?? []) {
      if (hint.k !== key) continue;
      const [hx, hy, hw, hh] = hint.r;
      pages[hint.p].drawRectangle({ x: hx, y: topToPdf(pages[hint.p], hy, hh), width: hw, height: hh, color: rgb(1, 1, 1) });
    }

    if (f.kind === "gpla") {
      raw.split("|").forEach((part, i) => { const s = f.cells[i]; if (part && s) { cross(pages[s.p], s); centred(pages[s.p], part.slice(0, 2), [s.x, s.y, s.w, s.h], 7); } });
      continue;
    }
    if (f.kind === "box") {
      // A date or time typed on a line reads the way it is written on paper: 15/03/1998, 09:30.
      const typed = DATE_KEYS.has(key) ? raw.replace(/^(\d{4})-(\d{2})-(\d{2}).*$/, "$3/$2/$1") : TIME_KEYS.has(key) ? raw.replace(/^(\d{1,2}):(\d{2}).*$/, (_m, h, m) => `${h.padStart(2, "0")}:${m}`) : raw;
      const text = latin(key === "maternity" ? typed.split("|").map((x, i) => (x ? `${"GPLA"[i]}${x}` : "")).filter(Boolean).join(" ") : typed);
      // Each place the text can go. A drawn box on the form holds as many lines as fit inside it, and the text is centred in the box;
      // a box with no drawn border gives one line sitting on the form's own baseline.
      // Rows that sit in the same drawn box are one place, not several.
      const sameBox = (r: Row, q: Row) => !!r.b && !!q.b && r.b.every((v, i) => Math.abs(v - q.b![i]) < 0.6);
      // When the answer has a drawn box, a further line that lies outside any box was a mis-detected continuation and is not used.
      const inBoxes = f.rows.some((r) => r.b) ? f.rows.filter((r) => r.b) : f.rows;
      const places = inBoxes.filter((r, i) => !(i > 0 && sameBox(r, inBoxes[i - 1])));
      const slotsAt = (size: number) => places.map((row) => {
        const [x, y, w, h] = row.cells[0], bx = row.b, lh = size * 1.2;
        let x0 = x, x1 = x + w;
        if (bx) { x0 = Math.max(x0, bx[0] + 1.5); x1 = Math.min(x1, bx[2] - 1.5); }
        // Several lines only in a roomy box that is the field's one and only place; a narrow or small box, or one of several lines, holds one.
        const roomy = !!bx && places.length === 1 && bx[3] - bx[1] >= 18 && bx[2] - bx[0] >= 120;
        return { row, x0, x1, lines: roomy ? Math.max(1, Math.floor((bx![3] - bx![1] - 3) / lh)) : 1, cy: bx ? (bx[1] + bx[3]) / 2 : null, base: y + h - 2.6, lh };
      });
      // Fill the places in turn at one size, breaking on spaces. The size is the largest (down to 5.5) at which everything fits;
      // whatever still does not fit goes to the continuation sheet.
      const wrap = (size: number) => {
        const slots = slotsAt(size);
        const placed: { slot: (typeof slots)[number]; lines: string[] }[] = [];
        let rest = text;
        for (const slot of slots) {
          if (!rest) break;
          const w = slot.x1 - slot.x0 - 4, lines: string[] = [];
          while (rest && lines.length < slot.lines) {
            let take = rest;
            if (font.widthOfTextAtSize(take, size) > w) {
              let cut = take.length;
              while (cut > 1 && font.widthOfTextAtSize(take.slice(0, cut), size) > w) cut--;
              const sp = take.lastIndexOf(" ", cut);
              take = take.slice(0, sp > cut * 0.5 ? sp : cut);
            }
            lines.push(take);
            rest = rest.slice(take.length).trimStart();
          }
          placed.push({ slot, lines });
        }
        return { placed, rest };
      };
      let size = places.every((r) => !r.b && r.cells[0][3] < 6) ? 6.5 : 8.5, fit = wrap(size);
      // Never smaller than a reader can comfortably read; what still does not fit goes to the continuation sheet.
      const floor = places.every((r) => !r.b && r.cells[0][3] < 6) ? 6 : 6.5;
      while (fit.rest && size - 0.5 >= floor) { size -= 0.5; fit = wrap(size); }
      for (const { slot, lines } of fit.placed) {
        lines.forEach((line, i) => {
          // Centred on the box: the stack of lines is centred, and each line's middle sits on its own centre line.
          const base = slot.cy === null ? slot.base : slot.cy - ((lines.length - 1) * slot.lh) / 2 + i * slot.lh + size * 0.34;
          slot.row.p !== undefined && pages[slot.row.p].drawText(line, { x: slot.x0 + 2, y: pages[slot.row.p].getHeight() - base, size, font, color: INK });
        });
      }
      const rest = fit.rest;
      if (rest) overflow.push({ label, text });
      continue;
    }
    // Comb boxes: one character to a box.
    let text = latin(digits(key, raw));
    if (!AS_TYPED.has(key)) text = text.toUpperCase();
    if (DATE_KEYS.has(key) || TIME_KEYS.has(key)) text = text.replace(/\D/g, "");
    if (f.repeat) {
      // The same answer in each place the form asks for it (e.g. the date at the foot of two pages).
      for (const row of f.rows) row.cells.forEach((cell, i) => { if (text[i] && text[i] !== " ") { if (GUIDED_KEYS.has(key)) wipe(pages[row.p], cell); centred(pages[row.p], text[i], cell); } });
      continue;
    }
    const capacity = f.rows.reduce((n, r) => n + r.cells.length, 0);
    // A date with room for only six digits is written day, month, two-digit year.
    if (DATE_KEYS.has(key) && capacity === 6 && text.length === 8) text = text.slice(0, 4) + text.slice(6);
    const truncated = text.length > capacity;
    if (truncated) overflow.push({ label, text: latin(raw) });
    const shown = truncated ? text.slice(0, capacity - 1) + "*" : text;
    let at = 0;
    for (const row of f.rows) {
      for (const cell of row.cells) { if (at < shown.length) { const ch = shown[at++]; if (ch !== " ") { if (GUIDED_KEYS.has(key)) wipe(pages[row.p], cell); centred(pages[row.p], ch, cell); } } }
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

  // ── Details the form asks for that have no box of their own ──
  for (const o of tpl.order ?? []) {
    if (o.key in tpl.fields || o.key in tpl.checks || o.key in tpl.chronic) continue;
    const raw = (v[o.key] ?? "").toString().trim();
    if (raw) overflow.push({ label: o.label || PREAUTH_FIELDS[o.key]?.label || o.key, text: latin(raw) });
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
  const spotsOf = (v: Spot | Spot[] | undefined): Spot[] => (v ? (Array.isArray(v) ? v : [v]) : []);
  for (const spot of spotsOf(tpl.images.hospitalStamp)) await place(opts.hospitalStampImg, spot);
  for (const spot of spotsOf(tpl.images.doctorSignature)) await place(opts.doctorSignatureImg, spot);
  for (const spot of spotsOf(tpl.images.doctorStamp)) await place(opts.doctorStampImg, spot);
  for (const spot of spotsOf(tpl.images.patientSignature)) await place(opts.patientSignatureImg, spot);

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
