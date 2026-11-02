/**
 * AI token quota: every answer's tokens are written to a ledger, each person has a monthly allowance, and a super admin
 * sets the limits and can give extra tokens to anyone who runs out. The allowance renews by itself on the 1st: usage is
 * counted per calendar month (hospital time), so a new month simply starts from zero.
 *
 * A person's limit for a month = their own limit, else the hospital default, else the platform default,
 * plus any extra tokens granted to them for that month. Super admins are not limited (they are still recorded).
 */
import { aiTokenUsageRepo, aiTokenLimitsRepo, aiTokenGrantsRepo, usersRepo } from "@/repositories";
import type { AiTokenUsageRow, AiTokenLimitRow, AiTokenGrantRow, UserRow } from "@/db/tables";
import { type Session } from "@/auth/session";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { audit } from "@/services/audit";
import { requireHospitalId, scopeToHospital } from "@/services/hospital-scope";
import { localDate } from "@/lib/clock";
import type { AiQuotaDTO, AiUsageDTO, AiUsageStatus, AiUsageUserDTO } from "@shared/types/api";

/** Tokens each person gets a month until a super admin sets something else. */
export const PLATFORM_DEFAULT_MONTHLY_TOKENS = Number(process.env.AI_DEFAULT_MONTHLY_TOKENS) || 200_000;
/** Shown as "running low" from this share of the limit. */
const NEAR_SHARE = 0.8;

const UNLIMITED_ROLES = new Set(["Super Admin", "Platform Admin"]);
/** Who sees the AI section and may set limits, pause people and give extra tokens. */
const MANAGER_ROLES = new Set(["Super Admin", "IT Admin"]);
export const isUnlimited = (actor: Pick<Session, "role">): boolean => UNLIMITED_ROLES.has(actor.role);

export const monthOf = (d: Date = new Date()): string => localDate(d).slice(0, 7);

