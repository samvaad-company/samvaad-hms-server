/**
 * Who pays what on an insured bill: a contract's copay / deductible rules, exclusions and limits split each line between the
 * payer and the patient. Pure, so the server (which saves the split) and the New Bill screen (which previews it) agree.
 *
 * Rules, as the Setup → Sponsors screen words them:
 *  - an exclusion is something the contract doesn't pay for: the patient pays that line in full;
 *  - a line follows the copay rule for its service group (or a parent group), else the contract's default rule, else the payer
 *    pays it all; within a rule the deductible is the patient's first, then copay % of the rest, held between copay min and max;
 *  - the per-encounter limit caps what the payer pays across a rule's lines on one bill;
 *  - a limit rule caps what the payer pays for a named charge (an amount, a number of times, per day / visit / admission / year /
 *    contract); and the annual limit caps what the payer pays one patient in a year.
 * Anything over a cap becomes the patient's. "Episodic" limits need a record of episodes of care, which the HMS doesn't keep, so
 * they are shown in Setup but not applied.
 */

export interface CopayRule {
  groupId: number | null;
  copayPercent: number | null;
  deductible: number | null;
  copayMin: number | null;
  copayMax: number | null;
  annualLimit: number | null;
  encounterLimit: number | null;
}
export interface ExclusionRule { target: string; reason?: string }
export interface LimitRule { target: string; limitAmount: number | null; limitCount: number | null; per: string }

export interface CoverageTerms { copay: CopayRule[]; exclusions: ExclusionRule[]; limits: LimitRule[] }

export interface CoverageLine {
  name: string;
  code: string;
  /** The service's group and its parents, nearest first. */
  groupIds: number[];
  groupNames: string[];
  quantity: number;
  /** What the line comes to on this bill — after its share of the discount, with GST. */
  total: number;
}

/** What the payer already paid this patient under the contract, for the limits that look back. */
export interface CoveragePast {
  annualPaid: number;
  items: { name: string; code: string; groupNames: string[]; quantity: number; payer: number; date: string }[];
}

export interface CoverageResult {
  payer: number;
  patient: number;
  lines: { payer: number; patient: number; note: string }[];
}

const r2 = (n: number): number => Math.round(n * 100) / 100;
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** Read the rule lists stored on a contract into typed rules (anything unreadable is dropped). */
export function readTerms(contract: { copay?: unknown; exclusions?: unknown; limits?: unknown }): CoverageTerms {
  const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);
  return {
    copay: list(contract.copay).map((r) => ({
      groupId: num(r.groupId), copayPercent: num(r.copayPercent), deductible: num(r.deductible), copayMin: num(r.copayMin), copayMax: num(r.copayMax),
      annualLimit: num(r.annualLimit), encounterLimit: num(r.encounterLimit),
    })),
    exclusions: list(contract.exclusions).map((r) => ({ target: String(r.target ?? "").trim(), reason: r.reason ? String(r.reason) : undefined })).filter((r) => r.target),
    limits: list(contract.limits).map((r) => ({ target: String(r.target ?? "").trim(), limitAmount: num(r.limitAmount), limitCount: num(r.limitCount), per: String(r.per ?? "contract") })).filter((r) => r.target),
  };
}

const norm = (s: string) => s.trim().toLowerCase();

/** Whether a rule's free-text target names this charge: its name, code or one of its groups. */
export function targets(target: string, line: { name: string; code: string; groupNames: string[] }): boolean {
  const t = norm(target);
  if (!t) return false;
  return norm(line.name).includes(t) || (!!line.code && norm(line.code) === t) || line.groupNames.some((g) => norm(g) === t || norm(g).includes(t));
}

/** Scale `values` (in place) so their sum is at most `cap`. */
function capSum(values: number[], idx: number[], cap: number): void {
  const sum = idx.reduce((n, i) => n + values[i], 0);
  if (sum <= cap || sum <= 0) return;
  const f = Math.max(0, cap) / sum;
  for (const i of idx) values[i] *= f;
}

