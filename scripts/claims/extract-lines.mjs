/**
 * Reads a claim-form PDF into what the template builder needs: for each page, its printed text as lines of words (with positions, top-left
 * origin, in points) and the small drawn boxes (the one-letter-to-a-box rows). Needs pdfjs-dist (npm i --no-save pdfjs-dist@4.10.38).
 */
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { pageShapes } from "./shapes.mjs";
import { spaceify } from "./spaceify.mjs";

const OPS = pdfjs.OPS;

export async function pageRects(page) {
  const vp = page.getViewport({ scale: 1 });
  const ol = await page.getOperatorList();
  let ctm = [1, 0, 0, 1, 0, 0]; const stack = [];
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const out = [];
  const pt = (x, y) => { const X = ctm[0] * x + ctm[2] * y + ctm[4], Y = ctm[1] * x + ctm[3] * y + ctm[5]; return [X, vp.height - Y]; };
  const addRect = (x, y, w, h) => { const a = pt(x, y), b = pt(x + w, y + h); out.push({ x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) }); };
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i], a = ol.argsArray[i];
    if (fn === OPS.save) stack.push(ctm.slice());
    else if (fn === OPS.restore) ctm = stack.pop() || ctm;
    else if (fn === OPS.transform) ctm = mul(ctm, a);
    else if (fn === OPS.rectangle) addRect(a[0], a[1], a[2], a[3]);
    else if (fn === OPS.constructPath) {
      const ops = a[0], d = a[1]; let k = 0;
      for (const op of ops) {
        if (op === OPS.rectangle) { addRect(d[k], d[k + 1], d[k + 2], d[k + 3]); k += 4; }
        else if (op === OPS.moveTo || op === OPS.lineTo) k += 2;
        else if (op === OPS.curveTo) k += 6;
        else if (op === OPS.curveTo2 || op === OPS.curveTo3) k += 4;
      }
    }
  }
  return out;
}


/** Vertical strokes and rectangle edges (table cell borders), as { x, y0, y1 } from the page's top. */
export async function pageVLines(page) {
  const vp = page.getViewport({ scale: 1 });
  const ol = await page.getOperatorList();
  let ctm = [1, 0, 0, 1, 0, 0]; const stack = [];
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const P = (x, y) => [ctm[0] * x + ctm[2] * y + ctm[4], vp.height - (ctm[1] * x + ctm[3] * y + ctm[5])];
  const out = [];
  const add = (x, ya, yb) => { const y0 = Math.min(ya, yb), y1 = Math.max(ya, yb); if (y1 - y0 >= 6) out.push({ x: +x.toFixed(1), y0: +y0.toFixed(1), y1: +y1.toFixed(1) }); };
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i], a = ol.argsArray[i];
    if (fn === OPS.save) stack.push(ctm.slice()); else if (fn === OPS.restore) ctm = stack.pop() || ctm; else if (fn === OPS.transform) ctm = mul(ctm, a);
    else if (fn === OPS.constructPath) {
      const ops = a[0], d = a[1]; let k = 0, cur = null;
      for (const op of ops) {
        if (op === OPS.moveTo) { cur = P(d[k], d[k + 1]); k += 2; }
        else if (op === OPS.lineTo) { const n = P(d[k], d[k + 1]); k += 2; if (cur && Math.abs(n[0] - cur[0]) < 0.6) add((n[0] + cur[0]) / 2, n[1], cur[1]); cur = n; }
        else if (op === OPS.rectangle) {
          const A = P(d[k], d[k + 1]), B = P(d[k] + d[k + 2], d[k + 1] + d[k + 3]); k += 4;
          const w = Math.abs(B[0] - A[0]);
          if (w < 2) add((A[0] + B[0]) / 2, A[1], B[1]); else { add(Math.min(A[0], B[0]), A[1], B[1]); add(Math.max(A[0], B[0]), A[1], B[1]); }
        }
        else if (op === OPS.curveTo) k += 6; else if (op === OPS.curveTo2 || op === OPS.curveTo3) k += 4;
      }
    }
  }
  return out;
}

