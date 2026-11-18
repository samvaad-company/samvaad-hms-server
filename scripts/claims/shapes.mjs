/**
 * Small tick boxes and radio circles drawn on a claim-form page (top-left origin, points).
 * A circle is four curves; a box is a rectangle or four straight strokes. Needs pdfjs-dist.
 */
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
const OPS = pdfjs.OPS;

export async function pageShapes(page) {
  const vp = page.getViewport({ scale: 1 });
  const ol = await page.getOperatorList();
  let ctm = [1, 0, 0, 1, 0, 0]; const stack = [];
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const P = (x, y) => [ctm[0] * x + ctm[2] * y + ctm[4], vp.height - (ctm[1] * x + ctm[3] * y + ctm[5])];
  const squares = [], circles = [];
  const ok = (w, h) => w >= 4 && w <= 15 && h >= 4 && h <= 15 && Math.abs(w - h) <= 2.6;
  const finish = (pts, curves, lines) => {
    if (pts.length < 3) return;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), w = x1 - x0, h = y1 - y0;
    if (!ok(w, h)) return;
    if (curves >= 4 && lines === 0) circles.push({ cx: +((x0 + x1) / 2).toFixed(1), cy: +((y0 + y1) / 2).toFixed(1), r: +(Math.max(w, h) / 2).toFixed(1) });
    else if (curves >= 1 && curves <= 4 && lines >= 2) squares.push({ x0: +x0.toFixed(1), y0: +y0.toFixed(1), x1: +x1.toFixed(1), y1: +y1.toFixed(1) });
    else if (curves === 0 && lines >= 3 && pts.every((p) => (Math.abs(p[0] - x0) < 0.6 || Math.abs(p[0] - x1) < 0.6) && (Math.abs(p[1] - y0) < 0.6 || Math.abs(p[1] - y1) < 0.6))) squares.push({ x0: +x0.toFixed(1), y0: +y0.toFixed(1), x1: +x1.toFixed(1), y1: +y1.toFixed(1) });
  };
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i], a = ol.argsArray[i];
    if (fn === OPS.save) stack.push(ctm.slice()); else if (fn === OPS.restore) ctm = stack.pop() || ctm; else if (fn === OPS.transform) ctm = mul(ctm, a);
    else if (fn === OPS.constructPath) {
      const ops = a[0], d = a[1]; let k = 0, pts = [], curves = 0, lines = 0;
      for (const op of ops) {
        if (op === OPS.moveTo) { finish(pts, curves, lines); pts = [P(d[k], d[k + 1])]; curves = 0; lines = 0; k += 2; }
        else if (op === OPS.lineTo) { pts.push(P(d[k], d[k + 1])); lines++; k += 2; }
        else if (op === OPS.curveTo) { pts.push(P(d[k + 4], d[k + 5])); curves++; k += 6; }
        else if (op === OPS.curveTo2 || op === OPS.curveTo3) { pts.push(P(d[k + 2], d[k + 3])); curves++; k += 4; }
        else if (op === OPS.rectangle) {
          finish(pts, curves, lines); pts = []; curves = 0; lines = 0;
          const A = P(d[k], d[k + 1]), B = P(d[k] + d[k + 2], d[k + 1] + d[k + 3]); k += 4;
          const w = Math.abs(B[0] - A[0]), h = Math.abs(B[1] - A[1]);
          if (ok(w, h)) squares.push({ x0: +Math.min(A[0], B[0]).toFixed(1), y0: +Math.min(A[1], B[1]).toFixed(1), x1: +Math.max(A[0], B[0]).toFixed(1), y1: +Math.max(A[1], B[1]).toFixed(1) });
        }
      }
      finish(pts, curves, lines);
    }
  }
  const dedupe = (list, key) => { const seen = new Set(); return list.filter((s) => { const q = key(s); if (seen.has(q)) return false; seen.add(q); return true; }); };
  return { squares: dedupe(squares, (s) => `${Math.round(s.x0)}:${Math.round(s.y0)}`), circles: dedupe(circles, (s) => `${Math.round(s.cx)}:${Math.round(s.cy)}`) };
}
