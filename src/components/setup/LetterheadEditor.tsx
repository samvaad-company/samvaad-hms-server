"use client";

/**
 * Lines a photo or scan of the printed letterhead up with an A4 page: drag it, zoom in to crop out the table or edges, straighten and turn
 * it, and see the print area on top. The result is drawn onto an A4 canvas (1240 x 1754 px) and handed back as a JPEG.
 */
import { useEffect, useRef, useState } from "react";
import { RotateCcw, RotateCw, SlidersHorizontal, X } from "lucide-react";

const PAGE_W = 1240, PAGE_H = 1754; // A4 at 150 dpi

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("That file could not be read as a picture. Use a PNG or JPG.")); i.src = src; });
}

interface Fit { zoom: number; rot: number; dx: number; dy: number; stretch: number; brighten: boolean }
const START: Fit = { zoom: 1, rot: 0, dx: 0, dy: 0, stretch: 1, brighten: false };

/** The picture covers the page at zoom 1; it is then moved, turned and scaled about the page centre. */
function paint(g: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, f: Fit) {
  g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
  const turned = Math.abs(Math.round(f.rot / 90)) % 2 === 1;
  const iw = turned ? img.naturalHeight : img.naturalWidth, ih = turned ? img.naturalWidth : img.naturalHeight;
  const cover = Math.max(w / iw, h / ih) * f.zoom;
  g.save();
  if (f.brighten) g.filter = "brightness(1.12) contrast(1.15) saturate(1.1)";
  g.translate(w / 2 + f.dx * w, h / 2 + f.dy * h);
  g.rotate((f.rot * Math.PI) / 180);
  g.scale(cover * f.stretch, cover);
  g.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  g.restore();
}