/** Long horizontal strokes: the lines answers are written on. */
export async function pageHLines(page, minLen = 30) {
  const vp = page.getViewport({ scale: 1 });
  const ol = await page.getOperatorList();
  let ctm = [1, 0, 0, 1, 0, 0]; const stack = [];
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const P = (x, y) => [ctm[0] * x + ctm[2] * y + ctm[4], vp.height - (ctm[1] * x + ctm[3] * y + ctm[5])];
  const out = [];
  const add = (y, a, b) => { if (Math.abs(b - a) >= minLen) out.push({ y: +y.toFixed(1), x0: +Math.min(a, b).toFixed(1), x1: +Math.max(a, b).toFixed(1) }); };
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i], a = ol.argsArray[i];
    if (fn === OPS.save) stack.push(ctm.slice()); else if (fn === OPS.restore) ctm = stack.pop() || ctm; else if (fn === OPS.transform) ctm = mul(ctm, a);
    else if (fn === OPS.constructPath) {
      const ops = a[0], d = a[1]; let k = 0, cur = null;
      for (const op of ops) {
        if (op === OPS.moveTo) { cur = P(d[k], d[k + 1]); k += 2; }
        else if (op === OPS.lineTo) { const n = P(d[k], d[k + 1]); k += 2; if (cur && Math.abs(n[1] - cur[1]) < 0.6) add((n[1] + cur[1]) / 2, n[0], cur[0]); cur = n; }
        else if (op === OPS.rectangle) { const A = P(d[k], d[k + 1]), B = P(d[k] + d[k + 2], d[k + 1] + d[k + 3]); k += 4; if (Math.abs(B[1] - A[1]) < 1.6) add((A[1] + B[1]) / 2, A[0], B[0]); }
        else if (op === OPS.curveTo) k += 6; else if (op === OPS.curveTo2 || op === OPS.curveTo3) k += 4;
      }
    }
  }
  return out;
}

// Some forms use fonts whose character codes are shifted, or lose their spaces; both are undone so the labels read as English.
const WORDS = /(policy|hospital|address|insured|details|patient|claim|doctor|number|diagnosis|admission|discharge|section)/gi;
const shiftStr = (t, k) => t.replace(/[\x01-\x7e]/g, (ch) => { const c = ch.charCodeAt(0) + k; return c >= 32 && c <= 255 ? String.fromCharCode(c) : ch; });

export async function extractPages(bytes) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, verbosity: 0 }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = tc.items.filter((t) => t.str && t.str.trim()).map((t) => ({
      s: t.str, x: +t.transform[4].toFixed(1), y: +(vp.height - t.transform[5]).toFixed(1), w: +t.width.toFixed(1), h: +(t.height || Math.abs(t.transform[3])).toFixed(1),
    }));
    const sample = items.map((t) => t.s).join(" ");
    const score = (k) => (shiftStr(sample, k).match(WORDS) || []).length;
    let best = 0, bs = score(0);
    for (let k = -40; k <= 40; k++) { if (!k) continue; const sc = score(k); if (sc > bs * 1.5 + 3) { bs = sc; best = k; } }
    if (best) for (const it of items) it.s = shiftStr(it.s, best);
    const all = items.map((t) => t.s).join("");
    const spaces = (all.match(/ /g) || []).length / Math.max(1, all.length);
    if (all.length > 200 && spaces < 0.03) for (const it of items) it.s = spaceify(it.s);
    const lines = [];
    for (const it of items.sort((a, b) => a.y - b.y || a.x - b.x)) {
      const l = lines.find((q) => Math.abs(q.y - it.y) <= 2.5);
      if (l) l.items.push(it); else lines.push({ y: it.y, items: [it] });
    }
    for (const l of lines) l.items.sort((a, b) => a.x - b.x);
    const rects = [], seen = new Set();
    try {
      for (const q of await pageRects(page)) {
        if (q.w > 5.5 && q.w < 30 && q.h > 8 && q.h < 28) {
          const key = `${Math.round(q.x * 2)}:${Math.round(q.y * 2)}:${Math.round(q.w)}`;
          if (!seen.has(key)) { seen.add(key); rects.push({ x: +q.x.toFixed(1), y: +q.y.toFixed(1), w: +q.w.toFixed(1), h: +q.h.toFixed(1) }); }
        }
      }
    } catch { /* a page whose drawing can't be read still has its text */ }
    const vlines = [], vseen = new Set();
    try { for (const q of await pageVLines(page)) { const key = `${Math.round(q.x)}:${Math.round(q.y0)}:${Math.round(q.y1)}`; if (!vseen.has(key)) { vseen.add(key); vlines.push(q); } } } catch { /* optional */ }
    let hlines = [];
    try { hlines = await pageHLines(page); } catch { /* optional */ }
    let shapes = { squares: [], circles: [] };
    try { shapes = await pageShapes(page); } catch { /* optional */ }
    pages.push({ w: vp.width, h: vp.height, lines, rects, vlines, hlines, shapes });
  }
  return pages;
}
