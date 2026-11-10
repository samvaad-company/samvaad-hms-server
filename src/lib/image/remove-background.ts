/**
 * Turns a photo or scan of a signature (or stamp) on paper into a PNG with a transparent background.
 *
 * It runs entirely in the browser with plain canvas maths: no API, no AI model, no cost, and the picture never leaves the device.
 *
 * How it works
 *  1. The paper's own brightness is estimated at every point (the brightest thing nearby, smoothed), so uneven light, shadows and tinted
 *     paper are measured instead of assumed.
 *  2. Each pixel's "ink" is how much darker it is than the paper there (0 = paper, 1 = solid ink).
 *  3. A threshold is found automatically (Otsu's method) and the ink is turned into opacity with a soft edge, so thin strokes keep
 *     their anti-aliased edges instead of turning jagged.
 *  4. The ink's true colour is recovered by removing the paper's contribution from each edge pixel (no white halo).
 *  5. Stray specks are dropped and the result is cropped to the writing.
 *
 * `analyse` does the heavy work once per picture; `render` is cheap, so a "remove more / keep more" slider updates instantly.
 */

export type InkColour = "original" | "black" | "blue";

export interface RenderOptions {
  /** 0 removes more (cleaner, may thin faint strokes); 100 keeps more (keeps faint strokes, may keep some paper texture). Default 50. */
  sensitivity: number;
  ink: InkColour;
}

export interface Analysis {
  width: number;
  height: number;
  /** The picture, RGBA, as drawn on the working canvas. */
  rgba: Uint8ClampedArray;
  /** Paper brightness at each pixel (0–255). */
  paper: Float32Array;
  /** How much darker than the paper each pixel is, 0–1. */
  ink: Float32Array;
  /** The automatic threshold on `ink`. */
  threshold: number;
  /** The picture already had a transparent background: nothing to remove. */
  alreadyTransparent: boolean;
}

/** Longest side the work is done at: big enough for a clean signature, small enough to be quick on a phone. */
const WORK_SIDE = 1200;
/** The saved picture's width cap and size cap (the server keeps pictures under ~450 000 characters). */
const OUT_WIDTH = 640;
const MAX_DATA_URL = 400_000;

async function loadBitmap(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch { /* fall through to <img> */ }
  }
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That file isn't a picture.")); i.src = url; });
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

/** Separable box blur on a small float map. */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    let sum = 0, count = 0;
    for (let x = -r; x <= r; x++) { const xi = Math.min(w - 1, Math.max(0, x)); sum += src[y * w + xi]; count++; }
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / count;
      const add = Math.min(w - 1, x + r + 1), sub = Math.max(0, x - r);
      sum += src[y * w + add] - src[y * w + sub];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0, count = 0;
    for (let y = -r; y <= r; y++) { const yi = Math.min(h - 1, Math.max(0, y)); sum += tmp[yi * w + x]; count++; }
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / count;
      const add = Math.min(h - 1, y + r + 1), sub = Math.max(0, y - r);
      sum += tmp[add * w + x] - tmp[sub * w + x];
    }
  }
  return out;
}

/** Separable max filter (grey dilation): the brightest value within `r` of each pixel. */
function maxFilter(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) if (src[y * w + k] > m) m = src[y * w + k];
    tmp[y * w + x] = m;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) if (tmp[k * w + x] > m) m = tmp[k * w + x];
    out[y * w + x] = m;
  }
  return out;
}

/** Otsu's threshold over a 0–1 map, ignoring the (huge) near-zero paper population so the split lands between noise and ink. */
function otsu(values: Float32Array): number {
  const bins = 256, hist = new Float64Array(bins);
  let total = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v < 0.04) continue;
    hist[Math.min(bins - 1, Math.floor(v * bins))]++; total++;
  }
  if (total < 20) return 0.25;
  let sumAll = 0;
  for (let i = 0; i < bins; i++) sumAll += i * hist[i];
  let wB = 0, sumB = 0, best = 0, bestT = 0;
  for (let t = 0; t < bins; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; bestT = t; }
  }
  return Math.min(0.6, Math.max(0.08, bestT / bins));
}

/** Reads a picture file and measures it. Throws a plain-English error if it can't be read. */
export async function analyse(file: Blob): Promise<Analysis> {
  const bmp = await loadBitmap(file);
  try {
    const scale = Math.min(1, WORK_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(bmp.source, 0, 0, w, h);
    const rgba = ctx.getImageData(0, 0, w, h).data;
    const n = w * h;

    let transparent = 0;
    for (let i = 0; i < n; i++) if (rgba[i * 4 + 3] < 250) transparent++;
    const alreadyTransparent = transparent / n > 0.02;

    // Brightness, with anything transparent counted as paper-white.
    const gray = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = rgba[i * 4 + 3] / 255;
      const g = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
      gray[i] = g * a + 255 * (1 - a);
    }

    // Paper estimate on a quarter-size copy: brightest nearby (strokes vanish), then smoothed.
    const f = 4, sw = Math.max(1, Math.ceil(w / f)), sh = Math.max(1, Math.ceil(h / f));
    const small = new Float32Array(sw * sh);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      let s = 0, c = 0;
      for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
        const xx = x * f + dx, yy = y * f + dy;
        if (xx < w && yy < h) { s += gray[yy * w + xx]; c++; }
      }
      small[y * sw + x] = s / c;
    }
    const r = Math.max(5, Math.round(Math.min(sw, sh) / 7));
    const paperSmall = boxBlur(maxFilter(small, sw, sh, r), sw, sh, Math.max(2, Math.round(r / 2)));
    const paper = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      const fy = Math.min(sh - 1, y / f), y0 = Math.floor(fy), y1 = Math.min(sh - 1, y0 + 1), ty = fy - y0;
      for (let x = 0; x < w; x++) {
        const fx = Math.min(sw - 1, x / f), x0 = Math.floor(fx), x1 = Math.min(sw - 1, x0 + 1), tx = fx - x0;
        const top = paperSmall[y0 * sw + x0] * (1 - tx) + paperSmall[y0 * sw + x1] * tx;
        const bot = paperSmall[y1 * sw + x0] * (1 - tx) + paperSmall[y1 * sw + x1] * tx;
        paper[y * w + x] = Math.max(1, top * (1 - ty) + bot * ty);
      }
    }

    const ink = new Float32Array(n);
    for (let i = 0; i < n; i++) ink[i] = Math.min(1, Math.max(0, (paper[i] - gray[i]) / paper[i]));
    return { width: w, height: h, rgba, paper, ink, threshold: alreadyTransparent ? 0 : otsu(ink), alreadyTransparent };
  } finally { bmp.close(); }
}

