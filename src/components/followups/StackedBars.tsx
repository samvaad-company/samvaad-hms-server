"use client";

/**
 * A stacked bar chart drawn with plain elements (no chart library): one column per bucket (a day or a week),
 * segments stacked bottom to top in the order of `series`, gridlines with a rounded-up maximum, and a few
 * evenly spaced labels along the bottom. Hover a column to see its numbers. Colours are CSS, so it follows
 * light/dark.
 */
import { useMemo } from "react";

export interface Series { key: string; label: string; color: string }
export interface Bar { key: string; label: string; values: Record<string, number> }

const niceMax = (n: number): number => {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  const step = [1, 2, 2.5, 5, 10].map(f => f * pow).find(c => c >= n / 4)!;
  return Math.ceil(n / step) * step;
};

export function StackedBars({ bars, series, height = 220, noun = "follow-ups" }: { bars: Bar[]; series: Series[]; height?: number; noun?: string }) {
  const totals = useMemo(() => bars.map(b => series.reduce((n, s) => n + (b.values[s.key] ?? 0), 0)), [bars, series]);
  const max = niceMax(Math.max(0, ...totals));
  const ticks = [0, 1, 2, 3, 4].map(i => (max / 4) * i);
  const every = Math.max(1, Math.ceil(bars.length / 8));

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative w-7 shrink-0 text-[10.5px] text-[color:var(--ink-soft)] font-mono" style={{ height }}>
          {ticks.map(t => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / max) * 100}%` }}>{Number.isInteger(t) ? t : t.toFixed(1)}</span>
          ))}
        </div>
        <div className="relative flex-1 min-w-0" style={{ height }}>
          {ticks.map(t => (
            <div key={t} className="absolute left-0 right-0 border-t border-[color:var(--line)]" style={{ bottom: `${(t / max) * 100}%`, opacity: t === 0 ? 1 : 0.6 }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {bars.map((b, i) => {
              const tip = `${b.label}: ${totals[i]} ${noun}` + (totals[i] ? ` — ${series.filter(s => b.values[s.key]).map(s => `${b.values[s.key]} ${s.label.toLowerCase()}`).join(", ")}` : "");
              return (
                <div key={b.key} title={tip} className="group relative flex-1 min-w-0 h-full flex flex-col justify-end hover:bg-[color:var(--subtle)]/60 rounded-t-[3px]">
                  {series.map(s => {
                    const v = b.values[s.key] ?? 0;
                    return v > 0 ? <div key={s.key} style={{ height: `${(v / max) * 100}%`, background: s.color }} className="w-full first:rounded-t-[0] last:rounded-t-[3px]" /> : null;
                  }).reverse()}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-1">
        <div className="w-7 shrink-0" />
        <div className="flex-1 min-w-0 flex gap-[2px]">
          {bars.map((b, i) => (
            <div key={b.key} className="flex-1 min-w-0 relative h-4">
              {i % every === 0 && <span className="absolute left-0 text-[10.5px] text-[color:var(--ink-soft)] whitespace-nowrap">{b.label}</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 ml-9">
        {series.map(s => (
          <span key={s.key} className="inline-flex items-center gap-[6px] text-[11.5px] text-[color:var(--ink-soft)]">
            <span className="w-[10px] h-[10px] rounded-[3px]" style={{ background: s.color }} />{s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
