"use client";

/**
 * The patient's loyalty card, as a card: its colour and stars are the rank's (Basic one star up to VIP five), with the patient's
 * points, how far they are from the next card, and what the card does to their prices.
 */
import { Star, Award, PauseCircle } from "lucide-react";
import { useItem } from "@/lib/api/hooks";
import type { LoyaltyDetailDTO, LoyaltyMemberDTO, LoyaltyProgram, LoyaltyRank } from "@/types/loyalty";

/** Black or white text, whichever reads better on a card of this colour. */
export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#1b1b22" : "#ffffff";
}

/** `filled` stars out of five, in the rank's colour. */
export function Stars({ filled, color, size = 14 }: { filled: number; color: string; size?: number }) {
  return (
    <span className="inline-flex items-center gap-[2px]" role="img" aria-label={`${filled} of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => <Star key={i} size={size} strokeWidth={1.5} style={{ color: i < filled ? color : "var(--line)", fill: i < filled ? color : "transparent" }} />)}
    </span>
  );
}

/** A small "★ Gold" tag for lists. */
export function RankPill({ name, color, stars }: { name: string; color: string; stars?: number }) {
  return (
    <span className="inline-flex items-center gap-[5px] rounded-full border px-[9px] py-[2px] text-[12px] font-medium whitespace-nowrap" style={{ borderColor: color, color: readableOn(color) === "#ffffff" ? color : "var(--ink)", background: `color-mix(in srgb, ${color} 14%, var(--surface))` }}>
      <Star size={12} style={{ color, fill: color }} /> {name}{stars ? <span className="sr-only"> ({stars} stars)</span> : null}
    </span>
  );
}

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function LoyaltyCard({ member, rank, hospitalName }: { member: LoyaltyMemberDTO; rank?: LoyaltyRank; hospitalName?: string }) {
  const ink = readableOn(member.color);
  const soft = ink === "#ffffff" ? "rgba(255,255,255,0.78)" : "rgba(27,27,34,0.7)";
  const inactive = member.status === "Inactive";
  return (
    <div
      className="relative w-full max-w-[380px] shrink-0 overflow-hidden rounded-[16px] p-5 shadow-[0_6px_20px_rgba(0,0,0,0.18)]"
      style={{ background: `linear-gradient(135deg, ${member.color}, color-mix(in srgb, ${member.color} 62%, #000))`, color: ink }}
    >
      <Award aria-hidden size={150} strokeWidth={1} className="pointer-events-none absolute -right-8 -top-6 opacity-[0.12]" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] uppercase tracking-[0.14em]" style={{ color: soft }}>{hospitalName || "Loyalty card"}</p>
          <p className="mt-[2px] text-[22px] font-semibold leading-7">{member.rankName}</p>
          <p className="text-[12px]" style={{ color: soft }}>{member.tagline}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-[3px]" role="img" aria-label={`${member.stars} of 5 stars`}>
          {Array.from({ length: 5 }, (_, i) => <Star key={i} size={15} strokeWidth={1.5} style={{ color: ink, fill: i < member.stars ? ink : "transparent", opacity: i < member.stars ? 1 : 0.35 }} />)}
        </span>
      </div>
      <div className="relative mt-5">
        <p className="truncate text-[17px] font-medium">{member.name}</p>
        <p className="font-mono text-[12px] tracking-wider" style={{ color: soft }}>{member.cardNo}</p>
      </div>
      <div className="relative mt-4">
        <div className="flex items-baseline justify-between gap-2 text-[12px]">
          <span><b className="text-[20px] font-semibold">{member.points}</b> points</span>
          <span style={{ color: soft }}>{member.next ? `${member.next.pointsNeeded} more for ${member.next.name}` : "Highest card"}</span>
        </div>
        <div className="mt-[6px] h-[6px] rounded-full" style={{ background: ink === "#ffffff" ? "rgba(255,255,255,0.28)" : "rgba(27,27,34,0.18)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.max(4, member.progress)}%`, background: ink }} />
        </div>
      </div>
      {rank && (
        <p className="relative mt-4 text-[12px] leading-[17px]" style={{ color: soft }}>
          OPD {money(rank.opdFee)} · Emergency {money(rank.erFee)} · Lab {rank.discounts.lab}% · Pharmacy {rank.discounts.pharmacy}% · Radiology {rank.discounts.radiology}% · IPD {rank.discounts.ipd}% off
        </p>
      )}
      {inactive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-[6px] text-[13px] font-medium text-[#b4000a]"><PauseCircle size={15} /> Inactive: no visit for a while</span>
        </div>
      )}
    </div>
  );
}

/** The card for one patient, loaded from the API: the programme's prices and the patient's points. Shows nothing if the programme is off. */
export function LoyaltyCardPanel({ patientId }: { patientId: number }) {
  const { item: member } = useItem<LoyaltyDetailDTO>(`/loyalty/members/${patientId}`);
  const { item: program } = useItem<LoyaltyProgram>("/loyalty/program");
  if (!member || !program || !program.enabled) return null;
  const rank = program.ranks.find((r) => r.key === member.rankKey);
  return (
    <div className="flex flex-wrap items-start gap-4 rounded-[12px] border border-[color:var(--line)] p-4">
      <LoyaltyCard member={member} rank={rank} />
      <div className="min-w-[240px] flex-1">
        <p className="text-[14px] font-medium text-[color:var(--ink)]">Loyalty card</p>
        <p className="mt-1 text-[12px] text-[color:var(--ink-soft)]">Everyone starts on Basic and moves up as points are earned. The card sets this patient&apos;s prices when billing.</p>
        <ul className="mt-3 flex flex-col gap-[6px] text-[13px]">
          {member.breakdown.map((l) => (
            <li key={l.key} className="flex items-baseline justify-between gap-3"><span className="text-[color:var(--ink)]">{l.label} <span className="text-[12px] text-[color:var(--ink-soft)]">· {l.detail}</span></span><span className="font-mono text-[12px]">{l.points >= 0 ? "+" : ""}{l.points}</span></li>
          ))}
        </ul>
        {rank && rank.benefits.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-[6px]">{rank.benefits.map((b) => <span key={b} className="rounded-full bg-[color:var(--subtle)] px-[9px] py-[2px] text-[11px] text-[color:var(--ink-soft)]">{b}</span>)}</div>
        )}
      </div>
    </div>
  );
}