export function splitCoverage(
  terms: CoverageTerms, lines: CoverageLine[], past: CoveragePast, ctx: { today: string; contractFrom?: string | null },
): CoverageResult {
  const payer = lines.map(() => 0);
  const notes = lines.map(() => "");
  const eligible: number[] = [];

  lines.forEach((l, i) => {
    const hit = terms.exclusions.find((x) => targets(x.target, l));
    if (hit) notes[i] = hit.reason ? `Not covered: ${hit.reason}` : "Not covered by the contract";
    else eligible.push(i);
  });

  // Copay rule per line: the nearest group's rule, else the default rule.
  const fallback = terms.copay.find((r) => r.groupId === null) ?? null;
  const ruleOf = (l: CoverageLine): CopayRule | null => {
    for (const g of l.groupIds) { const r = terms.copay.find((x) => x.groupId === g); if (r) return r; }
    return fallback;
  };
  const byRule = new Map<CopayRule | null, number[]>();
  for (const i of eligible) { const r = ruleOf(lines[i]); byRule.set(r, [...(byRule.get(r) ?? []), i]); }
  for (const [rule, idx] of byRule) {
    const base = idx.reduce((n, i) => n + lines[i].total, 0);
    let share = base;
    let note = "Covered in full";
    if (rule) {
      const deductible = Math.min(base, Math.max(0, rule.deductible ?? 0));
      const rest = base - deductible;
      let copay = rule.copayPercent !== null ? (rest * rule.copayPercent) / 100 : 0;
      if (rule.copayMin !== null) copay = Math.max(copay, rule.copayMin);
      if (rule.copayMax !== null) copay = Math.min(copay, rule.copayMax);
      copay = Math.min(copay, rest);
      share = base - deductible - copay;
      const bits = [rule.deductible ? "deductible" : "", rule.copayPercent !== null ? `${rule.copayPercent}% copay` : ""].filter(Boolean);
      note = bits.length ? `Covered after ${bits.join(" + ")}` : "Covered in full";
      if (rule.encounterLimit !== null && share > rule.encounterLimit) { share = rule.encounterLimit; note = "Held at the per-encounter limit"; }
    }
    for (const i of idx) { payer[i] = base > 0 ? (share * lines[i].total) / base : 0; notes[i] = note; }
  }

  // Limit rules on named charges.
  const winStart = (per: string): string | null => {
    if (per === "year") { const d = new Date(`${ctx.today}T12:00:00`); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); }
    if (per === "contract") return ctx.contractFrom || "";
    return null; // per day / visit / admission: this bill only
  };
  for (const lim of terms.limits) {
    const idx = eligible.filter((i) => payer[i] > 0 && targets(lim.target, lines[i]));
    if (!idx.length) continue;
    const from = winStart(lim.per);
    const earlier = from === null ? [] : past.items.filter((p) => targets(lim.target, p) && p.date >= from);
    let allowedUnits = lim.limitCount !== null ? lim.limitCount - earlier.reduce((n, p) => n + p.quantity, 0) : Infinity;
    for (const i of idx) {
      const q = lines[i].quantity;
      if (allowedUnits >= q) { allowedUnits -= q; continue; }
      payer[i] *= Math.max(0, allowedUnits) / q;
      allowedUnits = 0;
      notes[i] = "Limit on the number of times reached";
    }
    if (lim.limitAmount !== null) {
      const perDay = lim.per === "day" ? idx.reduce((n, i) => n + lines[i].quantity, 0) : 1;
      const cap = lim.limitAmount * perDay - earlier.reduce((n, p) => n + p.payer, 0);
      const before = idx.reduce((n, i) => n + payer[i], 0);
      capSum(payer, idx, cap);
      if (idx.reduce((n, i) => n + payer[i], 0) < before) for (const i of idx) notes[i] = `Held at the ${lim.target} limit`;
    }
  }

  // Annual limit: the default rule's, else the lowest any rule sets.
  const annuals = terms.copay.map((r) => r.annualLimit).filter((v): v is number => v !== null);
  const annual = fallback?.annualLimit ?? (annuals.length ? Math.min(...annuals) : null);
  if (annual !== null) {
    const remaining = Math.max(0, annual - past.annualPaid);
    const all = lines.map((_, i) => i);
    const before = payer.reduce((n, v) => n + v, 0);
    capSum(payer, all, remaining);
    if (payer.reduce((n, v) => n + v, 0) < before) for (const i of eligible) notes[i] = "Held at the annual limit";
  }

  const out = lines.map((l, i) => {
    const p = r2(Math.min(l.total, Math.max(0, payer[i])));
    return { payer: p, patient: r2(l.total - p), note: notes[i] || (p > 0 ? "" : "Patient pays") };
  });
  const payerTotal = r2(out.reduce((n, l) => n + l.payer, 0));
  return { payer: payerTotal, patient: r2(lines.reduce((n, l) => n + l.total, 0) - payerTotal), lines: out };
}
