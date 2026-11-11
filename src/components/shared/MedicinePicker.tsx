"use client";

import { useState } from "react";
import { useMedicineMatches } from "@/lib/api/useMedicineSearch";
import type { MedicineDTO } from "@/types/api";

/** Type to search the medicine directory (searched on the server), then pick one. */
export function MedicinePicker({ placeholder, onPick }: { placeholder: string; onPick: (m: MedicineDTO) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { matches } = useMedicineMatches([q]);
  const found = matches(q);
  return (
    <div className="relative">
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder} aria-label={placeholder}
        className="h-[38px] w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px] focus:border-[color:var(--brand)] focus:outline-none" />
      {open && q.trim().length > 1 && (
        <div className="absolute left-0 right-0 top-[40px] z-20 max-h-[260px] overflow-auto rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] shadow-md">
          {found.length === 0 ? <p className="px-3 py-2 text-[12px] text-[color:var(--ink-soft)]">No match yet…</p> : found.map((m) => (
            <button key={m.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(m); setQ(""); setOpen(false); }} className="block w-full px-3 py-2 text-left hover:bg-[color:var(--subtle)]">
              <span className="block text-[13px] text-[color:var(--ink)]">{m.name}</span>
              <span className="block text-[11px] text-[color:var(--ink-soft)]">{m.generic}{m.price != null ? ` · ₹${m.price}` : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
