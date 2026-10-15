"use client";

/**
 * Type-ahead patient picker.
 *
 * Several screens offered a plain <select> labelled "Search or select
 * patient" — it could not actually be searched, which is unusable once a
 * hospital has more than a screenful of patients. This filters as you type
 * across name, patient code and phone number.
 */
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { PatientDTO } from "@/types/api";

interface PatientPickerProps {
  patients: PatientDTO[];
  /** Selected patient id as a string, or "" when nothing is chosen. */
  value: string;
  onChange: (id: string, patient: PatientDTO | null) => void;
  placeholder?: string;
  /** Show this many suggestions before scrolling. */
  limit?: number;
}

export function PatientPicker({
  patients,
  value,
  onChange,
  placeholder = "Search by name, ID or phone…",
  limit = 30,
}: PatientPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => patients.find((p) => String(p.id) === value) ?? null,
    [patients, value],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? patients.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.patientId ?? "").toLowerCase().includes(q) ||
            (p.phone ?? "").toLowerCase().includes(q),
        )
      : patients;
    return pool.slice(0, limit);
  }, [patients, query, limit]);

  // A chosen patient shows as a chip; clearing it returns to the search box.
  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 h-[42px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3">
        <span className="text-[14px] text-[color:var(--ink)] truncate">
          {selected.name}
          <span className="text-[12px] text-[color:var(--ink-soft)]"> · {selected.patientId}</span>
        </span>
        <button
          type="button"
          onClick={() => { onChange("", null); setQuery(""); }}
          aria-label="Clear selected patient"
          className="text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] transition-colors shrink-0"
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
      <input
        value={query}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        className="h-[42px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] pl-[34px] pr-3 text-[14px] text-[color:var(--ink)] outline-none focus:border-[color:var(--brand)] focus:bg-[color:var(--surface)] transition-colors"
      />
      {open && (
        <div className="absolute z-30 left-0 right-0 top-[46px] max-h-[240px] overflow-y-auto bg-[color:var(--surface)] border border-[color:var(--line)] rounded-[10px] shadow-lg">
          {matches.length === 0 ? (
            <div className="px-3 py-3 text-[13px] text-[color:var(--ink-soft)]">No matching patients.</div>
          ) : (
            matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={() => { onChange(String(p.id), p); setOpen(false); }}
                className="w-full text-left px-3 py-2 hover:bg-[color:var(--subtle)] transition-colors"
              >
                <span className="text-[13px] text-[color:var(--ink)]">{p.name}</span>
                <span className="block text-[11px] text-[color:var(--ink-soft)]">
                  {p.patientId} · {p.age} yrs · {p.phone}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
