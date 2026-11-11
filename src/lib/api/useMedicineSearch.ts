"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import type { MedicineDTO } from "@/types/api";

/**
 * The medicine directory is far too big to load whole, so it is searched on the server as people type. Give it the texts being
 * searched; it returns the best few matches for each, and remembers every medicine it has seen (so a picked name can be
 * looked up again by `byName`).
 */
export function useMedicineMatches(queries: string[], limit = 8) {
  const [results, setResults] = useState<Record<string, MedicineDTO[]>>({});
  const known = useRef(new Map<string, MedicineDTO>());
  const asked = useRef(new Set<string>());
  const key = [...new Set(queries.map((q) => q.trim().toLowerCase()).filter((q) => q.length > 1))].join("\u0001");

  useEffect(() => {
    const todo = key ? key.split("\u0001").filter((q) => !asked.current.has(q)) : [];
    if (todo.length === 0) return;
    const t = setTimeout(() => {
      for (const q of todo) {
        asked.current.add(q);
        api.list<MedicineDTO>("/medicines", { search: q, pageSize: limit })
          .then(({ data }) => { for (const m of data) known.current.set(m.name, m); setResults((r) => ({ ...r, [q]: data })); })
          .catch(() => asked.current.delete(q));
      }
    }, 250);
    return () => clearTimeout(t);
  }, [key, limit]);

  return {
    matches: (q: string): MedicineDTO[] => results[q.trim().toLowerCase()] ?? [],
    byName: (name: string): MedicineDTO | undefined => known.current.get(name),
  };
}
