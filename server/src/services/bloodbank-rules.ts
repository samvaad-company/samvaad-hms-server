/**
 * The fixed rules of the blood bank: how long each component keeps, who may receive what, and a per-unit lock.
 */
import { BLOOD_COMPONENTS, type BloodComponent } from "@shared/types/api";

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

/** Storage life from collection, in days, and the usual volume, for each component. */
export const COMPONENT_RULES: Record<BloodComponent, { shelfDays: number; defaultVolumeMl: number }> = {
  "Whole blood": { shelfDays: 35, defaultVolumeMl: 350 },
  PRBC: { shelfDays: 42, defaultVolumeMl: 280 },
  Platelets: { shelfDays: 5, defaultVolumeMl: 60 },
  Plasma: { shelfDays: 365, defaultVolumeMl: 200 },
  Cryoprecipitate: { shelfDays: 365, defaultVolumeMl: 20 },
};

export const COMPONENT_LIST = BLOOD_COMPONENTS;

/** What a whole blood unit separates into, with each product's share of the parent volume (or a fixed volume). */
export const SEPARABLE: Record<string, (parentMl: number) => number> = {
  PRBC: (ml) => Math.round(ml * 0.65),
  Platelets: () => 60,
  Plasma: (ml) => Math.round(ml * 0.5),
};

export const DISCARD_REASONS = [
  "Expired",
  "Reactive serology",
  "Haemolysed / lipaemic",
  "Clotted",
  "Bag leak or damage",
  "Cold chain break",
  "Returned unused — outside window",
  "Other",
] as const;

/** A returned, unopened unit can go back on the shelf only within this long of leaving the fridge. */
export const RESTOCK_WINDOW_MIN = 30;

const split = (g: string) => ({ abo: g.replace(/[+-]$/, ""), rh: g.endsWith("+") ? "+" : "-" });

/**
 * Whether a unit of `unit` group may be given to a patient of `patient` group.
 * Red cells (whole blood, PRBC): the unit's cells must carry no antigen the patient lacks, and an Rh-positive unit
 * must not go to an Rh-negative patient. Plasma works the other way round on ABO. Platelets and cryoprecipitate are
 * not strictly matched. A patient whose group isn't on record can't be checked, so is let through.
 */
export function abCompatible(patient: string | null | undefined, unit: string, component: string): { ok: boolean; reason: string } {
  if (!patient || !/^(A|B|AB|O)[+-]$/.test(patient)) return { ok: true, reason: "" };
  const p = split(patient);
  const u = split(unit);
  if (component === "Whole blood" || component === "PRBC") {
    const aboOk = u.abo === "O" || u.abo === p.abo || p.abo === "AB";
    if (!aboOk) return { ok: false, reason: `${unit} red cells can't be given to a ${patient} patient (ABO)` };
    if (u.rh === "+" && p.rh === "-") return { ok: false, reason: `${unit} red cells can't be given to an Rh-negative ${patient} patient` };
    return { ok: true, reason: "" };
  }
  if (component === "Plasma") {
    const aboOk = u.abo === "AB" || u.abo === p.abo || p.abo === "O";
    return aboOk ? { ok: true, reason: "" } : { ok: false, reason: `${unit} plasma can't be given to a ${patient} patient (ABO)` };
  }
  return { ok: true, reason: "" };
}

const chains = new Map<number, Promise<unknown>>();

/**
 * Run `fn` while holding the lock for every unit in `ids`, so two requests for the same unit are handled one after
 * the other and the second sees what the first did. Locks are per server process.
 */
export async function withUnitLocks<T>(ids: number[], fn: () => Promise<T>): Promise<T> {
  const sorted = [...new Set(ids)].sort((a, b) => a - b); // a fixed order, so two multi-unit requests can't deadlock
  const prior = sorted.map((id) => chains.get(id) ?? Promise.resolve());
  const run = Promise.all(prior.map((p) => p.catch(() => undefined))).then(fn);
  const settled = run.catch(() => undefined);
  for (const id of sorted) chains.set(id, settled);
  try {
    return await run;
  } finally {
    for (const id of sorted) if (chains.get(id) === settled) chains.delete(id);
  }
}
