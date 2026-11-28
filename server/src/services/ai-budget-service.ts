/**
 * What the hospital's AI features cost, and the caps that keep it from running away.
 *
 * Every Gemini call outside KAYA chat (the consultation scribe, prescription review and the WhatsApp bot) writes its token use to a
 * ledger with a rupee cost worked out from the Gemini rates in Settings. Each of those features has a monthly rupee budget: when it is
 * used up the feature falls back to its no-AI behaviour (the scribe says so, the review runs only the built-in checks, the bot sends its
 * menu) instead of spending more. The WhatsApp bot also has a limit of AI replies per number per day, so one number cannot drain the
 * budget. KAYA chat keeps its own per-person token allowance (ai-quota-service.ts); its cost is shown here too.
 *
 * A budget of 0 means "no cap". The monthly cost view adds what the other paid services cost (WhatsApp templates, Razorpay fees, and
 * the hosting and database costs an admin types in) so the whole month is on one page.
 */
import { aiFeatureUsageRepo, aiTokenUsageRepo, whatsappMessagesRepo, teleconsultPaymentsRepo } from "@/repositories";
import type { AiFeatureUsageRow, AiTokenUsageRow, TeleconsultPaymentRow, WhatsappMessageRow } from "@/db/tables";
import { type Session } from "@/auth/session";
import { ForbiddenError } from "@/lib/errors";
import { localDate } from "@/lib/clock";
import { hospitalConfig } from "@/services/setup-service";
import { requireHospitalId } from "@/services/hospital-scope";
import type { AiCostDTO, AiCostLineDTO } from "@shared/types/api";

export type AiFeature = "scribe" | "rx_review" | "whatsapp_bot";

export interface TokenUsage { prompt: number; output: number; audio: number }

const MANAGER_ROLES = new Set(["Super Admin", "IT Admin"]);
const num = (v: unknown, fallback = 0): number => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
const money = (n: number) => Math.round(n * 100) / 100;
/** A single call can cost a fraction of a paisa, so the ledger keeps six decimals and only the screens round to paise. */
const fine = (n: number) => Math.round(n * 1_000_000) / 1_000_000;
const month = (d: Date = new Date()) => localDate(d).slice(0, 7);

export const FEATURE_LABEL: Record<AiFeature, string> = { scribe: "Consultation scribe", rx_review: "Prescription AI review", whatsapp_bot: "WhatsApp bot (AI replies)" };
const BUDGET_KEY: Record<AiFeature, string> = { scribe: "scribeBudgetInr", rx_review: "rxReviewBudgetInr", whatsapp_bot: "botBudgetInr" };

/** Reads the token counts out of a Gemini response (`usageMetadata`); audio input is split out because it is priced differently. */
export function readUsage(json: unknown): TokenUsage {
  const u = (json as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; promptTokensDetails?: { modality?: string; tokenCount?: number }[] } } | null)?.usageMetadata;
  if (!u) return { prompt: 0, output: 0, audio: 0 };
  const audio = (u.promptTokensDetails ?? []).filter((d) => String(d.modality).toUpperCase() === "AUDIO").reduce((n, d) => n + num(d.tokenCount), 0);
  const prompt = Math.max(0, num(u.promptTokenCount) - audio);
  return { prompt, output: num(u.candidatesTokenCount) + num(u.thoughtsTokenCount), audio };
}

type Cfg = Record<string, unknown>;

/** Rupees for a number of tokens, from the Gemini rates in Settings (dollars per million tokens). */
export function costInr(cfg: Cfg, t: TokenUsage): number {
  const usd = (t.prompt * num(cfg.geminiInputUsdPerMillion, 0.25) + t.output * num(cfg.geminiOutputUsdPerMillion, 1.5) + t.audio * num(cfg.geminiAudioUsdPerMillion, 0.5)) / 1_000_000;
  return fine(usd * num(cfg.usdToInr, 88));
}

async function rowsOf(hospitalId: number, feature: AiFeature, m: string): Promise<AiFeatureUsageRow[]> {
  const { rows } = await aiFeatureUsageRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: hospitalId }, { column: "feature", op: "eq", value: feature }, { column: "month", op: "eq", value: m }] } as never);
  return rows as AiFeatureUsageRow[];
}

export interface BudgetState { budget: number; spent: number; exceeded: boolean }

/** This month's spend on a feature against its budget (0 = no cap). */
export async function budgetState(hospitalId: number | null | undefined, feature: AiFeature): Promise<BudgetState> {
  if (hospitalId == null) return { budget: 0, spent: 0, exceeded: false };
  const cfg = await hospitalConfig("ai_budget", hospitalId);
  const budget = Math.max(0, num(cfg[BUDGET_KEY[feature]]));
  const spent = fine((await rowsOf(hospitalId, feature, month())).reduce((n, r) => n + num(r.cost_inr), 0));
  return { budget, spent, exceeded: budget > 0 && spent >= budget };
}

export const budgetMessage = (feature: AiFeature, s: BudgetState) =>
  `The monthly AI budget for the ${FEATURE_LABEL[feature].toLowerCase()} (₹${s.budget.toLocaleString("en-IN")}) is used up, so it is paused until next month. An administrator can raise it under KAYA AI → Spending caps.`;

