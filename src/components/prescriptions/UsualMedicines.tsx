"use client";

/**
 * The doctor's usual medicines for the diseases of this patient: what they prescribed before for the same disease, from the table kept
 * for each doctor (no AI). Tapping one fills a medicine row with the dose, pattern, timing and duration they used last.
 */
import { useEffect, useState } from "react";
import { Check, History } from "lucide-react";
import { api } from "@/lib/api/client";
import { toPattern } from "@/lib/prescriptions/remarks";
import type { UsualMedicineDTO, UsualMedicinesGroupDTO } from "@/types/api";

export function UsualMedicines({ doctorId, diseases, taken, onPick }: { doctorId: string; diseases: string[]; taken: string[]; onPick: (m: UsualMedicineDTO) => void }) {
  const [groups, setGroups] = useState<UsualMedicinesGroupDTO[]>([]);
  const sig = diseases.join(";");
  useEffect(() => {
    if (!doctorId || !sig) { setGroups([]); return; }
    let dead = false;
    const t = setTimeout(() => {
      api.get<UsualMedicinesGroupDTO[]>("/prescriptions/usual-medicines", { doctorId, diagnoses: sig }).then((r) => { if (!dead) setGroups(r); }).catch(() => { if (!dead) setGroups([]); });
    }, 300);
    return () => { dead = true; clearTimeout(t); };
  }, [doctorId, sig]);
  if (!groups.length) return null;
  const has = (name: string) => taken.some((t) => t.trim().toLowerCase() === name.trim().toLowerCase());

  return (
    <div className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--subtle)] p-3">
      <p className="mb-2 flex items-center gap-2 text-[12px] font-medium text-[color:var(--ink)]"><History size={13} className="text-[color:var(--brand)]" /> Your usual medicines for this patient&apos;s illnesses. Tap one to add it with the dose you used before.</p>
      <div className="flex flex-col gap-2">
        {groups.map((g) => (
          <div key={g.diagnosis} className="flex flex-wrap items-start gap-2">
            <span className="w-[170px] shrink-0 pt-[5px] text-[11px] font-medium uppercase tracking-wide text-[color:var(--ink-soft)]">{g.diagnosis}</span>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {g.items.map((m) => {
                const done = has(m.medicineName);
                const detail = [m.dosage, toPattern(m.frequency), m.timing, m.duration].filter(Boolean).join(" · ");
                return (
                  <button key={m.id} type="button" disabled={done} onClick={() => onPick(m)} title={`${m.medicineName}${detail ? ` — ${detail}` : ""}. Used in ${m.useCount} prescription${m.useCount === 1 ? "" : "s"}.`}
                    className={`inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full border px-3 py-[4px] text-left text-[12px] transition-colors ${done ? "cursor-default border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink-soft)]" : "border-[color:var(--brand)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-[color:var(--brand-soft)]"}`}>
                    {done && <Check size={12} className="shrink-0 text-[#0b7a47]" />}
                    <span className="truncate font-medium">{m.medicineName}</span>
                    {detail && <span className="truncate text-[11px] text-[color:var(--ink-soft)]">{detail}</span>}
                    <span className="shrink-0 rounded-full bg-[color:var(--subtle-2)] px-[6px] text-[10px] text-[color:var(--ink-soft)]">{m.useCount}×</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
