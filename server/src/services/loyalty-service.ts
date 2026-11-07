/**
 * Patient loyalty programme: five cards (Basic → VIP) that a patient moves up by earning points, and what each card does to
 * their prices on the bill.
 *
 * Points are worked out from the hospital's own records each time, so they are always current: years since the first OPD
 * consultation, days they came in the last 12 months, family members and referrals recorded on appointments ("family of",
 * "referred by"), and follow-ups they came back for. An administrator can add or take off points by hand (kept as a ledger with a
 * reason). Everyone starts on Basic. A card with no activity for the set number of months is inactive and gives no benefits until
 * the patient comes back. The cards, prices, colours and scoring rules are the hospital's to change (Setup → Masters).
 */
import { appointmentsRepo, billsRepo, followupsRepo, loyaltyAdjustmentsRepo, opdRepo, patientsRepo, setupRecordsRepo } from "@/repositories";
import type { AppointmentRow, BillRow, FollowUpRow, LoyaltyAdjustmentRow, OpdVisitRow, PatientRow, SetupRecordRow } from "@/db/tables";
import { type Session } from "@/auth/session";
import { BadRequestError, NotFoundError, ValidationError, type FieldError } from "@/lib/errors";
import { audit } from "@/services/audit";
import { assertOwnedByHospital, requireHospitalId, scopeToHospital } from "@/services/hospital-scope";
import { localDate } from "@/lib/clock";
import {
  DEFAULT_PROGRAM, RANK_KEYS, rankForPoints,
  type LoyaltyBreakdownLine, type LoyaltyDetailDTO, type LoyaltyLinkDTO, type LoyaltyListDTO, type LoyaltyMemberDTO, type LoyaltyPricingDTO, type LoyaltyProgram,
  type LoyaltyRank, type LoyaltyRule, type LoyaltySummaryDTO,
} from "@shared/types/loyalty";

const KIND = "config:loyalty";
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const addDays = (iso: string, n: number): string => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const diffDays = (a: string, b: string): number => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000);
const dayOf = (ts: string | null | undefined): string => (ts ? localDate(new Date(ts)) : "");
const num = (v: unknown, fallback: number): number => (Number.isFinite(Number(v)) ? Number(v) : fallback);

// ── The programme (cards, prices, colours, rules) ────────────────────────────────────────────────────────────────────────

async function programRow(actor: Session): Promise<SetupRecordRow | undefined> {
  const { rows } = await setupRecordsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "kind", op: "eq", value: KIND }] }, actor));
  return (rows as SetupRecordRow[])[0];
}

/** What the hospital saved laid over the defaults, so a field added later still has a value. */
function withDefaults(saved: Record<string, unknown> | undefined): LoyaltyProgram {
  const base = structuredClone(DEFAULT_PROGRAM);
  if (!saved) return base;
  const out: LoyaltyProgram = { ...base, enabled: saved.enabled !== false };
  if (Array.isArray(saved.benefitCatalogue)) out.benefitCatalogue = saved.benefitCatalogue.filter((b): b is string => typeof b === "string");
  if (Array.isArray(saved.ranks)) {
    out.ranks = base.ranks.map((d) => {
      const r = (saved.ranks as unknown[]).find((x) => isRecord(x) && x.key === d.key) as Record<string, unknown> | undefined;
      if (!r) return d;
      const disc = isRecord(r.discounts) ? r.discounts : {};
      return {
        ...d,
        name: typeof r.name === "string" && r.name ? r.name : d.name,
        tagline: typeof r.tagline === "string" ? r.tagline : d.tagline,
        color: typeof r.color === "string" && /^#[0-9a-fA-F]{6}$/.test(r.color) ? r.color : d.color,
        minPoints: num(r.minPoints, d.minPoints), opdFee: num(r.opdFee, d.opdFee), erFee: num(r.erFee, d.erFee),
        discounts: { lab: num(disc.lab, d.discounts.lab), pharmacy: num(disc.pharmacy, d.discounts.pharmacy), radiology: num(disc.radiology, d.discounts.radiology), ipd: num(disc.ipd, d.discounts.ipd) },
        benefits: Array.isArray(r.benefits) ? r.benefits.filter((b): b is string => typeof b === "string") : d.benefits,
      };
    });
  }
  if (isRecord(saved.scoring)) {
    const s = saved.scoring;
    const rule = (key: string, d: LoyaltyRule): LoyaltyRule => (isRecord(s[key]) ? { points: num((s[key] as Record<string, unknown>).points, d.points), max: num((s[key] as Record<string, unknown>).max, d.max) } : d);
    out.scoring = { perYear: rule("perYear", base.scoring.perYear), perVisit: rule("perVisit", base.scoring.perVisit), perFamilyMember: rule("perFamilyMember", base.scoring.perFamilyMember), perReferral: rule("perReferral", base.scoring.perReferral), perFollowUp: rule("perFollowUp", base.scoring.perFollowUp), inactiveMonths: num(s.inactiveMonths, base.scoring.inactiveMonths) };
  }
  return out;
}