export function LetterheadEditor({ src, topMm, bottomMm, onCancel, onDone }: { src: string; topMm: number; bottomMm: number; onCancel: () => void; onDone: (dataUrl: string) => Promise<void> }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [fit, setFit] = useState<Fit>(START);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [grid, setGrid] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const PW = 420, PH = Math.round((PW * 297) / 210);

  useEffect(() => { let live = true; loadImage(src).then((i) => { if (live) setImg(i); }, (e) => { if (live) setErr((e as Error).message); }); return () => { live = false; }; }, [src]);
  useEffect(() => {
    const c = canvas.current, g = c?.getContext("2d");
    if (img && c && g) paint(g, img, c.width, c.height, fit);
  }, [img, fit]);

  const set = (patch: Partial<Fit>) => setFit((f) => ({ ...f, ...patch }));
  const nudge = (x: number, y: number) => setFit((f) => ({ ...f, dx: f.dx + x, dy: f.dy + y }));
  async function done() {
    if (!img) return;
    setSaving(true); setErr("");
    try {
      const c = document.createElement("canvas");
      c.width = PAGE_W; c.height = PAGE_H;
      const g = c.getContext("2d");
      if (!g) throw new Error("This browser cannot prepare the picture.");
      paint(g, img, PAGE_W, PAGE_H, fit);
      await onDone(c.toDataURL("image/jpeg", 0.88));
    } catch (e) { setErr((e as Error).message || "That could not be saved."); setSaving(false); }
  }

  const btn = "inline-flex h-[30px] cursor-pointer items-center justify-center gap-1 rounded-[8px] border border-[color:var(--line)] px-2 text-[12px] hover:bg-[color:var(--subtle)]";
  const slider = (label: string, value: number, min: number, max: number, step: number, show: string, on: (v: number) => void) => (
    <label className="flex flex-col gap-1 text-[12px] text-[color:var(--ink-soft)]">
      <span className="flex justify-between"><span>{label}</span><span className="text-[color:var(--ink)]">{show}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => on(Number(e.target.value))} className="w-full accent-[color:var(--brand)]" />
    </label>
  );
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Arrange the letterhead">
      <div className="flex max-h-full w-full max-w-[860px] flex-col overflow-hidden rounded-[14px] bg-[color:var(--surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[color:var(--line)] px-5 py-3">
          <div>
            <h3 className="text-[16px] font-medium text-[color:var(--ink)]">Arrange the letterhead</h3>
            <p className="text-[12px] text-[color:var(--ink-soft)]">Drag the picture to move it. Zoom in to crop out the table or edges, and straighten it until the lines are level.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="cursor-pointer rounded-full p-2 hover:bg-[color:var(--subtle)]"><X size={16} /></button>
        </div>
        <div className="flex flex-1 flex-wrap items-start gap-6 overflow-y-auto p-5">
          <div className="relative shrink-0 touch-none select-none overflow-hidden rounded-[6px] border border-[color:var(--line)] bg-white shadow" style={{ width: PW, height: PH, maxWidth: "100%" }}>
            <canvas
              ref={canvas} width={PW * 2} height={PH * 2} className="h-full w-full cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, dx: fit.dx, dy: fit.dy }; }}
              onPointerMove={(e) => { const d = drag.current; if (!d) return; const r = e.currentTarget.getBoundingClientRect(); set({ dx: d.dx + (e.clientX - d.x) / r.width, dy: d.dy + (e.clientY - d.y) / r.height }); }}
              onPointerUp={() => { drag.current = null; }}
            />
            {grid && (
              <div className="pointer-events-none absolute inset-0">
                {[25, 50, 75].map((p) => <span key={`v${p}`} className="absolute inset-y-0 border-l border-dashed border-[#2b7fff]/40" style={{ left: `${p}%` }} />)}
                {[25, 50, 75].map((p) => <span key={`h${p}`} className="absolute inset-x-0 border-t border-dashed border-[#2b7fff]/40" style={{ top: `${p}%` }} />)}
                <span className="absolute inset-x-0 border-y border-dashed border-[#d9534f]/70 bg-[#d9534f]/5" style={{ top: `${Math.min(60, (topMm / 297) * 100)}%`, bottom: `${Math.min(40, (bottomMm / 297) * 100)}%` }} />
              </div>
            )}
            {!img && !err && <div className="absolute inset-0 flex items-center justify-center text-[12px] text-[color:var(--ink-soft)]">Loading…</div>}
          </div>
          <div className="flex min-w-[240px] flex-1 flex-col gap-4">
            {slider("Zoom", fit.zoom, 1, 3, 0.01, `${Math.round(fit.zoom * 100)}%`, (v) => set({ zoom: v }))}
            {slider("Straighten", fit.rot, -180, 180, 0.1, `${fit.rot.toFixed(1)}°`, (v) => set({ rot: v }))}
            {slider("Width", fit.stretch, 0.85, 1.15, 0.005, `${Math.round(fit.stretch * 100)}%`, (v) => set({ stretch: v }))}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn} onClick={() => set({ rot: Math.round(fit.rot / 90) * 90 - 90 })}><RotateCcw size={13} /> Turn left</button>
              <button type="button" className={btn} onClick={() => set({ rot: Math.round(fit.rot / 90) * 90 + 90 })}><RotateCw size={13} /> Turn right</button>
            </div>
            <div>
              <p className="mb-1 text-[12px] text-[color:var(--ink-soft)]">Nudge</p>
              <div className="inline-grid grid-cols-3 gap-1">
                <span /><button type="button" className={btn} aria-label="Up" onClick={() => nudge(0, -0.002)}>↑</button><span />
                <button type="button" className={btn} aria-label="Left" onClick={() => nudge(-0.002, 0)}>←</button>
                <button type="button" className={btn} aria-label="Centre" onClick={() => set({ dx: 0, dy: 0 })}>•</button>
                <button type="button" className={btn} aria-label="Right" onClick={() => nudge(0.002, 0)}>→</button>
                <span /><button type="button" className={btn} aria-label="Down" onClick={() => nudge(0, 0.002)}>↓</button><span />
              </div>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-[color:var(--ink)]"><input type="checkbox" checked={fit.brighten} onChange={(e) => set({ brighten: e.target.checked })} /> Brighten the paper (for photos)</label>
            <label className="flex items-center gap-2 text-[13px] text-[color:var(--ink)]"><input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /> Show guides and the print area</label>
            <button type="button" className={`${btn} self-start`} onClick={() => setFit(START)}><SlidersHorizontal size={13} /> Reset</button>
            {err && <p className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#ff0004]">{err}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[color:var(--line)] px-5 py-3">
          <button type="button" onClick={onCancel} className="h-[36px] cursor-pointer rounded-full border border-[color:var(--line)] px-5 text-[13px] hover:bg-[color:var(--subtle)]">Cancel</button>
          <button type="button" disabled={!img || saving} onClick={() => void done()} className="h-[36px] cursor-pointer rounded-full bg-[color:var(--brand)] px-5 text-[13px] font-medium text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50">{saving ? "Saving…" : "Save letterhead"}</button>
        </div>
      </div>
    </div>
  );
}
