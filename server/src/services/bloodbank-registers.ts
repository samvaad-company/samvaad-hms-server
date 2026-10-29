/**
 * The statutory blood bank registers (Drugs & Cosmetics Act / NBTC), as plain rows. They are worked out from the
 * records alone — same data, same register — so the printed copy is reproducible for any date.
 */
import { bloodDonorsRepo, bloodUnitsRepo, bloodTransfusionsRepo } from "@/repositories";
import { toBloodDonorDTO } from "@/repositories/mappers";
import { ValidationError } from "@/lib/errors";
import { localDate, TZ } from "@/lib/clock";
import { type Session } from "@/auth/session";
import { scopeToHospital } from "@/services/hospital-scope";
import { SEROLOGY_TESTS, type BloodRegisterDTO } from "@shared/types/api";

export const REGISTER_KINDS = ["donor", "stock", "issue", "discard", "serology"] as const;
type Kind = (typeof REGISTER_KINDS)[number];

const TITLES: Record<Kind, string> = {
  donor: "Blood Donor Register",
  stock: "Blood Stock Register",
  issue: "Issue Register",
  discard: "Discard / Wastage Register",
  serology: "Serology Register",
};

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ });
const dateTime = (iso: string) => `${localDate(new Date(iso))} ${time(iso)}`;

export async function getRegister(kind: string, date: string | undefined, actor: Session): Promise<BloodRegisterDTO> {
  if (!(REGISTER_KINDS as readonly string[]).includes(kind)) throw new ValidationError([{ field: "kind", message: `must be one of ${REGISTER_KINDS.join(", ")}` }]);
  const day = date ?? localDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new ValidationError([{ field: "date", message: "must be a date (yyyy-mm-dd)" }]);
  const k = kind as Kind;
  const base = { kind: k, title: TITLES[k], date: day } as const;
  const scope = scopeToHospital({ unpaged: true }, actor);

  if (k === "donor") {
    const { rows } = await bloodDonorsRepo.listRows(scope);
    const sameDay = rows.filter((d) => d.created_at && localDate(new Date(d.created_at)) === day);
    return {
      ...base,
      columns: ["Donor", "Donor no", "Group", "Gender", "Mobile", "Donations"],
      rows: sameDay.map((d) => { const x = toBloodDonorDTO(d); return [x.name, x.donorNo, x.bloodGroup, x.gender, x.phone, String(x.totalDonations)]; }),
    };
  }

  if (k === "issue") {
    const { rows } = await bloodTransfusionsRepo.listRows(scope);
    return {
      ...base,
      columns: ["Issue no", "Time", "Patient", "Unit", "Group", "Component", "Transfusion", "Disposition"],
      rows: rows
        .filter((t) => localDate(new Date(t.issued_at)) === day)
        .sort((a, b) => a.issued_at.localeCompare(b.issued_at))
        .map((t) => [t.issue_no, time(t.issued_at), `${t.patient_name}${t.patient_code ? ` (${t.patient_code})` : ""}`, t.unit_no, t.unit_group, t.unit_component,
          t.transfused_at ? `done ${dateTime(t.transfused_at)}` : "pending", t.disposition || "-"]),
    };
  }

  const { rows: units } = await bloodUnitsRepo.listRows(scope);
  if (k === "stock") {
    return {
      ...base,
      columns: ["Unit", "Group", "Component", "Vol (ml)", "Collected", "Expiry", "Serology", "Status"],
      rows: units
        .filter((u) => u.collected_on <= day && (!u.left_on || u.left_on > day))
        .sort((a, b) => a.blood_group.localeCompare(b.blood_group) || a.expiry_on.localeCompare(b.expiry_on))
        .map((u) => {
          const reactive = SEROLOGY_TESTS.filter((t) => u.serology?.[t.key] === "Reactive").map((t) => t.label);
          const done = SEROLOGY_TESTS.every((t) => u.serology?.[t.key] === "Negative" || u.serology?.[t.key] === "Reactive");
          return [u.unit_no, u.blood_group, u.component, String(Number(u.volume_ml)), u.collected_on, u.expiry_on,
            reactive.length ? `Reactive: ${reactive.join(", ")}` : done ? "Clear" : "Pending", u.expiry_on < day ? "Expired" : u.status];
        }),
    };
  }
  if (k === "discard") {
    return {
      ...base,
      columns: ["Unit", "Group", "Component", "Vol (ml)", "Reason", "By"],
      rows: units
        .filter((u) => u.status === "Discarded" && u.left_on === day)
        .sort((a, b) => a.unit_no.localeCompare(b.unit_no))
        .map((u) => [u.unit_no, u.blood_group, u.component, String(Number(u.volume_ml)), u.discard_reason, u.discarded_by ?? ""]),
    };
  }
  // serology: one line per donation tested that day — a result recorded on a component stands for the whole donation,
  // and is listed under the donation's original unit number
  const byId = new Map(units.map((u) => [u.id, u]));
  const seen = new Set<number>();
  const tested = units
    .filter((u) => u.serology_on === day)
    .sort((a, b) => a.id - b.id)
    .filter((u) => { const root = u.root_unit_id ?? u.id; if (seen.has(root)) return false; seen.add(root); return true; });
  return {
    ...base,
    columns: ["Unit", "Group", ...SEROLOGY_TESTS.map((t) => t.label), "Outcome", "By"],
    rows: tested
      .map((u) => ({ u, root: byId.get(u.root_unit_id ?? u.id) ?? u }))
      .sort((a, b) => a.root.unit_no.localeCompare(b.root.unit_no))
      .map(({ u, root }) => [root.unit_no, u.blood_group, ...SEROLOGY_TESTS.map((t) => u.serology?.[t.key] || "-"),
        SEROLOGY_TESTS.some((t) => u.serology?.[t.key] === "Reactive") ? "Discarded" : "Cleared", u.serology_by ?? ""]),
  };
}