export async function getProgram(actor: Session): Promise<LoyaltyProgram> {
  requireHospitalId(actor);
  return withDefaults((await programRow(actor))?.data);
}

export async function saveProgram(input: unknown, actor: Session): Promise<LoyaltyProgram> {
  const hospitalId = requireHospitalId(actor);
  const body = isRecord(input) ? input : {};
  const errors: FieldError[] = [];
  const whole = (v: unknown, field: string, min: number, max: number): number => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) { errors.push({ field, message: `must be a number from ${min} to ${max}` }); return min; }
    return Math.round(n * 100) / 100;
  };

  const catalogue = Array.isArray(body.benefitCatalogue) ? body.benefitCatalogue : DEFAULT_PROGRAM.benefitCatalogue;
  const benefitCatalogue = [...new Set(catalogue.filter((b): b is string => typeof b === "string").map((b) => b.trim()).filter(Boolean))];
  if (benefitCatalogue.length > 60 || benefitCatalogue.some((b) => b.length > 80)) errors.push({ field: "benefitCatalogue", message: "keep the benefit list to 60 short names" });

  const rawRanks = Array.isArray(body.ranks) ? body.ranks : [];
  const ranks: LoyaltyRank[] = RANK_KEYS.map((key, i) => {
    const r = (rawRanks.find((x) => isRecord(x) && x.key === key) ?? {}) as Record<string, unknown>;
    const d = DEFAULT_PROGRAM.ranks[i];
    const name = typeof r.name === "string" ? r.name.trim() : d.name;
    if (!name || name.length > 30) errors.push({ field: `${key}.name`, message: "give the card a name of up to 30 letters" });
    const color = typeof r.color === "string" ? r.color : d.color;
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) errors.push({ field: `${key}.color`, message: "colour must look like #d4a017" });
    const disc = isRecord(r.discounts) ? r.discounts : {};
    return {
      key, name, tagline: typeof r.tagline === "string" ? r.tagline.trim().slice(0, 60) : d.tagline, color,
      minPoints: key === "basic" ? 0 : whole(r.minPoints, `${key}.minPoints`, 1, 100_000),
      opdFee: whole(r.opdFee, `${key}.opdFee`, 0, 1_000_000), erFee: whole(r.erFee, `${key}.erFee`, 0, 1_000_000),
      discounts: { lab: whole(disc.lab, `${key}.lab`, 0, 100), pharmacy: whole(disc.pharmacy, `${key}.pharmacy`, 0, 100), radiology: whole(disc.radiology, `${key}.radiology`, 0, 100), ipd: whole(disc.ipd, `${key}.ipd`, 0, 100) },
      benefits: (Array.isArray(r.benefits) ? r.benefits : []).filter((b): b is string => typeof b === "string" && benefitCatalogue.includes(b)),
    };
  });
  for (let i = 1; i < ranks.length; i++) if (ranks[i].minPoints <= ranks[i - 1].minPoints) errors.push({ field: `${ranks[i].key}.minPoints`, message: `must be more than ${ranks[i - 1].name}'s ${ranks[i - 1].minPoints}` });

  const s = isRecord(body.scoring) ? body.scoring : {};
  const rule = (key: string, d: LoyaltyRule): LoyaltyRule => { const r = isRecord(s[key]) ? (s[key] as Record<string, unknown>) : {}; return { points: whole(r.points ?? d.points, `${key}.points`, 0, 10_000), max: whole(r.max ?? d.max, `${key}.max`, 0, 100_000) }; };
  const scoring = { perYear: rule("perYear", DEFAULT_PROGRAM.scoring.perYear), perVisit: rule("perVisit", DEFAULT_PROGRAM.scoring.perVisit), perFamilyMember: rule("perFamilyMember", DEFAULT_PROGRAM.scoring.perFamilyMember), perReferral: rule("perReferral", DEFAULT_PROGRAM.scoring.perReferral), perFollowUp: rule("perFollowUp", DEFAULT_PROGRAM.scoring.perFollowUp), inactiveMonths: whole(s.inactiveMonths ?? DEFAULT_PROGRAM.scoring.inactiveMonths, "inactiveMonths", 1, 60) };
  if (errors.length) throw new ValidationError(errors);

  const program: LoyaltyProgram = { enabled: body.enabled !== false, ranks, scoring, benefitCatalogue };
  const existing = await programRow(actor);
  if (existing) await setupRecordsRepo.update(existing.id, { data: program as never } as never);
  else await setupRecordsRepo.create({ hospital_id: hospitalId, kind: KIND, code: "", name: "loyalty", active: true, sort_order: 0, data: program } as never);
  await audit(actor, "update", "loyalty-program", hospitalId, { ranks: ranks.map((r) => `${r.name}:${r.minPoints}`) });
  return program;
}