/** Write one call's token use and rupee cost to the ledger. Never throws: a ledger hiccup must not break the feature. */
export async function recordFeatureUsage(o: { hospitalId: number | null | undefined; feature: AiFeature; usage: TokenUsage; userId?: number | null; userName?: string; ref?: string }): Promise<void> {
  try {
    if (o.hospitalId == null) return;
    const total = o.usage.prompt + o.usage.output + o.usage.audio;
    if (total <= 0) return;
    const cfg = await hospitalConfig("ai_budget", o.hospitalId);
    await aiFeatureUsageRepo.create({
      hospital_id: o.hospitalId, feature: o.feature, user_id: o.userId ?? null, user_name: o.userName ?? "", ref: o.ref ?? "",
      prompt_tokens: o.usage.prompt, output_tokens: o.usage.output, audio_tokens: o.usage.audio, total_tokens: total, cost_inr: costInr(cfg, o.usage), month: month(),
    } as never);
  } catch { /* the feature already worked; only the books are missing a line */ }
}

/** WhatsApp bot: may this number get another AI reply today, and is the bot's budget still there? */
export async function botAiAllowed(hospitalId: number, phone: string): Promise<{ ok: boolean; why?: "budget" | "daily" }> {
  const s = await budgetState(hospitalId, "whatsapp_bot");
  if (s.exceeded) return { ok: false, why: "budget" };
  const cfg = await hospitalConfig("ai_budget", hospitalId);
  const cap = Math.max(0, num(cfg.botRepliesPerNumberPerDay, 20));
  if (cap > 0) {
    const today = localDate();
    const used = (await rowsOf(hospitalId, "whatsapp_bot", month())).filter((r) => r.ref === phone && localDate(new Date(r.created_at)) === today).length;
    if (used >= cap) return { ok: false, why: "daily" };
  }
  return { ok: true };
}

// ── The monthly cost view ────────────────────────────────────────────────────

export async function costReport(rawMonth: unknown, actor: Session): Promise<AiCostDTO> {
  if (!MANAGER_ROLES.has(actor.role)) throw new ForbiddenError("Only a super admin or admin can see the cost view.");
  const hospitalId = requireHospitalId(actor);
  const m = typeof rawMonth === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : month();
  const cfg = await hospitalConfig("ai_budget", hospitalId);
  const inMonth = (iso: string | null | undefined) => String(iso ?? "").slice(0, 7) === m;
  const lines: AiCostLineDTO[] = [];

  // KAYA chat: tokens from its per-person ledger, priced at the same rates.
  const chat = ((await aiTokenUsageRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: hospitalId }, { column: "month", op: "eq", value: m }] } as never)).rows as AiTokenUsageRow[]);
  const chatTokens = chat.reduce((n, r) => ({ prompt: n.prompt + num(r.prompt_tokens), output: n.output + num(r.output_tokens), audio: 0 }), { prompt: 0, output: 0, audio: 0 });
  lines.push({ key: "chat", label: "KAYA chat (Gemini)", kind: "measured", amountInr: costInr(cfg, chatTokens), detail: `${chat.length} answers · ${(chatTokens.prompt + chatTokens.output).toLocaleString("en-IN")} tokens. Each person has a monthly token allowance.`, budgetInr: null, capped: false });

  for (const feature of ["scribe", "rx_review", "whatsapp_bot"] as const) {
    const rows = await rowsOf(hospitalId, feature, m);
    const spent = money(rows.reduce((n, r) => n + num(r.cost_inr), 0));
    const tokens = rows.reduce((n, r) => n + num(r.total_tokens), 0);
    const budget = Math.max(0, num(cfg[BUDGET_KEY[feature]]));
    lines.push({ key: feature, label: `${FEATURE_LABEL[feature]} (Gemini)`, kind: "measured", amountInr: spent, detail: `${rows.length} calls · ${tokens.toLocaleString("en-IN")} tokens`, budgetInr: budget > 0 ? budget : null, capped: budget > 0 && spent >= budget });
  }

  // WhatsApp: only template messages (consent links) are charged by Meta; replies inside the 24-hour window are not.
  const wa = ((await whatsappMessagesRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: hospitalId }, { column: "direction", op: "eq", value: "out" }] } as never)).rows as WhatsappMessageRow[]).filter((r) => r.kind === "consent" && r.status !== "failed" && inMonth(r.created_at));
  const gst = 1 + num(cfg.gstPercent, 18) / 100;
  lines.push({ key: "whatsapp", label: "WhatsApp template messages (Meta)", kind: "estimated", amountInr: money(wa.length * num(cfg.whatsappUtilityInr, 0.115) * gst), detail: `${wa.length} consent-link templates × ₹${num(cfg.whatsappUtilityInr, 0.115)} + GST. Bot replies inside 24 hours are free.`, budgetInr: null, capped: false });

  // Razorpay: its fee on every captured video-consultation payment.
  const pays = ((await teleconsultPaymentsRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: hospitalId }] } as never)).rows as TeleconsultPaymentRow[]).filter((p) => p.mode === "razorpay" && p.status === "captured" && inMonth(p.created_at));
  const collected = pays.reduce((n, p) => n + num(p.amount), 0);
  lines.push({ key: "razorpay", label: "Razorpay fees (video consultations)", kind: "estimated", amountInr: money(collected * (num(cfg.razorpayFeePercent, 2) / 100) * gst), detail: `₹${Math.round(collected).toLocaleString("en-IN")} collected online × ${num(cfg.razorpayFeePercent, 2)}% + GST`, budgetInr: null, capped: false });

  // What an admin types in: bills that arrive from the host and the database provider.
  for (const [key, label, field] of [["hosting", "Hosting (servers)", "hostingMonthlyInr"], ["database", "Database (MongoDB Atlas)", "databaseMonthlyInr"], ["other", "Other (domain, storage, tools)", "otherMonthlyInr"]] as const) {
    lines.push({ key, label, kind: "entered", amountInr: money(num(cfg[field])), detail: "Entered by you under Spending caps", budgetInr: null, capped: false });
  }
  return { month: m, totalInr: money(lines.reduce((n, l) => n + l.amountInr, 0)), usdToInr: num(cfg.usdToInr, 88), lines };
}
