"use client";

/** The Morning-Afternoon-Night boxes of a medicine: 1-0-1 is one in the morning and one at night. A fourth box adds the evening dose. */
import { isPattern, toPattern } from "@/lib/prescriptions/remarks";

const box = "h-[36px] w-[30px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] text-center text-[13px] font-medium text-[color:var(--ink)] focus:border-[color:var(--brand)] focus:outline-none";

export function PatternInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const v = toPattern(value);
  if (v === "SOS") {
    return <div className="flex h-[36px] items-center gap-2 rounded-[8px] bg-[color:var(--brand-soft)] px-3 text-[12px] font-medium text-[color:var(--brand)]">SOS <button type="button" onClick={() => onChange("1-0-1")} className="cursor-pointer text-[11px] font-normal underline">change</button></div>;
  }
  const parts = isPattern(v) ? v.split("-") : ["", "", ""];
  const four = parts.length === 4;
  const set = (i: number, d: string) => {
    const next = [...parts];
    next[i] = d.replace(/[^0-9]/g, "").slice(-1);
    onChange(next.every((x) => x === "") ? "" : next.map((x) => x || "0").join("-"));
  };
  const labels = four ? ["Morning", "Afternoon", "Evening", "Night"] : ["Morning", "Afternoon", "Night"];
  return (
    <div className="flex items-center gap-1">
      {parts.map((d, i) => (
        <span key={i} className="flex items-center gap-1">
          <input aria-label={labels[i]} inputMode="numeric" value={d} placeholder="0" onChange={(e) => set(i, e.target.value)} onFocus={(e) => e.currentTarget.select()} className={box} />
          {i < parts.length - 1 && <span className="text-[color:var(--ink-soft)]">-</span>}
        </span>
      ))}
      <button type="button" title={four ? "Back to three doses" : "Add an evening dose"} onClick={() => onChange(four ? [parts[0], parts[1], parts[3]].join("-") : [parts[0] || "0", parts[1] || "0", "0", parts[2] || "0"].join("-"))}
        className="ml-1 h-[36px] cursor-pointer rounded-[8px] border border-dashed border-[color:var(--line)] px-[6px] text-[11px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]">{four ? "3" : "+4"}</button>
      <button type="button" title="Only when needed" onClick={() => onChange("SOS")}
        className="h-[36px] cursor-pointer rounded-[8px] border border-dashed border-[color:var(--line)] px-[6px] text-[11px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]">SOS</button>
    </div>
  );
}
