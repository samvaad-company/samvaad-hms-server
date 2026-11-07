"use client";

/**
 * Setup → Masters → Loyalty programme: the five cards (their names, star colours, the points each needs, the OPD and emergency
 * fee, the lab/pharmacy/radiology/IPD discounts and the benefits each includes), the rules that turn a patient's history into
 * points, and when a card goes inactive. Changes apply to billing and to every patient's card straight away.
 */
import { useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import { Stars } from "@/components/loyalty/LoyaltyCard";
import { DEFAULT_PROGRAM, type LoyaltyProgram, type LoyaltyRank, type LoyaltyRule, type LoyaltyScoring } from "@/types/loyalty";

const field = "h-[36px] w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] disabled:opacity-60";

function Num({ label, value, onChange, prefix, suffix, disabled, hint }: { label: string; value: number; onChange: (n: number) => void; prefix?: string; suffix?: string; disabled?: boolean; hint?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-[4px]">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">{label}</span>
      <span className="relative">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[color:var(--ink-soft)]">{prefix}</span>}
        <input type="number" min={0} value={Number.isFinite(value) ? value : 0} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} className={`${field} ${prefix ? "pl-7" : ""} ${suffix ? "pr-8" : ""}`} />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[color:var(--ink-soft)]">{suffix}</span>}
      </span>
      {hint && <span className="text-[11px] text-[color:var(--ink-soft)]">{hint}</span>}
    </label>
  );
}

/** "gold.minPoints" → "Gold · points needed", for the messages under the Save button. */
const FIELD_NAMES: Record<string, string> = { minPoints: "points needed", opdFee: "OPD fee", erFee: "emergency fee", lab: "lab discount", pharmacy: "pharmacy discount", radiology: "radiology discount", ipd: "IPD discount", name: "card name", color: "colour", points: "points each", max: "most they can earn", inactiveMonths: "inactive months" };
function friendly(field: string): string {
  const [first, rest] = field.split(".");
  const card = RANK_NAMES[first];
  if (card) return `${card} · ${FIELD_NAMES[rest] ?? rest}`;
  return rest ? `${first.replace("per", "").toLowerCase()} · ${FIELD_NAMES[rest] ?? rest}` : FIELD_NAMES[first] ?? first;
}
const RANK_NAMES: Record<string, string> = { basic: "Basic", silver: "Silver", gold: "Gold", platinum: "Platinum", vip: "VIP" };

const RULES: { key: keyof Omit<LoyaltyScoring, "inactiveMonths">; label: string; per: string }[] = [
  { key: "perYear", label: "Years with the hospital", per: "per completed year since the first OPD visit" },
  { key: "perVisit", label: "Visits", per: "per day they came in the last 12 months" },
  { key: "perFamilyMember", label: "Family members", per: "per family member linked on an appointment" },
  { key: "perReferral", label: "Referrals", per: "per patient they referred" },
  { key: "perFollowUp", label: "Follow-ups kept", per: "per follow-up they came back for" },
];