// ── Points ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

interface Facts {
  patients: PatientRow[];
  appts: AppointmentRow[];
  opd: OpdVisitRow[];
  bills: BillRow[];
  follow: FollowUpRow[];
  adjustments: LoyaltyAdjustmentRow[];
}

async function loadFacts(actor: Session): Promise<Facts> {
  const all = async <T,>(repo: { listRows(o: never): Promise<{ rows: unknown[] }> }): Promise<T[]> => (await repo.listRows(scopeToHospital({ unpaged: true }, actor) as never)).rows as T[];
  const [patients, appts, opd, bills, follow, adjustments] = await Promise.all([
    all<PatientRow>(patientsRepo), all<AppointmentRow>(appointmentsRepo), all<OpdVisitRow>(opdRepo), all<BillRow>(billsRepo), all<FollowUpRow>(followupsRepo), all<LoyaltyAdjustmentRow>(loyaltyAdjustmentsRepo),
  ]);
  return { patients, appts, opd, bills, follow, adjustments };
}

const capped = (count: number, r: LoyaltyRule): number => Math.min(r.max, count * r.points);

function compute(facts: Facts, program: LoyaltyProgram): Map<number, LoyaltyDetailDTO> {
  const today = localDate();
  const yearAgo = addDays(today, -364);
  const sc = program.scoring;
  const ranks = [...program.ranks].sort((a, b) => a.minPoints - b.minPoints);
  const nameOf = new Map(facts.patients.map((p) => [p.id, p.name] as const));

  // Visits (OPD check-ins and appointments that weren't cancelled), by patient.
  const visits = new Map<number, Set<string>>();
  const visit = (pid: number | null, day: string) => { if (pid === null || !day || day > today) return; (visits.get(pid) ?? visits.set(pid, new Set()).get(pid)!).add(day); };
  for (const v of facts.opd) visit(v.patient_id, dayOf(v.created_at));
  for (const a of facts.appts) if (a.status !== "Cancelled") visit(a.patient_id, a.appointment_date);
  const lastBill = new Map<number, string>();
  for (const b of facts.bills) if (b.patient_id !== null && b.bill_date <= today && b.bill_date > (lastBill.get(b.patient_id) ?? "")) lastBill.set(b.patient_id, b.bill_date);
  const doneFollow = new Map<number, number>();
  for (const f of facts.follow) if (f.patient_id !== null && f.status === "Done") doneFollow.set(f.patient_id, (doneFollow.get(f.patient_id) ?? 0) + 1);

  // Referrals and family, from the optional links on appointments (newest first, so the latest word wins).
  const referred = new Map<number, Map<number, string>>();                       // referrer → patient → first date
  const family = new Map<number, Map<number, string>>();                          // person → relative → relation
  const referredBy = new Map<number, { patientId: number; name: string }>();
  const familyOf = new Map<number, { patientId: number; name: string; relation: string }>();
  const byNewest = [...facts.appts].sort((a, b) => b.appointment_date.localeCompare(a.appointment_date));
  for (const a of byNewest) {
    const pid = a.patient_id;
    if (pid === null) continue;
    const ref = a.referred_by_patient_id ?? null;
    if (ref !== null && ref !== pid) {
      const m = referred.get(ref) ?? referred.set(ref, new Map()).get(ref)!;
      if (!m.has(pid) || a.appointment_date < m.get(pid)!) m.set(pid, a.appointment_date);
      if (!referredBy.has(pid)) referredBy.set(pid, { patientId: ref, name: nameOf.get(ref) ?? a.referred_by_name ?? "Former patient" });
    }
    const fam = a.family_of_patient_id ?? null;
    if (fam !== null && fam !== pid) {
      const relation = a.family_relation ?? "";
      (family.get(fam) ?? family.set(fam, new Map()).get(fam)!).set(pid, relation);
      (family.get(pid) ?? family.set(pid, new Map()).get(pid)!).set(fam, relation);
      if (!familyOf.has(pid)) familyOf.set(pid, { patientId: fam, name: nameOf.get(fam) ?? a.family_of_name ?? "Former patient", relation });
    }
  }

  const manual = new Map<number, LoyaltyAdjustmentRow[]>();
  for (const a of facts.adjustments) (manual.get(a.patient_id) ?? manual.set(a.patient_id, []).get(a.patient_id)!).push(a);

  const out = new Map<number, LoyaltyDetailDTO>();
  for (const p of facts.patients) {
    const days = visits.get(p.id) ?? new Set<string>();
    const first = [...days].sort()[0] ?? null;
    const years = first ? Math.floor(diffDays(first, today) / 365.25) : 0;
    const lastVisit = [...days].sort().at(-1) ?? "";
    const lastActivity = [lastVisit, lastBill.get(p.id) ?? "", dayOf(p.created_at)].sort().at(-1) || null;
    const recent = [...days].filter((d) => d >= yearAgo).length;
    const refs = referred.get(p.id) ?? new Map<number, string>();
    const fam = family.get(p.id) ?? new Map<number, string>();
    const follows = doneFollow.get(p.id) ?? 0;
    const adjustments = manual.get(p.id) ?? [];
    const manualPoints = adjustments.reduce((n, a) => n + a.points, 0);

    const breakdown: LoyaltyBreakdownLine[] = [
      { key: "years", label: "Years with us", detail: first ? `${years} completed ${years === 1 ? "year" : "years"} since the first visit` : "No visit yet", points: capped(years, sc.perYear), max: sc.perYear.max },
      { key: "visits", label: "Visits this year", detail: `${recent} ${recent === 1 ? "day" : "days"} in the last 12 months`, points: capped(recent, sc.perVisit), max: sc.perVisit.max },
      { key: "family", label: "Family members", detail: `${fam.size} linked`, points: capped(fam.size, sc.perFamilyMember), max: sc.perFamilyMember.max },
      { key: "referrals", label: "Patients referred", detail: `${refs.size} referred`, points: capped(refs.size, sc.perReferral), max: sc.perReferral.max },
      { key: "followups", label: "Follow-ups kept", detail: `${follows} done`, points: capped(follows, sc.perFollowUp), max: sc.perFollowUp.max },
    ];
    const autoPoints = breakdown.reduce((n, l) => n + l.points, 0);
    const points = Math.max(0, autoPoints + manualPoints);
    const rank = rankForPoints(points, ranks);
    const at = ranks.findIndex((r) => r.key === rank.key);
    const next = ranks[at + 1] ?? null;
    const inactive = lastActivity ? diffDays(lastActivity, today) > Math.round(sc.inactiveMonths * 30.4) : false;
    const lines = manualPoints !== 0 ? [...breakdown, { key: "manual", label: "Added by the hospital", detail: `${adjustments.length} ${adjustments.length === 1 ? "entry" : "entries"}`, points: manualPoints, max: null }] : breakdown;

    out.set(p.id, {
      patientId: p.id, name: p.name, patientCode: p.patient_code, phone: p.phone, cardNo: `LC-${p.patient_code || String(p.id).padStart(5, "0")}`,
      rankKey: rank.key, rankName: rank.name, tagline: rank.tagline, color: rank.color, stars: at + 1,
      points, autoPoints, manualPoints, breakdown: lines, status: inactive ? "Inactive" : "Active", lastActivity,
      next: next ? { name: next.name, pointsNeeded: Math.max(0, next.minPoints - points) } : null,
      progress: next ? Math.max(0, Math.min(100, Math.round(((points - rank.minPoints) / Math.max(1, next.minPoints - rank.minPoints)) * 100))) : 100,
      referredCount: refs.size, familyCount: fam.size, referredBy: referredBy.get(p.id) ?? null, familyOf: familyOf.get(p.id) ?? null,
      referrals: [...refs].map(([pid, date]) => ({ patientId: pid, name: nameOf.get(pid) ?? "Former patient", date })).sort((a, b) => b.date.localeCompare(a.date)),
      family: [...fam].map(([pid, relation]) => ({ patientId: pid, name: nameOf.get(pid) ?? "Former patient", relation })),
      adjustments: adjustments.map((a) => ({ id: a.id, points: a.points, reason: a.reason, by: a.by_name, at: a.created_at })).sort((a, b) => b.at.localeCompare(a.at)),
    });
  }
  return out;
}

