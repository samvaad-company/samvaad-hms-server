"use client";

import { useState } from "react";
import { inrShort } from "./format";

interface Point { label: string; patients: number; collected: number }

/** A round upper bound for an axis, so the gridlines fall on tidy numbers. */
function niceMax(v: number, floor: number): number {
  if (v <= floor) return floor;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= v)! * pow;
  return step;
}

const W = 1000, H = 250, L = 38, R = 58, T = 12, B = 30;
const TICKS = 4;

/** Footfall as bars (left axis) with the money collected as a line (right axis). */
export function TrendChart({ series }: { series: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const maxP = niceMax(Math.max(0, ...series.map((s) => s.patients)), 4);
  const maxC = niceMax(Math.max(0, ...series.map((s) => s.collected)), 4);
  const iw = W - L - R, ih = H - T - B;
  const slot = iw / Math.max(1, series.length);
  const x = (i: number) => L + slot * i + slot / 2;
  const yP = (v: number) => T + ih - (v / maxP) * ih;
  const yC = (v: number) => T + ih - (v / maxC) * ih;
  const barW = Math.min(60, slot * 0.6);

  // A smooth line through the points (Catmull-Rom → cubic Bézier), clamped so it never dips below the axis.
  const pts = series.map((s, i) => [x(i), yC(s.collected)] as const);
  const line = pts.map(([px, py], i) => {
    if (i === 0) return `M${px},${py}`;
    const [p0x, p0y] = pts[i - 2] ?? pts[i - 1]; const [p1x, p1y] = pts[i - 1]; const [p3x, p3y] = pts[i + 1] ?? pts[i];
    const c1y = Math.min(T + ih, Math.max(T, p1y + (py - p0y) / 6)), c2y = Math.min(T + ih, Math.max(T, py - (p3y - p1y) / 6));
    return `C${p1x + (px - p0x) / 6},${c1y} ${px - (p3x - p1x) / 6},${c2y} ${px},${py}`;
  }).join(" ");

  const active = hover !== null ? series[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Footfall and collections trend"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(series.length - 1, Math.floor((px - L) / slot)))); }}>
        {Array.from({ length: TICKS + 1 }, (_, i) => {
          const y = T + (ih / TICKS) * i;
          return (
            <g key={i}>
              <line x1={L} x2={W - R} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} />
              <text x={L - 8} y={y + 4} textAnchor="end" fontSize={11} fill="var(--ink-soft)">{Math.round(maxP - (maxP / TICKS) * i)}</text>
              <text x={W - R + 8} y={y + 4} fontSize={11} fill="var(--ink-soft)">{inrShort(maxC - (maxC / TICKS) * i)}</text>
            </g>
          );
        })}
        {series.map((s, i) => (
          <g key={s.label + i}>
            {s.patients > 0 && <rect x={x(i) - barW / 2} y={yP(s.patients)} width={barW} height={T + ih - yP(s.patients)} rx={2} fill="var(--brand)" opacity={hover === i ? 0.55 : 0.38} />}
            <text x={x(i)} y={H - 9} textAnchor="middle" fontSize={11} fill="var(--ink-soft)">{s.label}</text>
          </g>
        ))}
        <path d={line} fill="none" stroke="#12a150" strokeWidth={2} strokeLinejoin="round" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + ih} stroke="var(--ink-soft)" strokeWidth={1} opacity={0.5} />}
        {hover !== null && <circle cx={x(hover)} cy={yC(series[hover].collected)} r={4} fill="#12a150" stroke="var(--surface)" strokeWidth={2} />}
      </svg>
      {active && hover !== null && (
        <div className="pointer-events-none absolute z-10 min-w-[130px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-2 text-[12px] shadow-md"
          style={{ left: `${(x(hover) / W) * 100}%`, top: 8, transform: `translateX(${hover > series.length / 2 ? "-105%" : "5%"})` }}>
          <p className="mb-1 text-[color:var(--ink-soft)]">{active.label}</p>
          <p className="font-mono">Collected : ₹{Math.round(active.collected).toLocaleString("en-IN")}</p>
          <p className="font-mono">Patients : {active.patients}</p>
        </div>
      )}
    </div>
  );
}