const smooth = (lo: number, hi: number, v: number) => { if (v <= lo) return 0; if (v >= hi) return 1; const t = (v - lo) / (hi - lo); return t * t * (3 - 2 * t); };

/** Drops connected specks smaller than `minArea` pixels (8-connected) from an alpha map. */
function despeckle(alpha: Float32Array, w: number, h: number, minArea: number) {
  const seen = new Uint8Array(alpha.length), stack: number[] = [];
  for (let s = 0; s < alpha.length; s++) {
    if (seen[s] || alpha[s] < 0.35) continue;
    const comp: number[] = [];
    stack.push(s); seen[s] = 1;
    while (stack.length) {
      const p = stack.pop()!; comp.push(p);
      const x = p % w, y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = yy * w + xx;
        if (!seen[q] && alpha[q] >= 0.35) { seen[q] = 1; stack.push(q); }
      }
    }
    if (comp.length < minArea) for (const p of comp) alpha[p] = 0;
  }
}

export interface Rendered {
  canvas: HTMLCanvasElement;
  /** False when nothing that looks like writing was found. */
  found: boolean;
}

/** Builds the transparent picture from an analysis. Cheap enough to call on every slider move. */
export function render(a: Analysis, opts: RenderOptions): Rendered {
  const { width: w, height: h, rgba, paper, ink } = a;
  const n = w * h;
  const alpha = new Float32Array(n);

  if (a.alreadyTransparent) {
    for (let i = 0; i < n; i++) alpha[i] = rgba[i * 4 + 3] / 255;
  } else {
    // 0 → remove more (factor 1.6), 100 → keep more (factor 0.4).
    const m = 1.6 - (Math.min(100, Math.max(0, opts.sensitivity)) / 100) * 1.2;
    const lo = Math.max(0.025, 0.45 * a.threshold * m), hi = Math.max(lo + 0.05, 1.4 * a.threshold * m);
    for (let i = 0; i < n; i++) alpha[i] = smooth(lo, hi, ink[i]);
    despeckle(alpha, w, h, Math.max(6, Math.round(n * 0.00004)));
  }

  const out = new Uint8ClampedArray(n * 4);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, al = alpha[i];
    if (al <= 0.003) continue;
    const j = i * 4;
    let r: number, g: number, b: number;
    if (opts.ink === "black") { r = g = b = 15; }
    else if (opts.ink === "blue") { r = 10; g = 40; b = 160; }
    else if (a.alreadyTransparent) { r = rgba[j]; g = rgba[j + 1]; b = rgba[j + 2]; }
    else {
      // Take the paper's share out of the pixel to get the pen's own colour (no pale halo on soft edges).
      const bgc = paper[i], k = 1 - al;
      r = (rgba[j] - bgc * k) / al; g = (rgba[j + 1] - bgc * k) / al; b = (rgba[j + 2] - bgc * k) / al;
      // Pen ink is never lighter than mid-grey; keep a faint stroke readable on a printed form.
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 120) { const s = 120 / lum; r *= s; g *= s; b *= s; }
    }
    out[j] = Math.max(0, Math.min(255, r)); out[j + 1] = Math.max(0, Math.min(255, g)); out[j + 2] = Math.max(0, Math.min(255, b));
    out[j + 3] = Math.round(al * 255);
    if (al > 0.08) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }

  const full = document.createElement("canvas");
  full.width = w; full.height = h;
  full.getContext("2d")!.putImageData(new ImageData(out, w, h), 0, 0);
  if (maxX < 0) return { canvas: full, found: false };

  // Crop to the writing with a small margin.
  const pad = Math.round(Math.max(w, h) * 0.01) + 2;
  const cx = Math.max(0, minX - pad), cy = Math.max(0, minY - pad);
  const cw = Math.min(w, maxX + pad + 1) - cx, ch = Math.min(h, maxY + pad + 1) - cy;
  const cropped = document.createElement("canvas");
  cropped.width = cw; cropped.height = ch;
  cropped.getContext("2d")!.drawImage(full, cx, cy, cw, ch, 0, 0, cw, ch);
  return { canvas: cropped, found: true };
}

/** The transparent PNG as a data URL, shrunk until it is small enough to keep. */
export function toKeepableDataUrl(canvas: HTMLCanvasElement): string {
  let width = Math.min(OUT_WIDTH, canvas.width);
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = width / canvas.width;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(canvas.width * scale)); c.height = Math.max(1, Math.round(canvas.height * scale));
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/png");
    if (url.length <= MAX_DATA_URL) return url;
    width = Math.round(width * 0.8);
  }
  throw new Error("That picture is too detailed to keep. Try a tighter photo of just the signature.");
}