// ── Reads ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

const strip = (d: LoyaltyDetailDTO): LoyaltyMemberDTO => { const { referrals: _r, family: _f, adjustments: _a, ...member } = d; void _r; void _f; void _a; return member; };

export async function listMembers(query: URLSearchParams, actor: Session): Promise<LoyaltyListDTO> {
  requireHospitalId(actor);
  const [program, facts] = await Promise.all([getProgram(actor), loadFacts(actor)]);
  const all = [...compute(facts, program).values()];
  const search = (query.get("search") ?? "").trim().toLowerCase();
  const rank = query.get("rank") ?? "";
  const status = query.get("status") ?? "";
  const filtered = all
    .filter((m) => (!rank || m.rankKey === rank) && (!status || m.status === status)
      && (!search || m.name.toLowerCase().includes(search) || m.patientCode.toLowerCase().includes(search) || (m.phone ?? "").toLowerCase().includes(search)))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  // Everyone whose card is inactive, quietest first: the admin's "bring them back" list.
  const dormant = all.filter((m) => m.status === "Inactive").sort((a, b) => (a.lastActivity ?? "").localeCompare(b.lastActivity ?? ""));
  const pageSize = Math.min(200, Math.max(1, Number(query.get("pageSize")) || 25));
  const page = Math.max(1, Number(query.get("page")) || 1);
  const summary: LoyaltySummaryDTO = {
    members: all.length, inactive: dormant.length, inactiveMonths: program.scoring.inactiveMonths,
    inactivePreview: dormant.slice(0, 6).map((m) => ({ patientId: m.patientId, name: m.name, lastActivity: m.lastActivity, daysQuiet: m.lastActivity ? diffDays(m.lastActivity, localDate()) : 0, rankName: m.rankName, color: m.color })),
    referrals: all.reduce((n, m) => n + m.referredCount, 0), families: all.filter((m) => m.familyCount > 0).length,
    byRank: [...program.ranks].sort((a, b) => a.minPoints - b.minPoints).map((r) => ({ key: r.key, name: r.name, color: r.color, count: all.filter((m) => m.rankKey === r.key).length })),
  };
  return { summary, members: filtered.slice((page - 1) * pageSize, page * pageSize).map(strip), total: filtered.length };
}

