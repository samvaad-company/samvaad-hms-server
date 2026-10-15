"use client";

import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion, Info } from "lucide-react";
import { api } from "@/lib/api/client";
import type { RxAiReviewDTO, RxAiFinding, RxFindingSeverity } from "@/types/api";

const VERDICT = {
  hold: { label: "Do not dispense as written", icon: ShieldAlert, pill: "bg-[#ffe3e5] text-[#b3001b] border-[#f4a3ac]" },
  review: { label: "Review before dispensing", icon: ShieldQuestion, pill: "bg-[#fff2d6] text-[#8a5300] border-[#f3cf7d]" },
  clear: { label: "No issues found", icon: ShieldCheck, pill: "bg-[#dffff3] text-[#0b7a47] border-[#9fe3c6]" },
} as const;

const SEVERITY_BOX: Record<RxFindingSeverity, string> = {
  critical: "bg-[#ffe3e5] border-[#f4a3ac] text-[#8f0016]",
  warning: "bg-[#fff6dd] border-[#f3cf7d] text-[#8a5300]",
  info: "bg-[color:var(--subtle)] border-[color:var(--line)] text-[color:var(--ink)]",
};
const CARD_BORDER = { hold: "border-[#f4a3ac]", review: "border-[#f3cf7d]", clear: "border-[color:var(--line)]" } as const;

function FindingBox({ f }: { f: RxAiFinding }) {
  return (
    <div className={`rounded-[8px] border px-3 py-[10px] ${SEVERITY_BOX[f.severity]}`}>
      <p className="text-[12px] leading-[16px]">
        <span className="font-medium">{f.category}</span>
        <span className="opacity-80"> · {f.severity}</span>
        {f.medicines.length > 0 && <span className="font-semibold">{"  "}{f.medicines.join("; ")}</span>}
      </p>
      <p className="mt-[3px] text-[13px] leading-[18px]">{f.detail}</p>
      {f.action && <p className="mt-[3px] text-[13px] leading-[18px]">→ {f.action}</p>}
    </div>
  );
}

/**
 * Advisory AI safety review of one prescription. Opens with any stored result
 * for the unchanged prescription (no model call); otherwise waits for the
 * user to ask, since each run sends the prescription to the AI service.
 */
export function AiReviewCard({
  rxId,
  medicineCount,
  onReview,
}: {
  rxId: number;
  medicineCount: number;
  /** Lets the page mark the medicines the review flagged. */
  onReview?: (review: RxAiReviewDTO | null) => void;
}) {
  const [review, setReview] = useState<RxAiReviewDTO | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api.get<RxAiReviewDTO | null>(`/prescriptions/${rxId}/ai-review`)
      .then((r) => { if (live && r) { setReview(r); onReview?.(r); } })
      .catch(() => { /* a missing stored result is not an error — the user can still run the review */ });
    return () => { live = false; };
    // onReview is a page-level setter; re-running on its identity would refetch needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rxId]);

  async function run(refresh: boolean) {
    setRunning(true);
    setError(null);
    try {
      const r = await api.post<RxAiReviewDTO>(`/prescriptions/${rxId}/ai-review`, { refresh });
      setReview(r);
      onReview?.(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The review could not be run.");
    } finally {
      setRunning(false);
    }
  }

  const verdict = review ? VERDICT[review.verdict] : null;

  return (
    <section
      aria-label="AI review"
      className={`rounded-[10px] border bg-[color:var(--surface)] px-4 py-3 ${review ? CARD_BORDER[review.verdict] : "border-[color:var(--line)]"}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Sparkles size={14} className="text-[color:var(--ink)] shrink-0" />
        <span className="text-[13px] font-medium text-[color:var(--ink)]">AI review</span>
        {verdict && (
          <span className={`inline-flex items-center gap-[5px] rounded-full border px-[10px] py-[2px] text-[12px] font-medium ${verdict.pill}`}>
            <verdict.icon size={12} /> {verdict.label}
          </span>
        )}
        {!review && (
          <span className="text-[12px] text-[color:var(--ink-soft)] min-w-0 flex-1 basis-[260px]">
            Interactions, allergies, conditions, dose and duplicates for this patient — with fixes and what to tell them.
          </span>
        )}
        <button
          onClick={() => run(Boolean(review))}
          disabled={running || medicineCount === 0}
          className={`ml-auto inline-flex items-center gap-[6px] h-[30px] rounded-[8px] px-3 text-[12px] font-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            review
              ? "border border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"
              : "bg-[color:var(--brand)] text-white hover:bg-[color:var(--brand-hover)]"
          }`}
        >
          {running ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {running ? "Checking…" : review ? "Re-check" : "Check with AI"}
        </button>
      </div>

      {medicineCount === 0 && !review && (
        <p className="mt-2 text-[12px] text-[color:var(--ink-soft)]">Add at least one medicine to run a review.</p>
      )}
      {error && <p role="alert" className="mt-2 text-[12px] text-[#b3001b]">{error}</p>}

      {review && (
        <div className="mt-3 flex flex-col gap-2">
          {review.mock && review.detail && (
            <div className="flex gap-2 rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] px-3 py-2 text-[12px] text-[color:var(--ink-soft)]">
              <Info size={14} className="shrink-0 mt-[1px]" /> <span>{review.detail}</span>
            </div>
          )}
          <p className="text-[14px] leading-[20px] text-[color:var(--ink)]">{review.summary}</p>
          {review.findings.map((f, i) => <FindingBox key={i} f={f} />)}
          {review.tellPatient.length > 0 && (
            <div className="mt-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">Tell the patient</p>
              <ul className="mt-1 list-disc pl-5 text-[13px] leading-[19px] text-[color:var(--ink)]">
                {review.tellPatient.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-[color:var(--ink-soft)]">
            Checked {review.checked.medicines} {review.checked.medicines === 1 ? "medicine" : "medicines"} against{" "}
            {review.checked.allergies} {review.checked.allergies === 1 ? "allergy" : "allergies"} and {review.checked.conditions}{" "}
            {review.checked.conditions === 1 ? "condition" : "conditions"}
            {review.model && <> · {review.model}</>}
            {review.cached && <> · saved result</>}
            {" · "}advisory only — the prescriber decides
          </p>
        </div>
      )}
    </section>
  );
}
