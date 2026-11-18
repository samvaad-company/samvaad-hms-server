/**
 * Prints a patient's details onto the insurer's own claim form (the PDF the insurer publishes). A template, built from the printed labels
 * of that form (see scripts/claims/build-templates.mjs and public/claims/*.json), says where each detail goes. Works in the browser and in
 * Node (pdf-lib). A detail too long for its place is shrunk, then carried over to a continuation sheet added at the end.
 */
import { PDFDocument, StandardFonts, rgb, closePath, fill, lineTo, moveTo, popGraphicsState, pushGraphicsState, setFillingRgbColor, type PDFFont, type PDFPage } from "pdf-lib";
import { CLAIM_FIELDS, CLAIM_GROUPS } from "./fields";

/** A place for a detail. Coordinates are in points from the top-left of the page; `y` is the baseline the text sits on. */
export interface ClaimSpot {
  p: number;
  x: number;
  y: number;
  /** Room to the right of `x` before the next printed thing. */
  w: number;
  /** A taller place: more lines of text, one per `lh` below the first. */
  lines?: number;
  /** Distance between the lines of a taller place, where the form's own ruled lines are spaced. */
  lh?: number;
  /** One character to a box: the box pitch in points (the first box starts at `x`). */
  comb?: number;
  /** One character to a drawn box, where the boxes are not evenly spaced: the centre of each box, and the box width. */
  cells?: number[];
  /** An answer that runs on from one row of boxes to the next: each row's box centres and the baseline of its characters. */
  flow?: { cells: number[]; y: number }[];
  /** Bottom edge (from the top) and height of the printed boxes, so a longer answer can be given more boxes. */
  by?: number;
  bh?: number;
  /** Date or time written on separate short lines (__/__/__ or __:__): one part to each. */
  segs?: { x: number; w: number }[];
  cw?: number;
  size?: number;
  /** Guide text printed inside the answer box (FIRST NAME, D D M M Y Y Y Y): covered before the answer is written. [x, y, w, h] from the top-left. */
  wipe?: { x: number; y: number; w: number; h: number }[];
}

/** A printed choice (Male / Female, Yes / No): the one that applies is ringed. */
/** A tick box or a radio circle (round): y is its bottom edge. */
export interface ClaimChoice { p: number; x: number; y: number; w: number; h: number; round?: boolean; ring?: boolean }

export interface ClaimTemplate {
  pdf: string;
  pages: number;
  /** The form has the hospital's Part B (the hospital, doctor, stay and bill details are printed on it). */
  partB?: boolean;
  /** The form could not be mapped box by box: every detail is printed on a "Claim details" sheet added to it instead. */
  summary?: boolean;
  /** No insurer PDF behind it: the details sheet is the whole form. */
  blank?: boolean;
  fields: Record<string, ClaimSpot[]>;
  /** A choice printed more than once (Part A and Part B) lists one set of options per place. */
  choices?: Record<string, Record<string, ClaimChoice> | Record<string, ClaimChoice>[]>;
}

export type ClaimValues = Record<string, string>;

export interface ClaimFillOptions {
  patientName?: string;
  formName?: string;
  hospitalStampImg?: string | null;
  /** Where the hospital stamp goes, when the template knows. */
  stamp?: { p: number; x: number; y: number; w: number; h: number } | null;
}

const INK = rgb(0.05, 0.1, 0.45);
const latin = (s: string) => s.replace(/₹/g, "Rs ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
const DATE_KEYS = new Set(["dob", "admissionDate", "dischargeDate"]);
/** A phone number goes one digit to a box, without the country code or spaces. */
const PHONE_KEYS = new Set(["phone", "hospitalPhone"]);
const phoneDigits = (t: string) => { const d = t.replace(/\D/g, ""); return d.length > 10 && d.startsWith("91") ? d.slice(2) : d; };

function dataUrlBytes(url: string): { bytes: Uint8Array; type: "png" | "jpg" } | null {
  const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(url);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type: m[1] === "png" ? "png" : "jpg" };
}

/** A filled shape drawn with plain path operators: shows in every PDF viewer, whatever the form's own page settings. */
function fillPoly(page: PDFPage, pts: [number, number][]) {
  page.pushOperators(pushGraphicsState(), setFillingRgbColor(0.05, 0.1, 0.45), moveTo(pts[0][0], pts[0][1]), ...pts.slice(1).map(([x, y]) => lineTo(x, y)), closePath(), fill(), popGraphicsState());
}
/** A straight stroke of the given width as a filled quad. */
function fillStroke(page: PDFPage, a: [number, number], b: [number, number], w: number) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = (-dy / len) * (w / 2), ny = (dx / len) * (w / 2);
  fillPoly(page, [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]);
}

