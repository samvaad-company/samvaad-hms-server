/**
 * Payouts from Setup → Payout rules. When an invoice is raised from the catalogue, each rule in force that fits it earns someone a
 * payout: the doctor the bill is in the name of (Consulting / Surgeon), the patient's referrer (Referred), an outside lab the work
 * was sent to (Outhouse). Payouts are worked on what was billed — after the discount, before GST — whoever ends up paying it.
 *
 * Where rules overlap on a line the most specific wins: a single service, then IPD bills, then all services; a doctor never earns
 * two rules on the same line. A fixed amount is paid once per rule per bill (per payee). A referral source's own payout value, when
 * set in Masters, replaces the rule's value for that source.
 */
import { billPayoutsRepo } from "@/repositories";
import { type BillPayoutRow } from "@/db/tables";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { type Session } from "@/auth/session";
import { audit } from "@/services/audit";
import { scopeToHospital } from "@/services/hospital-scope";
import { listSetup } from "@/services/setup-service";
import { localDate } from "@/lib/clock";
import { r2 } from "@shared/types/billing";
import type { SetupRecordDTO } from "@shared/types/setup";

export interface PayoutLine { serviceId: number | null; name: string; /** After the discount, before GST. */ net: number; centre: { id: number; name: string; external: boolean } | null }
export interface PayoutPlan {
  billType: string;
  billDate: string;
  lines: PayoutLine[];
  doctor: { id: number; name: string } | null;
  referral: { name: string; type: string; payoutValue: number | null } | null;
}
export interface PayoutDraft { ruleId: number; ruleName: string; role: string; payeeType: "doctor" | "referral" | "centre"; payeeId: number | null; payeeName: string; basis: number; valueKind: string; value: number; amount: number }

const SPECIFICITY: Record<string, number> = { "A single service": 3, IPD: 2, "All services": 1 };
const DOCTOR_ROLES = ["Consulting", "Surgeon"];
const PAID_REFERRALS = ["Referring doctor", "Corporate / organization", "Health camp"];

function inForce(r: SetupRecordDTO, date: string): boolean {
  return r.active && (!r.data.effectiveFrom || String(r.data.effectiveFrom) <= date) && (!r.data.effectiveTo || String(r.data.effectiveTo) >= date);
}
function fits(r: SetupRecordDTO, billType: string, l: PayoutLine): boolean {
  const scope = String(r.data.scope);
  if (scope === "IPD") return billType === "IPD";
  if (scope === "A single service") return l.serviceId !== null && Number(r.data.serviceId) === l.serviceId;
  return true;
}

/** For each line (by index) the most specific rule that fits; lines with none are left out. */
function assign(rules: SetupRecordDTO[], plan: PayoutPlan, only: number[]): Map<SetupRecordDTO, number[]> {
  const out = new Map<SetupRecordDTO, number[]>();
  for (const i of only) {
    const best = rules.filter((r) => fits(r, plan.billType, plan.lines[i]))
      .sort((a, b) => (SPECIFICITY[String(b.data.scope)] ?? 0) - (SPECIFICITY[String(a.data.scope)] ?? 0) || String(b.data.effectiveFrom ?? "").localeCompare(String(a.data.effectiveFrom ?? "")) || b.id - a.id)[0];
    if (best) out.set(best, [...(out.get(best) ?? []), i]);
  }
  return out;
}

const amountOf = (kind: unknown, value: number, basis: number): number => (basis <= 0 ? 0 : kind === "percent" ? r2((basis * value) / 100) : r2(value));

export function computePayouts(rules: SetupRecordDTO[], plan: PayoutPlan): PayoutDraft[] {
  const live = rules.filter((r) => inForce(r, plan.billDate));
  const all = plan.lines.map((_, i) => i);
  const out: PayoutDraft[] = [];
  const push = (rule: SetupRecordDTO, payeeType: PayoutDraft["payeeType"], payeeId: number | null, payeeName: string, idx: number[], value = Number(rule.data.value ?? 0)) => {
    const basis = r2(idx.reduce((n, i) => n + plan.lines[i].net, 0));
    const amount = amountOf(rule.data.valueKind, value, basis);
    if (amount > 0) out.push({ ruleId: rule.id, ruleName: rule.name, role: String(rule.data.role), payeeType, payeeId, payeeName, basis, valueKind: String(rule.data.valueKind), value, amount });
  };

  if (plan.doctor) {
    for (const [rule, idx] of assign(live.filter((r) => DOCTOR_ROLES.includes(String(r.data.role))), plan, all)) push(rule, "doctor", plan.doctor.id, plan.doctor.name, idx);
  }
  if (plan.referral && PAID_REFERRALS.includes(plan.referral.type)) {
    for (const [rule, idx] of assign(live.filter((r) => r.data.role === "Referred"), plan, all)) push(rule, "referral", null, plan.referral.name, idx, plan.referral.payoutValue ?? Number(rule.data.value ?? 0));
  }
  const outside = all.filter((i) => plan.lines[i].centre?.external);
  for (const [rule, idx] of assign(live.filter((r) => r.data.role === "Outhouse"), plan, outside)) {
    for (const c of new Map(idx.map((i) => [plan.lines[i].centre!.id, plan.lines[i].centre!])).values()) {
      push(rule, "centre", c.id, c.name, idx.filter((i) => plan.lines[i].centre!.id === c.id));
    }
  }
  return out;
}

