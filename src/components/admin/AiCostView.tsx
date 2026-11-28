"use client";

/**
 * KAYA AI → Cost & caps. The month's bill on one page (Gemini by feature, WhatsApp templates, Razorpay fees, and the hosting and database
 * bills an admin types in) and the caps that stop the Gemini features spending past a monthly rupee budget.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import type { AiCostDTO, AiCostLineDTO } from "@/types/api";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: n < 100 ? 2 : 0 })}`;
const monthLabel = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

const KIND: Record<AiCostLineDTO["kind"], { label: string; cls: string }> = {
  measured: { label: "Measured", cls: "bg-[#dffff3] text-[#00955c]" },
  estimated: { label: "Estimated", cls: "bg-[#fff2e0] text-[#c26a00]" },
  entered: { label: "You entered", cls: "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]" },
};

interface Caps {
  scribeBudgetInr: number; rxReviewBudgetInr: number; botBudgetInr: number; botRepliesPerNumberPerDay: number;
  geminiInputUsdPerMillion: number; geminiOutputUsdPerMillion: number; geminiAudioUsdPerMillion: number; usdToInr: number;
  whatsappUtilityInr: number; razorpayFeePercent: number; gstPercent: number;
  hostingMonthlyInr: number; databaseMonthlyInr: number; otherMonthlyInr: number;
}

const GROUPS: { title: string; hint: string; fields: { key: keyof Caps; label: string; suffix: string }[] }[] = [
  { title: "Spending caps", hint: "When a feature's budget for the month is used up it stops calling Gemini until next month. 0 means no cap.", fields: [
    { key: "scribeBudgetInr", label: "Consultation scribe", suffix: "₹ / month" },
    { key: "rxReviewBudgetInr", label: "Prescription AI review", suffix: "₹ / month" },
    { key: "botBudgetInr", label: "WhatsApp bot AI replies", suffix: "₹ / month" },
    { key: "botRepliesPerNumberPerDay", label: "AI replies per patient number", suffix: "per day (0 = no limit)" },
  ] },
  { title: "Your bills", hint: "Typed in from the host and database invoices so the total covers the whole month.", fields: [
    { key: "hostingMonthlyInr", label: "Hosting (servers)", suffix: "₹ / month" },
    { key: "databaseMonthlyInr", label: "Database (MongoDB Atlas)", suffix: "₹ / month" },
    { key: "otherMonthlyInr", label: "Other (domain, storage, tools)", suffix: "₹ / month" },
  ] },
  { title: "Rates used for the costs", hint: "Check these against the providers' price pages; the cost view is only as good as these numbers.", fields: [
    { key: "geminiInputUsdPerMillion", label: "Gemini text input", suffix: "$ per million tokens" },
    { key: "geminiOutputUsdPerMillion", label: "Gemini output", suffix: "$ per million tokens" },
    { key: "geminiAudioUsdPerMillion", label: "Gemini audio input", suffix: "$ per million tokens" },
    { key: "usdToInr", label: "Dollar rate", suffix: "₹ per $" },
    { key: "whatsappUtilityInr", label: "WhatsApp template message", suffix: "₹ each, before GST" },
    { key: "razorpayFeePercent", label: "Razorpay fee", suffix: "% of each payment, before GST" },
    { key: "gstPercent", label: "GST on those fees", suffix: "%" },
  ] },
];

export function AiCostView() {
  const [month, setMonth] = useState<string | undefined>(undefined);
  const { item: cost, reload, error } = useItem<AiCostDTO>(`/admin/ai-usage/cost${month ? `?month=${month}` : ""}`);
  const { item: caps, reload: reloadCaps } = useItem<Caps>("/setup/config/ai_budget");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const { run, loading, error: saveError } = useMutation();
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (caps) setDraft(Object.fromEntries(Object.entries(caps).map(([k, v]) => [k, String(v)]))); }, [caps]);

  const months = (() => {
    const out: string[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }
    return out;
  })();

  async function save() {
    setSaved(false);
    const patch = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Number(v) || 0]));
    try { await run(() => api.put("/setup/config/ai_budget", patch)); setSaved(true); reloadCaps(); reload(); } catch { /* the message shows below */ }
  }
  const input = "h-[34px] w-[110px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] px-2 text-right text-[13px] focus:border-[color:var(--brand)] focus:outline-none";

  if (error) return <p className="text-[13px] text-[#b3001b]">{error.message}</p>;
  if (!cost) return <p className="py-8 text-center text-[13px] text-[color:var(--ink-soft)]"><Loader2 size={14} className="mr-2 inline animate-spin" />Loading the cost view…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] text-[color:var(--ink-soft)]">{monthLabel(cost.month)}</p>
          <p className="text-[28px] font-medium leading-9 text-[color:var(--ink)]">{inr(cost.totalInr)}</p>
          <p className="text-[12px] text-[color:var(--ink-soft)]">in total. Measured lines come from what was used here; estimated lines are counted here and priced at the rates below.</p>
        </div>
        <select value={cost.month} onChange={(e) => setMonth(e.target.value === months[0] ? undefined : e.target.value)} aria-label="Month" className="h-[34px] rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px]">
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-[color:var(--line)]">
        {cost.lines.map((l) => (
          <div key={l.key} className="flex flex-wrap items-center gap-3 border-b border-[color:var(--subtle-2)] px-4 py-3 text-[13px] last:border-0">
            <div className="min-w-[220px] flex-1">
              <p className="font-medium text-[color:var(--ink)]">{l.label}</p>
              <p className="text-[12px] text-[color:var(--ink-soft)]">{l.detail}</p>
            </div>
            <span className={`rounded-full px-2 py-[2px] text-[11px] ${KIND[l.kind].cls}`}>{KIND[l.kind].label}</span>
            {l.budgetInr != null && (
              <span className="w-[210px] text-[12px]">
                <span className="block h-[6px] overflow-hidden rounded-full bg-[color:var(--subtle-2)]"><span className={`block h-full ${l.capped ? "bg-[#d4000a]" : l.amountInr / l.budgetInr > 0.8 ? "bg-[#c26a00]" : "bg-[#00955c]"}`} style={{ width: `${Math.min(100, (l.amountInr / l.budgetInr) * 100)}%` }} /></span>
                <span className={l.capped ? "text-[#d4000a]" : "text-[color:var(--ink-soft)]"}>{l.capped ? `Cap reached — paused (${inr(l.budgetInr)})` : `of ${inr(l.budgetInr)} cap`}</span>
              </span>
            )}
            <span className="w-[100px] text-right text-[14px] font-medium text-[color:var(--ink)]">{inr(l.amountInr)}</span>
          </div>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="flex flex-col gap-5">
        {GROUPS.map((g) => (
          <section key={g.title} className="rounded-[10px] border border-[color:var(--line)] p-4">
            <h3 className="text-[14px] font-semibold text-[color:var(--ink)]">{g.title}</h3>
            <p className="mb-3 text-[12px] text-[color:var(--ink-soft)]">{g.hint}</p>
            <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
              {g.fields.map((f) => (
                <label key={f.key} className="flex items-center gap-3 text-[13px] text-[color:var(--ink)]">
                  <span className="min-w-0 flex-1">{f.label}</span>
                  <input inputMode="decimal" value={draft[f.key] ?? ""} onChange={(e) => { setSaved(false); setDraft((d) => ({ ...d, [f.key]: e.target.value.replace(/[^0-9.]/g, "") })); }} className={input} />
                  <span className="w-[150px] text-[11px] text-[color:var(--ink-soft)]">{f.suffix}</span>
                </label>
              ))}
            </div>
          </section>
        ))}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading} className="inline-flex h-[36px] cursor-pointer items-center gap-2 rounded-full bg-[color:var(--brand)] px-5 text-[13px] font-medium text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50">{loading ? "Saving…" : "Save caps and rates"}</button>
          {saved && <span className="text-[13px] text-[#00955c]">Saved.</span>}
          {saveError && <span className="text-[13px] text-[#b3001b]">{saveError.message}</span>}
        </div>
      </form>
    </div>
  );
}