/** An answer longer than its row of boxes: the row is redrawn with more, narrower boxes over the same width. Null when they would be too small to read. */
function refit(page: PDFPage, s: ClaimSpot, count: number, x0: number, total: number): { centres: number[]; pitch: number } | null {
  const pitch = total / count;
  if (pitch < 6.4) return null;
  const H = page.getHeight(), bh = s.bh ?? 11, by1 = s.by ?? s.y + 3.4, bottom = H - by1;
  page.drawRectangle({ x: x0 - 0.4, y: bottom - 0.4, width: total + 0.8, height: bh + 0.8, color: rgb(1, 1, 1) });
  const centres: number[] = [];
  for (let i = 0; i < count; i++) {
    page.drawRectangle({ x: x0 + i * pitch, y: bottom, width: pitch, height: bh, borderColor: rgb(0.4, 0.4, 0.4), borderWidth: 0.6 });
    centres.push(x0 + (i + 0.5) * pitch);
  }
  return { centres, pitch };
}

export async function fillClaimPdf(pdfBytes: Uint8Array, tpl: ClaimTemplate, values: ClaimValues, opts: ClaimFillOptions = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  // Some forms are fillable (tick boxes and radio buttons are form fields drawn above the page): flatten them so the marks made here show.
  try { if (doc.getForm().getFields().length) doc.getForm().flatten(); } catch { /* a form that can't be flattened is filled as it is */ }
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();
  const overflow: { label: string; text: string }[] = [];

  const baseline = (p: number, y: number) => pages[p].getHeight() - y;

  for (const [key, spots] of Object.entries(tpl.fields)) {
    const raw = (values[key] ?? "").toString().trim();
    if (!raw || !spots.length) continue;
    const text = latin(raw);
    let clipped = false;
    for (const s of spots) {
      const page = pages[s.p];
      if (!page) continue;
      for (const r of s.wipe ?? []) page.drawRectangle({ x: r.x, y: page.getHeight() - r.y - r.h, width: r.w, height: r.h, color: rgb(1, 1, 1) });
      if (s.flow?.length) {
        const all = text.toUpperCase().split("");
        const cap = s.flow.reduce((a, r) => a + r.cells.length, 0);
        let chars = all;
        if (all.length > cap) { clipped = true; chars = [...all.slice(0, cap - 1), "*"]; }
        let k = 0;
        for (const row of s.flow) {
          const pitch = row.cells.length > 1 ? row.cells[1] - row.cells[0] : 12, size = Math.min(9, pitch * 0.78);
          for (const cx of row.cells) {
            const ch = chars[k++];
            if (ch === undefined) break;
            if (ch === " ") continue;
            page.drawText(ch, { x: cx - bold.widthOfTextAtSize(ch, size) / 2, y: baseline(s.p, row.y), size, font: bold, color: INK });
          }
        }
        continue;
      }
      if (s.segs?.length) {
        const d = text.replace(/\D/g, "");
        let parts: string[];
        if (DATE_KEYS.has(key)) { const m = /^(\d{2})(\d{2})(\d{4})$/.exec(d); parts = m ? [m[1], m[2], m[3]] : [d]; }
        else { const m = /^(\d{1,2}):(\d{2})/.exec(text); parts = m && s.segs.length > 1 ? [m[1].padStart(2, "0"), m[2]] : [text]; }
        s.segs.forEach((g, i) => {
          let part = parts[i] ?? "";
          if (i === 2 && DATE_KEYS.has(key) && g.w < 20) part = part.slice(-2);
          if (!part) return;
          const size = 8.5, tw = bold.widthOfTextAtSize(part, size);
          page.drawText(part, { x: g.x + (g.w - tw) / 2, y: baseline(s.p, s.y), size, font: bold, color: INK });
        });
        continue;
      }
      if (s.cells?.length) {
        const n = s.cells.length;
        let chars: string[];
        if (DATE_KEYS.has(key)) { const d = text.replace(/\D/g, ""); const dd = /^(\d{2})(\d{2})(\d{4})$/.exec(d); chars = (n >= 10 && dd ? `${dd[1]}/${dd[2]}/${dd[3]}` : n === 6 && dd ? d.slice(0, 4) + d.slice(6) : d).split(""); }
        else if (n === 4 && /^\d{1,2}:\d{2}$/.test(text)) chars = text.replace(":", "").padStart(4, "0").split("");
        else if (PHONE_KEYS.has(key)) chars = phoneDigits(text).split("");
        else chars = text.toUpperCase().split("");
        let centres = s.cells, cwid = s.cw ?? 12;
        if (chars.length > n) {
          const even = n >= 2 && s.cells.every((c, i) => i === 0 || Math.abs(c - s.cells![i - 1] - (s.cells![1] - s.cells![0])) < 1.2);
          const fit = even ? refit(page, s, chars.length, s.cells[0] - (s.cells[1] - s.cells[0]) / 2, n * (s.cells[1] - s.cells[0])) : null;
          if (fit) { centres = fit.centres; cwid = fit.pitch; } else { clipped = true; chars = [...chars.slice(0, n - 1), "*"]; }
        }
        const size = Math.min(9, cwid * 0.78);
        chars.forEach((ch, i) => {
          if (ch === " ") return;
          const cw = bold.widthOfTextAtSize(ch, size);
          page.drawText(ch, { x: centres![i] - cw / 2, y: baseline(s.p, s.y), size, font: bold, color: INK });
        });
        continue;
      }
      if (s.comb) {
        let chars = (DATE_KEYS.has(key) ? text.replace(/\D/g, "") : PHONE_KEYS.has(key) ? phoneDigits(text) : text.toUpperCase().replace(/\s+/g, " ")).split("");
        const room = Math.max(1, Math.floor(s.w / s.comb + 0.05));
        let pitch = s.comb;
        if (chars.length > room) {
          const fit = refit(page, s, chars.length, s.x, room * s.comb);
          if (fit) pitch = fit.pitch; else { clipped = true; chars = [...chars.slice(0, room - 1), "*"]; }
        }
        chars.forEach((ch, i) => {
          if (ch === " ") return;
          const size = Math.min(9, pitch * 0.85), cw = bold.widthOfTextAtSize(ch, size);
          page.drawText(ch, { x: s.x + i * pitch + (pitch - cw) / 2, y: baseline(s.p, s.y), size, font: bold, color: INK });
        });
        continue;
      }
      const lines = Math.max(1, s.lines ?? 1);
      let size = s.size ?? 8.5;
      const wrap = (sz: number): string[] => {
        const out: string[] = [];
        let rest = text;
        const width = Math.max(10, s.w - 2);
        while (rest && out.length < lines) {
          let take = rest;
          if (font.widthOfTextAtSize(take, sz) > width) {
            let cut = take.length;
            while (cut > 1 && font.widthOfTextAtSize(take.slice(0, cut), sz) > width) cut--;
            const sp = take.lastIndexOf(" ", cut);
            take = take.slice(0, sp > cut * 0.5 ? sp : cut);
          }
          out.push(take);
          rest = rest.slice(take.length).trimStart();
        }
        return rest ? [...out, "\u0000"] : out;
      };
      let fit = wrap(size);
      while (fit.includes("\u0000") && size - 0.5 >= 6) { size -= 0.5; fit = wrap(size); }
      if (fit.includes("\u0000")) {
        clipped = true;
        fit = fit.filter((l) => l !== "\u0000");
        // The last visible line ends with a star: the rest is on the continuation sheet.
        const i = fit.length - 1;
        let last = fit[i] ?? "";
        while (last.length > 1 && font.widthOfTextAtSize(last + "*", size) > s.w - 2) last = last.slice(0, -1);
        fit[Math.max(0, i)] = last + "*";
      }
      fit.forEach((line, i) => page.drawText(line, { x: s.x + 1, y: baseline(s.p, s.y) - i * (s.lh ?? size + 2.6), size, font, color: INK }));
    }
    if (clipped) overflow.push({ label: CLAIM_FIELDS[key]?.label ?? key, text });
  }

  // Choices: ring the one that applies.
  for (const [key, entry] of Object.entries(tpl.choices ?? {})) {
    const want = (values[key] ?? "").trim().toLowerCase();
    if (!want) continue;
    for (const options of Array.isArray(entry) ? entry : [entry]) {
      const hit = Object.entries(options).find(([name]) => name.toLowerCase() === want);
      if (!hit) continue;
      const c = hit[1], page = pages[c.p];
      if (!page) continue;
      if (c.round) {
        // A radio circle: filled in.
        const cx = c.x + c.w / 2, cy = baseline(c.p, c.y) + c.h / 2, r = Math.max(2, c.w * 0.3);
        fillPoly(page, Array.from({ length: 20 }, (_, k): [number, number] => [cx + r * Math.cos((k * Math.PI) / 10), cy + r * Math.sin((k * Math.PI) / 10)]));
      } else if (!c.ring && c.w <= 22 && c.h <= 22) {
        // A tick box: a tick mark inside it.
        // a very small box gets a tick a little larger than itself, centred on it
        const sz = Math.max(7, Math.min(c.w, c.h)), bx = c.x + c.w / 2 - sz / 2, bb = baseline(c.p, c.y) + c.h / 2 - sz / 2, t = Math.max(1.1, sz * 0.16);
        const p1: [number, number] = [bx + sz * 0.2, bb + sz * 0.5], p2: [number, number] = [bx + sz * 0.42, bb + sz * 0.2], p3: [number, number] = [bx + sz * 0.85, bb + sz * 0.88];
        fillStroke(page, p1, p2, t); fillStroke(page, p2, p3, t);
      } else page.drawEllipse({ x: c.x + c.w / 2, y: baseline(c.p, c.y) + c.h / 2 - 1, xScale: c.w / 2 + 3, yScale: c.h / 2 + 2, borderColor: INK, borderWidth: 1.1, borderOpacity: 1 });
    }
  }

  // Hospital stamp, where the form has room for one.
  if (opts.hospitalStampImg && opts.stamp) {
    const img = dataUrlBytes(opts.hospitalStampImg);
    if (img) {
      try {
        const e = img.type === "png" ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
        const sc = Math.min(opts.stamp.w / e.width, opts.stamp.h / e.height);
        const w = e.width * sc, h = e.height * sc, page = pages[opts.stamp.p];
        page.drawImage(e, { x: opts.stamp.x + (opts.stamp.w - w) / 2, y: page.getHeight() - opts.stamp.y - opts.stamp.h + (opts.stamp.h - h) / 2, width: w, height: h });
      } catch { /* a picture that can't be read is left off */ }
    }
  }

  if (tpl.summary) {
    const first = pages[0];
    const sheet = tpl.blank ? first : doc.addPage([first.getWidth(), first.getHeight()]);
    const margin = 48, colW = (sheet.getWidth() - margin * 2) / 2 - 8;
    let y = sheet.getHeight() - margin;
    sheet.drawText(tpl.blank ? "HEALTH INSURANCE CLAIM FORM" : "CLAIM DETAILS", { x: margin, y, size: 15, font: bold });
    y -= 17;
    sheet.drawText(latin([opts.formName, opts.patientName].filter(Boolean).join("  -  ")), { x: margin, y, size: 9.5, font });
    y -= 13;
    sheet.drawText(tpl.blank ? "Part A: the insured. Part B: the hospital. Attach the bills, discharge summary and ID proof with this form." : "These details belong in Part A (the insured) and Part B (the hospital) of this form. Copy them in, or attach this sheet to the form.", { x: margin, y, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
    y -= 24;
    for (const g of CLAIM_GROUPS) {
      const keys = Object.keys(CLAIM_FIELDS).filter((k) => CLAIM_FIELDS[k].group === g.key && (values[k] ?? "").toString().trim());
      if (!keys.length) continue;
      sheet.drawText(latin(g.title), { x: margin, y, size: 10.5, font: bold });
      y -= 4;
      sheet.drawLine({ start: { x: margin, y }, end: { x: sheet.getWidth() - margin, y }, thickness: 0.6, color: rgb(0.75, 0.75, 0.75) });
      y -= 13;
      for (const k of keys) {
        const val = latin((values[k] ?? "").toString().trim());
        sheet.drawText(latin(CLAIM_FIELDS[k].label), { x: margin, y, size: 8.5, font, color: rgb(0.3, 0.3, 0.3), maxWidth: colW });
        let line = "", yy = y;
        for (const word of val.split(" ")) {
          const next = line ? `${line} ${word}` : word;
          if (font.widthOfTextAtSize(next, 9.5) > colW + 120 && line) { sheet.drawText(line, { x: margin + colW + 8, y: yy, size: 9.5, font: bold, color: INK }); yy -= 12; line = word; } else line = next;
        }
        sheet.drawText(line, { x: margin + colW + 8, y: yy, size: 9.5, font: bold, color: INK });
        y = yy - 15;
        if (y < margin + 20) break;
      }
      y -= 8;
    }
  }

  if (overflow.length) {
    const first = pages[0];
    const sheet = doc.addPage([first.getWidth(), first.getHeight()]);
    const margin = 54, width = sheet.getWidth() - margin * 2;
    let y = sheet.getHeight() - margin;
    const write = (text: string, size: number, f: PDFFont, after = 4) => {
      for (const para of text.split("\n")) {
        let line = "";
        for (const word of para.split(" ")) {
          const next = line ? `${line} ${word}` : word;
          if (f.widthOfTextAtSize(next, size) > width && line) { sheet.drawText(line, { x: margin, y, size, font: f }); y -= size + 3; line = word; } else line = next;
        }
        sheet.drawText(line, { x: margin, y, size, font: f }); y -= size + 3;
      }
      y -= after;
    };
    write("CONTINUATION SHEET", 14, bold, 6);
    write(latin([opts.formName, opts.patientName].filter(Boolean).join(" - ")), 10, font, 8);
    write("These details did not fit in the space on the form (marked with *). They form part of the claim.", 9, font, 12);
    for (const o of overflow) { write(o.label, 10, bold, 3); write(o.text, 10, font, 12); }
  }

  doc.setTitle(`Claim form${opts.patientName ? ` - ${opts.patientName}` : ""}`);
  return doc.save();
}
