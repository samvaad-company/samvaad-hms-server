/**
 * Document numbers from the hospital's ID formats (Setup → ID formats).
 *
 * A format is a mask like `ADM/{YYYY}/{SEQ:5}`. The next number is found the same way the old generators did it: look at the
 * numbers already issued, keep those that fit the mask in the current period, and add one to the highest counter. Nothing extra
 * is stored, so a number can never be handed out twice, and changing a mask simply starts a new series.
 *
 * How the counter resets follows the format's "Counter resets" choice: tokens that change within the reset period must match
 * today's value, finer or coarser ones may differ. (Series scope "Per branch" can't be told apart — records carry no branch — so
 * every series is per hospital.)
 */
import { LIVE_ID_FORMATS, formatIdPreview } from "@shared/types/setup";
import { type Session } from "@/auth/session";
import { nextCode } from "@/services/helpers";
import { getConfig, listSetup } from "@/services/setup-service";

export { LIVE_ID_FORMATS };
export type IdKey = (typeof LIVE_ID_FORMATS)[number];

export interface IdContext {
  /** The date the number is for (defaults to today). */
  now?: Date;
  /** "Male" / "Female" / other — fills {GENDER}. */
  gender?: string;
}

interface Legacy { prefix: string; pad: number }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

const FY_TOKENS = ["FY", "FY2", "FYE", "FYP2"];
const YEAR_TOKENS = ["YYYY", "YY"];

/** Whether a period token must equal today's value for numbers to belong to the current series. */
function mustMatch(token: string, reset: string): boolean {
  if (reset === "Every FY") return FY_TOKENS.includes(token);
  if (reset === "Every year") return YEAR_TOKENS.includes(token);
  if (reset === "Every month") return FY_TOKENS.includes(token) || YEAR_TOKENS.includes(token) || token === "MM";
  return false; // Never
}

/** A pattern for one mask: group 1 captures the counter. Period tokens that needn't match accept any value of their shape. */
export function seriesPattern(mask: string, o: { prefix: string; reset: string; fyStartMonth: number; luhn: boolean; now: Date }): RegExp {
  const today = (token: string) => formatIdPreview(`{${token}}`, { fyStartMonth: o.fyStartMonth, now: o.now });
  const wild: Record<string, string> = { FY: "\\d{4}", FY2: "\\d{2}", FYE: "\\d{4}", FYP2: "\\d{2}-\\d{2}", YYYY: "\\d{4}", YY: "\\d{2}", MM: "\\d{2}" };
  let counted = false;
  let out = "";
  let last = 0;
  for (const m of mask.matchAll(/\{([A-Z0-9]+)(?::(\d{1,2}))?\}/g)) {
    out += escape(mask.slice(last, m.index));
    last = m.index + m[0].length;
    const [, token, width] = m;
    if (token === "SEQ") {
      const body = width ? `\\d{${width},}` : "\\d+";
      out += counted ? body : `(${body})`;
      counted = true;
    } else if (token === "PREFIX") out += escape(o.prefix);
    else if (token === "GENDER") out += "[MFO]";
    else if (token === "CHECK") out += "\\d";
    else out += mustMatch(token, o.reset) ? escape(today(token)) : (wild[token] ?? ".+?");
  }
  out += escape(mask.slice(last));
  if (o.luhn && !mask.includes("{CHECK}")) out += "\\d";
  return new RegExp(`^${out}$`);
}

async function loadFormat(key: IdKey, actor: Session) {
  const rec = (await listSetup("id_format", actor)).find((f) => f.code === key);
  return rec && rec.active ? rec : null;
}

/**
 * The next number for `key`. `existing` is every number already issued in that series. Without a usable format (deleted or
 * switched off in Setup) the old fixed prefix and width are used, so numbering never stops.
 */
export async function nextNumber(key: IdKey, actor: Session, existing: string[], legacy: Legacy, ctx: IdContext = {}): Promise<string> {
  const rec = await loadFormat(key, actor);
  if (!rec) return nextCode(existing, legacy.prefix, legacy.pad);
  const mask = String(rec.data.mask ?? "");
  const hospital = await getConfig("hospital", actor);
  const fyStartMonth = Number(hospital.fyStartMonth) || 4;
  const now = ctx.now ?? new Date();
  // The hospital-wide invoice prefix (Hospital setup) wins over the format's own for the invoice series.
  const hospitalPrefix = key === "invoice" ? String(hospital.invoicePrefix ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) : "";
  const prefix = hospitalPrefix || String(rec.data.prefix ?? "");
  const luhn = rec.data.luhn === true;
  const reset = String(rec.data.reset ?? "Never");
  const pattern = seriesPattern(mask, { prefix, reset, fyStartMonth, luhn, now });
  let max = 0;
  for (const no of existing) {
    const n = Number(pattern.exec(no ?? "")?.[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  const gender = rec.data.gender === true || mask.includes("{GENDER}")
    ? (/^f/i.test(ctx.gender ?? "") ? "F" : /^m/i.test(ctx.gender ?? "") ? "M" : ctx.gender ? "O" : "M")
    : undefined;
  return formatIdPreview(mask, { prefix, seq: max + 1, luhn, gender, fyStartMonth, now });
}