export async function getMember(patientId: number, actor: Session): Promise<LoyaltyDetailDTO> {
  requireHospitalId(actor);
  const patient = await patientsRepo.getRow(patientId);
  assertOwnedByHospital(patient, actor, "Patient");
  const [program, facts] = await Promise.all([getProgram(actor), loadFacts(actor)]);
  const member = compute(facts, program).get(patientId);
  if (!member) throw new NotFoundError("Patient");
  return member;
}

/** Every "referred by" and "family of" link recorded on an appointment, newest first. */
export async function listLinks(actor: Session): Promise<LoyaltyLinkDTO[]> {
  requireHospitalId(actor);
  const facts = await loadFacts(actor);
  const nameOf = new Map(facts.patients.map((p) => [p.id, p.name] as const));
  const out: LoyaltyLinkDTO[] = [];
  const seen = new Set<string>();
  for (const a of [...facts.appts].sort((x, y) => y.appointment_date.localeCompare(x.appointment_date))) {
    if (a.patient_id === null) continue;
    for (const [kind, other, label] of [["referral", a.referred_by_patient_id ?? null, a.referred_by_name], ["family", a.family_of_patient_id ?? null, a.family_of_name]] as const) {
      if (other === null || other === a.patient_id) continue;
      const k = `${kind}:${a.patient_id}:${other}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ appointmentId: a.id, date: a.appointment_date, kind, patientId: a.patient_id, patientName: nameOf.get(a.patient_id) ?? a.patient_name, otherId: other, otherName: nameOf.get(other) ?? label ?? "Former patient", relation: kind === "family" ? a.family_relation ?? "" : "" });
    }
  }
  return out.slice(0, 300);
}

/** The card a patient holds and what it does to their prices; a patient with no card (or an inactive one) is priced as usual. */
export async function getPricing(patientId: number, actor: Session): Promise<LoyaltyPricingDTO> {
  const none: LoyaltyPricingDTO = { enrolled: false, rankKey: null, rankName: "", color: "#9aa5b1", status: "Active", opdFee: 0, erFee: 0, discounts: { lab: 0, pharmacy: 0, radiology: 0, ipd: 0 } };
  requireHospitalId(actor);
  const program = await getProgram(actor);
  if (!program.enabled) return none;
  const member = await getMember(patientId, actor);
  const rank = program.ranks.find((r) => r.key === member.rankKey)!;
  return { enrolled: true, rankKey: rank.key, rankName: rank.name, color: rank.color, status: member.status, opdFee: rank.opdFee, erFee: rank.erFee, discounts: rank.discounts };
}

// ── Points by hand ──────────────────────────────────────────────────────────────────────────────────────────────────────

export async function adjustPoints(patientId: number, input: unknown, actor: Session): Promise<LoyaltyDetailDTO> {
  const hospitalId = requireHospitalId(actor);
  const patient = await patientsRepo.getRow(patientId);
  assertOwnedByHospital(patient, actor, "Patient");
  const body = isRecord(input) ? input : {};
  const points = Number(body.points);
  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 10_000) throw new BadRequestError("Points must be a whole number, not zero, up to 10,000.");
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "";
  if (reason.length < 3) throw new BadRequestError("Say why the points are being changed.");
  const row = await loyaltyAdjustmentsRepo.create({ hospital_id: hospitalId, patient_id: patientId, points, reason, by_user_id: actor.userId, by_name: actor.name });
  await audit(actor, "create", "loyalty_adjustment", row.id, { patientId, points, reason });
  return getMember(patientId, actor);
}
