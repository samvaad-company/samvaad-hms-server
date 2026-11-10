"use client";

/**
 * A patient's name with their loyalty rank's stars beside it: one star for Basic up to five for VIP, in the rank's own colour
 * (bronze, silver, gold, indigo, black). Use it wherever a patient's name is shown. It finds the rank by the patient's id, or by the
 * name when the name belongs to only one patient. With no rank (loyalty off, or an unknown patient) it is just the name.
 *
 *   <PatientName id={p.id} name={p.name} />
 *   <PatientName name={bill.patientName} />
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Star } from "lucide-react";
import { useItem } from "@/lib/api/hooks";
import type { LoyaltyRankIndexDTO } from "@/types/loyalty";

const RankContext = createContext<LoyaltyRankIndexDTO | null>(null);

/** Loads everyone's rank once for the whole signed-in app. */
export function LoyaltyRankProvider({ children }: { children: ReactNode }) {
  const { item } = useItem<LoyaltyRankIndexDTO>("/loyalty/ranks");
  return <RankContext.Provider value={item?.enabled ? item : null}>{children}</RankContext.Provider>;
}

export interface PatientRank { key: string; name: string; color: string; stars: number }

/** The rank for a patient (by id, else by a unique name), or null. */
export function usePatientRank(id?: number | string | null, name?: string | null): PatientRank | null {
  const index = useContext(RankContext);
  return useMemo(() => {
    if (!index) return null;
    const pid = id === undefined || id === null || id === "" ? NaN : Number(id);
    const key = (Number.isFinite(pid) ? index.byId[pid] : undefined) ?? (name ? index.byName[name.trim().toLowerCase()] : undefined);
    const rank = key ? index.ranks[key] : undefined;
    return key && rank ? { key, ...rank } : null;
  }, [index, id, name]);
}

/** Only the earned stars, in the rank's colour. */
export function RankStars({ rank, size = 11 }: { rank: PatientRank; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-[1px] align-middle" role="img" aria-label={`${rank.name} member, ${rank.stars} ${rank.stars === 1 ? "star" : "stars"}`} title={`${rank.name} member`}>
      {Array.from({ length: rank.stars }, (_, i) => <Star key={i} size={size} strokeWidth={1.5} className="dark:[filter:drop-shadow(0_0_1px_rgba(255,255,255,0.9))]" style={{ color: rank.color, fill: rank.color }} />)}
    </span>
  );
}

export function PatientName({ id, name, size, className }: { id?: number | string | null; name: ReactNode; size?: number; className?: string }) {
  const rank = usePatientRank(id, typeof name === "string" ? name : null);
  if (!rank) return <>{name}</>;
  return <span className={`inline-flex max-w-full items-center gap-[6px] ${className ?? ""}`}><span className="min-w-0 truncate">{name}</span><RankStars rank={rank} size={size} /></span>;
}