/** First day of the month after `month` ("2026-11" → "2026-12-01"). */
export function renewsOn(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

const hospitalFilter = (hospitalId: number | null) => ({ column: "hospital_id", op: hospitalId == null ? ("is" as const) : ("eq" as const), value: hospitalId });

function assertManager(actor: Session): void {
  if (!MANAGER_ROLES.has(actor.role)) throw new ForbiddenError("Only a super admin or admin can manage AI usage.");
}

// ── Limits ───────────────────────────────────────────────────────────────────

async function limitRows(hospitalId: number | null): Promise<AiTokenLimitRow[]> {
  return (await aiTokenLimitsRepo.listRows({ filters: [hospitalFilter(hospitalId)], unpaged: true })).rows;
}

async function grantRows(hospitalId: number | null, month: string, userId?: number): Promise<AiTokenGrantRow[]> {
  return (
    await aiTokenGrantsRepo.listRows({
      filters: [hospitalFilter(hospitalId), { column: "month", op: "eq", value: month }, ...(userId != null ? [{ column: "user_id", op: "eq" as const, value: userId }] : [])],
      unpaged: true,
    })
  ).rows;
}

async function usageRows(hospitalId: number | null, month: string, userId?: number): Promise<AiTokenUsageRow[]> {
  return (
    await aiTokenUsageRepo.listRows({
      filters: [hospitalFilter(hospitalId), { column: "month", op: "eq", value: month }, ...(userId != null ? [{ column: "user_id", op: "eq" as const, value: userId }] : [])],
      unpaged: true,
    })
  ).rows;
}

const sum = (rows: { total_tokens?: number; tokens?: number }[], key: "total_tokens" | "tokens"): number => rows.reduce((n, r) => n + Number(r[key] ?? 0), 0);

// ── The signed-in person's allowance ─────────────────────────────────────────

export async function getQuota(actor: Session): Promise<AiQuotaDTO> {
  const month = monthOf();
  const used = sum(await usageRows(actor.hospitalId, month, actor.userId), "total_tokens");
  if (isUnlimited(actor)) return { month, blocked: false, used, limit: null, remaining: null, exceeded: false, renewsOn: renewsOn(month) };
  const [limits, grants] = await Promise.all([limitRows(actor.hospitalId), grantRows(actor.hospitalId, month, actor.userId)]);
  const own = limits.find((l) => l.user_id === actor.userId);
  const base = own?.monthly_limit ?? limits.find((l) => l.user_id == null)?.monthly_limit ?? PLATFORM_DEFAULT_MONTHLY_TOKENS;
  const limit = base + sum(grants, "tokens");
  const blocked = Boolean(own?.blocked);
  return { month, blocked, used, limit, remaining: blocked ? 0 : Math.max(0, limit - used), exceeded: blocked || used >= limit, renewsOn: renewsOn(month) };
}

/** The message shown when someone has no tokens left. */
export function quotaExceededMessage(q: AiQuotaDTO): string {
  if (q.blocked) return "Your AI access has been paused by your administrator. Please contact your administrator or manager to turn it back on.";
  const fmt = (n: number) => n.toLocaleString("en-IN");
  return (
    `You have used all of your AI tokens for this month (${fmt(q.used)} of ${fmt(q.limit ?? 0)}). ` +
    "Please contact your administrator or manager to increase your limit. " +
    `Your monthly quota renews on ${new Date(`${q.renewsOn}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.`
  );
}

export async function recordUsage(
  actor: Session,
  usage: { threadId: number; messageId: number; promptTokens: number; outputTokens: number; totalTokens: number },
): Promise<void> {
  if (usage.totalTokens <= 0) return;
  await aiTokenUsageRepo.create({
    hospital_id: actor.hospitalId,
    user_id: actor.userId,
    user_name: actor.name,
    role: actor.role,
    thread_id: usage.threadId,
    message_id: usage.messageId,
    prompt_tokens: usage.promptTokens,
    output_tokens: usage.outputTokens,
    total_tokens: usage.totalTokens,
    month: monthOf(),
  });
}

// ── Super admin: the usage report ────────────────────────────────────────────

export async function getUsageReport(rawMonth: unknown, actor: Session): Promise<AiUsageDTO> {
  assertManager(actor);
  const hospitalId = requireHospitalId(actor);
  const current = monthOf();
  const month = typeof rawMonth === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : current;

  const [users, limits, grants, usage, everything] = await Promise.all([
    usersRepo.listRows(scopeToHospital({ unpaged: true }, actor) as never).then((r) => (r.rows as UserRow[]).filter((u) => u.role !== "Platform Admin")),
    limitRows(hospitalId),
    grantRows(hospitalId, month),
    usageRows(hospitalId, month),
    aiTokenUsageRepo.listRows({ filters: [hospitalFilter(hospitalId)], unpaged: true }).then((r) => r.rows),
  ]);
  const defaultLimit = limits.find((l) => l.user_id == null)?.monthly_limit ?? PLATFORM_DEFAULT_MONTHLY_TOKENS;
  const nameOf = new Map(users.map((u) => [u.id, u.name] as const));

  const rows: AiUsageUserDTO[] = users.map((u) => {
    const mine = usage.filter((r) => r.user_id === u.id);
    const used = sum(mine, "total_tokens");
    const ownRow = limits.find((l) => l.user_id === u.id);
    const ownLimit = ownRow?.monthly_limit ?? null;
    const blocked = Boolean(ownRow?.blocked);
    const extra = sum(grants.filter((g) => g.user_id === u.id), "tokens");
    const unlimited = isUnlimited(u);
    const limit = unlimited ? null : (ownLimit ?? defaultLimit) + extra;
    const status: AiUsageStatus = limit == null ? "unlimited" : blocked ? "blocked" : used >= limit ? "exceeded" : used >= limit * NEAR_SHARE ? "near" : "ok";
    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      messages: mine.length,
      promptTokens: mine.reduce((n, r) => n + Number(r.prompt_tokens || 0), 0),
      outputTokens: mine.reduce((n, r) => n + Number(r.output_tokens || 0), 0),
      used,
      limit,
      ownLimit,
      extraGranted: extra,
      blocked,
      status,
      lastUsedAt: mine.reduce<string | null>((latest, r) => (latest == null || r.created_at > latest ? r.created_at : latest), null),
    };
  });
  rows.sort((a, b) => b.used - a.used || a.name.localeCompare(b.name));

  const roles = new Map<string, { role: string; used: number; messages: number; users: Set<number> }>();
  for (const r of usage) {
    const e = roles.get(r.role) ?? { role: r.role, used: 0, messages: 0, users: new Set<number>() };
    e.used += Number(r.total_tokens || 0);
    e.messages += 1;
    e.users.add(r.user_id);
    roles.set(r.role, e);
  }

  const days = new Map<string, { tokens: number; messages: number }>();
  for (const r of usage) {
    const d = localDate(new Date(r.created_at));
    const e = days.get(d) ?? { tokens: 0, messages: 0 };
    e.tokens += Number(r.total_tokens || 0);
    e.messages += 1;
    days.set(d, e);
  }
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const daily = Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { date, tokens: days.get(date)?.tokens ?? 0, messages: days.get(date)?.messages ?? 0 };
  });

  const totalUsed = sum(usage, "total_tokens");
  const peak = daily.reduce<{ date: string; tokens: number } | null>((best, d) => (best == null || d.tokens > best.tokens ? d : best), null);
  // For the running month: what the month will come to if use carries on at today's pace.
  const dayOfMonth = month === current ? Number(localDate().slice(8, 10)) : daysInMonth;
  const projected = month === current && totalUsed > 0 ? Math.round((totalUsed / Math.max(1, dayOfMonth)) * daysInMonth) : null;

  const months = [...new Set([current, ...everything.map((r) => r.month)])].sort().reverse();

  return {
    month,
    months,
    renewsOn: renewsOn(month),
    defaultLimit,
    totals: {
      used: totalUsed,
      messages: usage.length,
      activeUsers: new Set(usage.map((r) => r.user_id)).size,
      exceeded: rows.filter((r) => r.status === "exceeded").length,
      near: rows.filter((r) => r.status === "near").length,
      blocked: rows.filter((r) => r.status === "blocked").length,
      avgPerAnswer: usage.length ? Math.round(totalUsed / usage.length) : 0,
      promptTokens: usage.reduce((n, r) => n + Number(r.prompt_tokens || 0), 0),
      outputTokens: usage.reduce((n, r) => n + Number(r.output_tokens || 0), 0),
      peakDay: peak && peak.tokens > 0 ? { date: peak.date, tokens: peak.tokens } : null,
      projected,
    },
    users: rows,
    byRole: [...roles.values()].map((r) => ({ role: r.role, used: r.used, messages: r.messages, users: r.users.size })).sort((a, b) => b.used - a.used),
    daily,
    grants: grants
      .map((g) => ({ id: g.id, userId: g.user_id, userName: nameOf.get(g.user_id) ?? "Former staff", tokens: g.tokens, note: g.note, grantedBy: g.granted_by, createdAt: g.created_at }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

// ── Super admin: set limits and give more tokens ─────────────────────────────

function wholeTokens(value: unknown, what: string, min: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > 2_000_000_000) throw new BadRequestError(`${what} must be a whole number${min > 0 ? ` of at least ${min}` : ""}.`);
  return n;
}

/**
 * `{ limit }` sets the hospital default; `{ userId, limit }` sets one person's own limit; `{ userId, limit: null }`
 * puts that person back on the default.
 */
export async function setLimit(input: unknown, actor: Session): Promise<void> {
  assertManager(actor);
  const hospitalId = requireHospitalId(actor);
  const body = (input ?? {}) as { userId?: unknown; limit?: unknown };
  const userId = body.userId == null ? null : Number(body.userId);
  if (userId != null) {
    const user = await usersRepo.getRow(userId);
    if (!user || user.hospital_id !== hospitalId) throw new NotFoundError("User");
  }
  const existing = (await limitRows(hospitalId)).find((l) => (l.user_id ?? null) === userId);

  if (userId != null && body.limit === null) {
    // Back to the default. A paused person keeps their row (it holds the pause) with no limit of its own.
    if (existing?.blocked) await aiTokenLimitsRepo.update(existing.id, { monthly_limit: null, updated_by: actor.name });
    else if (existing) await aiTokenLimitsRepo.remove(existing.id);
    await audit(actor, "update", "ai_token_limit", userId, { limit: null });
    return;
  }
  const limit = wholeTokens(body.limit, "The limit", 0);
  if (existing) await aiTokenLimitsRepo.update(existing.id, { monthly_limit: limit, updated_by: actor.name });
  else await aiTokenLimitsRepo.create({ hospital_id: hospitalId, user_id: userId, monthly_limit: limit, blocked: false, updated_by: actor.name });
  await audit(actor, "update", "ai_token_limit", userId ?? "default", { limit });
}

/** Gives one person extra tokens for the current month, so they can carry on after hitting their limit. */
export async function grantTokens(input: unknown, actor: Session): Promise<void> {
  assertManager(actor);
  const hospitalId = requireHospitalId(actor);
  const body = (input ?? {}) as { userId?: unknown; tokens?: unknown; note?: unknown };
  const userId = Number(body.userId);
  const user = Number.isInteger(userId) ? await usersRepo.getRow(userId) : null;
  if (!user || user.hospital_id !== hospitalId) throw new NotFoundError("User");
  const tokens = wholeTokens(body.tokens, "The extra tokens", 1);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) : "";
  await aiTokenGrantsRepo.create({ hospital_id: hospitalId, user_id: userId, month: monthOf(), tokens, note, granted_by: actor.name });
  await audit(actor, "create", "ai_token_grant", userId, { tokens, note });
}

/** Pauses or resumes one person's AI use: `{ userId, blocked }`. A paused person gets a plain message, whatever tokens they have left. */
export async function setAccess(input: unknown, actor: Session): Promise<void> {
  assertManager(actor);
  const hospitalId = requireHospitalId(actor);
  const body = (input ?? {}) as { userId?: unknown; blocked?: unknown };
  const userId = Number(body.userId);
  const user = Number.isInteger(userId) ? await usersRepo.getRow(userId) : null;
  if (!user || user.hospital_id !== hospitalId) throw new NotFoundError("User");
  if (isUnlimited(user)) throw new BadRequestError("A super admin's AI use cannot be paused.");
  const blocked = body.blocked === true;
  const existing = (await limitRows(hospitalId)).find((l) => l.user_id === userId);
  if (existing) {
    if (!blocked && existing.monthly_limit == null) await aiTokenLimitsRepo.remove(existing.id);
    else await aiTokenLimitsRepo.update(existing.id, { blocked, updated_by: actor.name });
  } else if (blocked) {
    await aiTokenLimitsRepo.create({ hospital_id: hospitalId, user_id: userId, monthly_limit: null, blocked: true, updated_by: actor.name });
  }
  await audit(actor, "update", "ai_access", userId, { blocked });
}