export async function payoutRules(actor: Session): Promise<SetupRecordDTO[]> {
  return listSetup("payout_rule", actor, { activeOnly: true });
}

// ── The payouts screen ───────────────────────────────────────────────────────

export interface PayoutDTO {
  id: number; billId: number; billNumber: string; date: string; rule: string; role: string; payeeType: string; payee: string;
  basis: number; valueKind: string; value: number; amount: number; status: string; paidOn: string | null;
}
const toDto = (r: BillPayoutRow): PayoutDTO => ({
  id: r.id, billId: r.bill_id, billNumber: r.bill_number, date: r.bill_date, rule: r.rule_name, role: r.role, payeeType: r.payee_type, payee: r.payee_name,
  basis: Number(r.basis), valueKind: r.value_kind, value: Number(r.value), amount: Number(r.amount), status: r.status, paidOn: r.paid_on,
});

export async function listPayouts(q: { status?: string; role?: string; payee?: string; from?: string; to?: string }, actor: Session) {
  const { rows } = await billPayoutsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const needle = (q.payee ?? "").trim().toLowerCase();
  const shown = (rows as BillPayoutRow[])
    .filter((r) => (!q.status || r.status === q.status) && (!q.role || r.role === q.role) && (!needle || r.payee_name.toLowerCase().includes(needle)) && (!q.from || r.bill_date >= q.from) && (!q.to || r.bill_date <= q.to))
    .sort((a, b) => b.bill_date.localeCompare(a.bill_date) || b.id - a.id);
  const by = new Map<string, { payee: string; payeeType: string; pending: number; paid: number; count: number }>();
  for (const r of shown) {
    if (r.status === "Void") continue;
    const key = `${r.payee_type}:${r.payee_name}`;
    const g = by.get(key) ?? { payee: r.payee_name, payeeType: r.payee_type, pending: 0, paid: 0, count: 0 };
    if (r.status === "Paid") g.paid += Number(r.amount); else g.pending += Number(r.amount);
    g.count++;
    by.set(key, g);
  }
  const live = shown.filter((r) => r.status !== "Void");
  return {
    rows: shown.map(toDto),
    payees: [...by.values()].map((g) => ({ ...g, pending: r2(g.pending), paid: r2(g.paid) })).sort((a, b) => b.pending - a.pending || a.payee.localeCompare(b.payee)),
    totals: { pending: r2(live.filter((r) => r.status === "Pending").reduce((n, r) => n + Number(r.amount), 0)), paid: r2(live.filter((r) => r.status === "Paid").reduce((n, r) => n + Number(r.amount), 0)) },
  };
}

/** Mark payouts as paid out today. Already-paid or voided ones can't be paid again. */
export async function payPayouts(input: unknown, actor: Session): Promise<{ paid: number; amount: number }> {
  const ids = (input && typeof input === "object" && Array.isArray((input as { ids?: unknown }).ids) ? (input as { ids: unknown[] }).ids : []).map(Number);
  if (!ids.length || ids.length > 500 || ids.some((n) => !Number.isInteger(n) || n < 1)) throw new ValidationError([{ field: "ids", message: "pick the payouts to mark as paid" }]);
  const { rows } = await billPayoutsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const picked = (rows as BillPayoutRow[]).filter((r) => ids.includes(r.id));
  if (picked.length !== new Set(ids).size) throw new NotFoundError("Payout");
  const stale = picked.find((r) => r.status !== "Pending");
  if (stale) throw new ConflictError(`${stale.payee_name}'s payout on ${stale.bill_number} is already ${stale.status.toLowerCase()}`);
  const today = localDate();
  for (const r of picked) await billPayoutsRepo.update(r.id, { status: "Paid", paid_on: today } as never);
  await audit(actor, "update", "bill-payouts", picked[0].id, { paid: picked.length });
  return { paid: picked.length, amount: r2(picked.reduce((n, r) => n + Number(r.amount), 0)) };
}

/** A bill was refunded or removed: what hasn't been paid out is void (or gone). */
export async function voidPayoutsFor(billId: number, actor: Session, remove = false): Promise<void> {
  const { rows } = await billPayoutsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "bill_id", op: "eq", value: billId }] }, actor));
  for (const r of rows as BillPayoutRow[]) {
    if (remove) await billPayoutsRepo.remove(r.id);
    else if (r.status === "Pending") await billPayoutsRepo.update(r.id, { status: "Void" } as never);
  }
}