export function LoyaltyProgramView() {
  const { item, reload } = useItem<LoyaltyProgram>("/loyalty/program");
  const { run, loading, error } = useMutation();
  const [draft, setDraft] = useState<LoyaltyProgram | null>(null);
  const [saved, setSaved] = useState(false);
  if (item && !draft) setDraft(structuredClone(item));
  if (!draft) return <p className="py-10 text-[14px] text-[color:var(--ink-soft)]">Loading…</p>;

  const patchRank = (key: string, patch: Partial<LoyaltyRank>) => { setSaved(false); setDraft({ ...draft, ranks: draft.ranks.map((r) => (r.key === key ? { ...r, ...patch } : r)) }); };
  const patchRule = (key: keyof Omit<LoyaltyScoring, "inactiveMonths">, patch: Partial<LoyaltyRule>) => { setSaved(false); setDraft({ ...draft, scoring: { ...draft.scoring, [key]: { ...draft.scoring[key], ...patch } } }); };
  const toggleBenefit = (key: string, b: string) => {
    const r = draft.ranks.find((x) => x.key === key)!;
    patchRank(key, { benefits: r.benefits.includes(b) ? r.benefits.filter((x) => x !== b) : [...r.benefits, b] });
  };

  async function save() {
    await run(async () => { const next = await api.put<LoyaltyProgram>("/loyalty/program", draft); setDraft(structuredClone(next)); });
    setSaved(true);
    reload();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-[color:var(--ink-soft)]">Cards, prices, colours and the rules that earn points. Everyone starts on Basic; a card is held at the points it needs.</p>
        </div>
        <label className="ml-auto flex items-center gap-2 text-[13px]"><input type="checkbox" checked={draft.enabled} onChange={(e) => { setSaved(false); setDraft({ ...draft, enabled: e.target.checked }); }} className="h-4 w-4 accent-[color:var(--brand)]" /> Programme is on</label>
        <button onClick={() => { setSaved(false); setDraft(structuredClone(DEFAULT_PROGRAM)); }} className="inline-flex h-[34px] items-center gap-1 rounded-full border border-[color:var(--line)] px-4 text-[13px] hover:bg-[color:var(--subtle)] cursor-pointer"><RotateCcw size={13} /> Reset to the standard</button>
        <button onClick={save} disabled={loading} className="inline-flex h-[34px] items-center gap-1 rounded-full bg-[color:var(--brand)] px-5 text-[13px] text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer"><Save size={13} /> {loading ? "Saving…" : "Save"}</button>
      </div>
      {error && (
        <div role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">
          <p>Not saved. {Object.keys(error.fieldErrors).length ? "Please fix:" : error.message}</p>
          {Object.keys(error.fieldErrors).length > 0 && <ul className="mt-1 list-disc pl-5">{Object.entries(error.fieldErrors).map(([f, m]) => <li key={f}>{friendly(f)}: {m}</li>)}</ul>}
        </div>
      )}
      {saved && !error && <p role="status" className="rounded-[8px] bg-[#dffff3] px-3 py-2 text-[13px] text-[#0b7a47]">Saved. Billing and every patient&apos;s card now use these.</p>}

      {draft.ranks.map((r, i) => (
        <section key={r.key} className="rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface)]" style={{ borderTopColor: r.color, borderTopWidth: 3 }}>
          <header className="flex flex-wrap items-center gap-3 border-b border-[color:var(--line)] px-4 py-3">
            <Stars filled={i + 1} color={r.color} size={15} />
            <h3 className="text-[15px] font-semibold">{r.name || "Card"}</h3>
            <span className="text-[12px] text-[color:var(--ink-soft)]">{r.tagline}</span>
          </header>
          <div className="flex flex-col gap-4 p-4">
            <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
              <label className="flex flex-col gap-[4px]"><span className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">Card name</span><input value={r.name} onChange={(e) => patchRank(r.key, { name: e.target.value })} className={field} maxLength={30} /></label>
              <label className="flex flex-col gap-[4px]"><span className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">Who it is for</span><input value={r.tagline} onChange={(e) => patchRank(r.key, { tagline: e.target.value })} className={field} maxLength={60} /></label>
              <label className="flex flex-col gap-[4px]">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">Star colour</span>
                <span className="flex items-center gap-2"><input type="color" value={r.color} onChange={(e) => patchRank(r.key, { color: e.target.value })} aria-label={`${r.name} colour`} className="h-[36px] w-[44px] cursor-pointer rounded-[8px] border border-[color:var(--line)] bg-transparent p-[2px]" /><input value={r.color} onChange={(e) => patchRank(r.key, { color: e.target.value })} className={`${field} font-mono`} maxLength={7} /></span>
              </label>
              <Num label="Points needed" value={r.minPoints} disabled={i === 0} onChange={(n) => patchRank(r.key, { minPoints: n })} hint={i === 0 ? "Everyone starts here" : undefined} />
            </div>
            <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(105px,1fr))]">
              <Num label="OPD fee" prefix="₹" value={r.opdFee} onChange={(n) => patchRank(r.key, { opdFee: n })} />
              <Num label="Emergency fee" prefix="₹" value={r.erFee} onChange={(n) => patchRank(r.key, { erFee: n })} />
              <Num label="Lab" suffix="%" value={r.discounts.lab} onChange={(n) => patchRank(r.key, { discounts: { ...r.discounts, lab: n } })} />
              <Num label="Pharmacy" suffix="%" value={r.discounts.pharmacy} onChange={(n) => patchRank(r.key, { discounts: { ...r.discounts, pharmacy: n } })} />
              <Num label="Radiology" suffix="%" value={r.discounts.radiology} onChange={(n) => patchRank(r.key, { discounts: { ...r.discounts, radiology: n } })} />
              <Num label="IPD" suffix="%" value={r.discounts.ipd} onChange={(n) => patchRank(r.key, { discounts: { ...r.discounts, ipd: n } })} />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">Benefits this card includes</p>
              <div className="flex flex-wrap gap-2">
                {draft.benefitCatalogue.map((b) => {
                  const on = r.benefits.includes(b);
                  return <button key={b} type="button" aria-pressed={on} onClick={() => toggleBenefit(r.key, b)} className={`rounded-full border px-3 py-[4px] text-[12px] cursor-pointer ${on ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--brand)]" : "border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]"}`}>{b}</button>;
                })}
              </div>
            </div>
          </div>
        </section>
      ))}

      <section className="rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface)]">
        <header className="border-b border-[color:var(--line)] px-4 py-3"><h3 className="text-[15px] font-semibold">How points are earned</h3><p className="text-[12px] text-[color:var(--ink-soft)]">Worked out from the hospital&apos;s own records. Points you add by hand on the Loyalty screen come on top.</p></header>
        <div className="flex flex-col gap-3 p-4">
          {RULES.map((rule) => (
            <div key={rule.key} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1 basis-[200px]"><p className="text-[13px] font-medium">{rule.label}</p><p className="text-[12px] text-[color:var(--ink-soft)]">{rule.per}</p></div>
              <div className="w-[130px]"><Num label="Points each" value={draft.scoring[rule.key].points} onChange={(n) => patchRule(rule.key, { points: n })} /></div>
              <div className="w-[130px]"><Num label="Most they can earn" value={draft.scoring[rule.key].max} onChange={(n) => patchRule(rule.key, { max: n })} /></div>
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-3 border-t border-[color:var(--line)] pt-3">
            <div className="min-w-[200px] flex-1 basis-[200px]"><p className="text-[13px] font-medium">Inactive card</p><p className="text-[12px] text-[color:var(--ink-soft)]">A card with no visit or bill for this long gives no benefits until the patient is back.</p></div>
            <div className="w-[130px]"><Num label="Months" value={draft.scoring.inactiveMonths} onChange={(n) => { setSaved(false); setDraft({ ...draft, scoring: { ...draft.scoring, inactiveMonths: n } }); }} /></div>
          </div>
        </div>
      </section>

      <section className="rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface)]">
        <header className="border-b border-[color:var(--line)] px-4 py-3"><h3 className="text-[15px] font-semibold">Benefit list</h3><p className="text-[12px] text-[color:var(--ink-soft)]">One benefit per line. Each card above ticks the ones it includes.</p></header>
        <div className="p-4">
          <textarea rows={8} value={draft.benefitCatalogue.join("\n")} onChange={(e) => { setSaved(false); const list = e.target.value.split("\n"); setDraft({ ...draft, benefitCatalogue: list, ranks: draft.ranks.map((r) => ({ ...r, benefits: r.benefits.filter((b) => list.includes(b)) })) }); }}
            className="w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--brand)]" aria-label="Benefit list" />
        </div>
      </section>
    </div>
  );
}
