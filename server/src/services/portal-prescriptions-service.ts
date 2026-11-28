/**
 * Patient portal: the patient's prescriptions, as the data for the "half prescription" (the patient copy).
 *
 * What leaves the HMS: the doctor, the patient, allergies, vitals, the diagnosis, the doctor's remarks, the medicines with their
 * directions already worded in the chosen language, the follow-up date, and the hospital's letterhead built from text and a logo.
 * What never leaves: the chief complaint, the history, the examination findings, investigations, advice notes, any AI review, and the
 * letterhead PHOTO (letterhead_url). Draft prescriptions are not shown.
 *
 * DECISION (spec A2.3): no server-made PDF. The HMS has no server-side HTML-to-PDF and adding a headless browser for this is not worth it;
 * the portal draws the page from this payload and makes the PDF itself.
 */
import { doctorsRepo, hospitalsRepo, medicinesRepo, prescriptionItemsRepo, prescriptionsRepo } from "@/repositories";
import { type PrescriptionItemRow, type PrescriptionRow } from "@/db/tables";
import { NotFoundError } from "@/lib/errors";
import { type Lang, LANGS, durationLabel, remarksOf, timingLabel, toPattern } from "@shared/lib/prescriptions/remarks";
import { assertPatientRecord, dayOf, portalPatient, slicePage } from "@/services/portal-common";

const text = (v: unknown, max = 400): string => String(v ?? "").trim().slice(0, max);
const lines = (v: unknown): string[] => text(v, 2000).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const semi = (v: unknown): string[] => text(v, 2000).split(";").map((x) => x.trim()).filter(Boolean);

/** Prescriptions the patient may see: not a draft. */
const shown = (r: PrescriptionRow) => r.status !== "Draft";

export async function portalPrescriptions(patientId: number, page: number, pageSize: number) {
  const patient = await portalPatient(patientId);
  const { rows } = await prescriptionsRepo.listRows({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patient.id }] } as never);
  const mine = (rows as PrescriptionRow[]).filter((r) => r.hospital_id === patient.hospital_id && shown(r)).sort((a, b) => b.id - a.id);
  return slicePage(mine, page, pageSize).map((r) => ({
    id: r.id, rxNumber: r.rx_number, date: dayOf(r.created_at), doctorName: r.doctor, diagnosis: r.diagnosis, medicineCount: r.medicine_count, language: r.language ?? "English",
  }));
}

/** The letterhead built from a logo and text (saved as JSON on the hospital); { enabled: false } when there is none. */
function letterheadOf(raw: string | null | undefined) {
  if (!raw) return { enabled: false };
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (d.enabled !== true) return { enabled: false };
    const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => text(x, 200)).filter(Boolean) : []);
    return {
      enabled: true,
      logo: typeof d.logo === "string" && d.logo.startsWith("data:image/") ? d.logo : "",
      name: text(d.name, 160), tagline: text(d.tagline, 160),
      useDoctorName: d.useDoctorName !== false, leftLines: list(d.leftLines), footerLines: list(d.footerLines),
      accent: typeof d.accent === "string" && /^#[0-9a-f]{6}$/i.test(d.accent) ? d.accent : "#c0392b", watermark: d.watermark !== false,
    };
  } catch { return { enabled: false }; }
}

const bmi = (w: string, h: string): string => {
  const kg = Number(w), cm = Number(h);
  return kg > 0 && cm > 0 ? (kg / ((cm / 100) ** 2)).toFixed(1) : "";
};

export async function portalPrescription(id: number, patientId: number, rawLang: unknown) {
  const patient = await portalPatient(patientId);
  const rx = assertPatientRecord(await prescriptionsRepo.getRow(id) as PrescriptionRow | null, patient, "Prescription");
  if (!shown(rx)) throw new NotFoundError("Prescription");
  const lang = (LANGS as string[]).includes(String(rawLang)) ? (rawLang as Lang) : (LANGS as string[]).includes(String(rx.language)) ? (rx.language as Lang) : "English";
  const { rows } = await prescriptionItemsRepo.listRows({ unpaged: true, filters: [{ column: "prescription_id", op: "eq", value: rx.id }] } as never);
  const items = (rows as PrescriptionItemRow[]).filter((i) => text(i.medicine_name)).sort((a, b) => a.id - b.id);
  const generics = new Map<number, string>();
  for (const mid of new Set(items.map((i) => i.medicine_id).filter((v): v is number => v != null))) {
    const m = await medicinesRepo.getRow(mid);
    if (m?.generic) generics.set(mid, m.generic);
  }
  const hospital = await hospitalsRepo.getRow(rx.hospital_id);
  const doctor = rx.doctor_id != null ? await doctorsRepo.getRow(rx.doctor_id) : null;
  const c = (rx.consultation ?? {}) as Record<string, unknown>;
  const v = (c.vitals ?? {}) as Record<string, unknown>;
  const [pulse, spo2, bp, temp, weight, height] = ["pulse", "spo2", "bp", "temp", "weight", "height"].map((k) => text(v[k], 20));
  const vitals = [
    pulse && `PULSE RATE - ${pulse}/min`, spo2 && `PERIPHERAL OXYGEN SATURATION - ${spo2}%`, bp && `BLOOD PRESSURE - ${bp}mmHg`,
    temp && `TEMPERATURE - ${temp}°F`, weight && `WEIGHT - ${weight}kg`, height && `HEIGHT - ${height}cm`, bmi(weight, height) && `BMI - ${bmi(weight, height)}`,
  ].filter(Boolean).join(" | ");
  const history = Array.isArray(c.patientHistory) ? (c.patientHistory as { type?: unknown; text?: unknown }[]) : [];
  const allergies = [...new Set([
    ...text(patient.allergies, 500).split(",").map((a) => a.trim()).filter(Boolean),
    ...history.filter((h) => h.type === "Allergy").map((h) => text(h.text, 120)).filter(Boolean),
  ])];
  const followUp = /^\d{4}-\d{2}-\d{2}$/.test(String(c.followUp ?? "")) ? String(c.followUp) : "";
  return {
    id: rx.id, rxNumber: rx.rx_number, date: dayOf(rx.created_at), createdAt: rx.created_at, language: lang,
    doctor: { name: rx.doctor, specialty: doctor?.specialty ?? "", phone: null as string | null },
    patient: { name: patient.name, age: rx.patient_age, gender: patient.gender ?? "", uhid: patient.patient_code ?? "", phone: patient.phone ?? "" },
    allergies,
    vitals,
    diagnosis: [...semi(rx.diagnosis), ...semi(c.secondaryDiagnosis).map((d) => `${d} (secondary)`)],
    remarks: lines(c.remarks),
    items: items.map((i) => {
      const r = remarksOf({ dosage: i.dosage, frequency: i.frequency, timing: i.timing, duration: i.duration, instructions: i.instructions }, lang);
      return {
        name: i.medicine_name, generic: i.medicine_id != null ? generics.get(i.medicine_id) ?? null : null, quantity: text(i.quantity, 40),
        pattern: toPattern(i.frequency), timing: timingLabel(i.timing, lang), duration: durationLabel(i.duration, lang),
        directions: r.line, special: r.special,
      };
    }),
    followUp,
    letterhead: letterheadOf((hospital as { letterhead_design?: string | null } | null)?.letterhead_design),
    hospital: { name: hospital?.name ?? "", address: [hospital?.address, hospital?.city, hospital?.state, hospital?.pincode].filter(Boolean).join(", "), phone: hospital?.phone ?? "" },
  };
}
