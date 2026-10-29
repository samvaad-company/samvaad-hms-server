/**
 * Seed data builder.
 *
 * Converts the original frontend sample data into normalized, snake_case rows
 * keyed by table name. Used to populate the in-memory adapter for development
 * and mirrored by the SQL migration seed for Supabase.
 */
import { type Row } from "@/db/adapter";
import { TABLES } from "@/db/tables";
import { randomBytes } from "node:crypto";
import { hashPassword } from "@/auth/password";
import { defaultLocationPlan, rackFor, DEFAULT_FOLDERS, DEFAULT_POLICIES } from "@/services/mrd-defaults";
import { consentForm } from "@shared/types/consent-catalog";
import { DEFAULT_STERILIZERS } from "@shared/types/cssd";
import { DEFAULT_LEAVE_TYPES, DEFAULT_SHIFTS } from "@shared/types/hr";

import { patients as patientsData } from "@/db/sample-data/patients";
import { doctors as doctorsData } from "@/db/sample-data/doctors";
import { appointments as appointmentsData } from "@/db/sample-data/appointments";
import { opdRecords as opdData } from "@/db/sample-data/opd";
import { prescriptions as prescriptionsData } from "@/db/sample-data/prescriptions";
import { pharmacyItems as pharmacyData } from "@/db/sample-data/pharmacy";
import { labTests as labData } from "@/db/sample-data/lab";
import { bills as billsData } from "@/db/sample-data/billing";
import { ipdRecords as ipdData } from "@/db/sample-data/ipd";
import { otRecords as otData } from "@/db/sample-data/ot";
import { beds as bedsData } from "@/db/sample-data/beds";
import { staffMembers as staffData } from "@/db/sample-data/staff";
import { medicines as medicinesData } from "@/db/sample-data/medicines";
import {
  departments as departmentsData,
  adminUsers,
  hospitalSettings,
} from "@/db/sample-data/admin";
import {
  radiologyTests as radiologyData,
  ambulances as ambulancesData,
  ambulanceCalls as ambulanceCallsData,
  birthRecords as birthRecordsData,
  deathRecords as deathRecordsData,
  tpas as tpasData,
  tpaClaims as tpaClaimsData,
  financeIncomes as financeIncomesData,
  financeExpenses as financeExpensesData,
  inventoryItems as inventoryItemsData,
  inventoryIssues as inventoryIssuesData,
} from "@/db/sample-data/modules";
import {
  tasks as tasksData,
  scribeNotes as scribeNotesData,
} from "@/db/sample-data/workflow";

const now = () => new Date().toISOString();

/** Extended clinical detail carried over from the patient detail view. */
const ALLERGIES: Record<number, string[]> = {
  1: ["Penicillin", "Sulfa drugs"],
  3: ["Aspirin"],
  4: ["Latex"],
  5: ["Peanuts", "Shellfish"],
  6: ["Sulfa drugs"],
  8: ["Codeine"],
  9: ["Penicillin"],
  10: ["NSAIDs"],
};
const CHRONIC: Record<number, string[]> = {
  1: ["Migraine"],
  4: ["Asthma"],
  5: ["Hypothyroidism", "Fibromyalgia"],
  6: ["Type 2 Diabetes", "Hypertension"],
  7: ["GERD"],
  9: ["Hypertension", "Hyperlipidaemia"],
  10: ["Chronic Low Back Pain", "Hypertension"],
};
/** Government ABHA (Ayushman Bharat Health Account) numbers on file. */
const ABHA: Record<number, string> = {
  1: "12-3456-7890-1234",
  2: "45-6789-0123-4567",
  5: "98-7654-3210-9876",
  6: "23-4567-8901-2345",
  9: "34-5678-9012-3456",
};

function findDeptId(name: string): number | null {
  const lc = name.toLowerCase();
  const exact = departmentsData.find((d) => d.name.toLowerCase() === lc);
  if (exact) return exact.id;
  const partial = departmentsData.find(
    (d) => d.name.toLowerCase().includes(lc) || lc.includes(d.name.toLowerCase()),
  );
  return partial?.id ?? null;
}

function findDoctorId(name: string): number | null {
  return doctorsData.find((d) => d.name === name)?.id ?? null;
}

function findPatientByName(name: string) {
  return patientsData.find((p) => p.name === name);
}

export async function buildSeed(): Promise<Record<string, Row[]>> {
  const ts = now();

  // ── Departments ──────────────────────────────────────────────────────────
  const departments: Row[] = departmentsData.map((d) => ({
    id: d.id,
    hospital_id: 1,
    name: d.name,
    head: d.head,
    extension: d.ext,
    created_at: ts,
    updated_at: ts,
  }));

  // ── Doctors ──────────────────────────────────────────────────────────────
  const doctors: Row[] = doctorsData.map((d) => ({
    id: d.id,
    hospital_id: 1,
    name: d.name,
    specialty: d.specialty,
    department_id: findDeptId(d.department),
    department: d.department,
    phone: d.phone,
    experience: d.experience,
    patients_today: d.patientsToday,
    status: d.status,
    created_at: ts,
    updated_at: ts,
  }));

  // ── Staff ────────────────────────────────────────────────────────────────
  const staff: Row[] = staffData.map((s) => ({
    id: s.id,
    hospital_id: 1,
    name: s.name,
    role: s.role,
    department_id: findDeptId(s.department),
    department: s.department,
    phone: s.phone,
    email: s.email,
    join_date: s.joinDate,
    status: s.status,
    created_at: ts,
    updated_at: ts,
  }));

  // ── Users (auth) ─────────────────────────────────────────────────────────
  // Every seeded user shares the same development password.
  const defaultHash = await hashPassword("Samvaad@123");
  const users: Row[] = adminUsers.map((u) => ({
    id: u.id,
    hospital_id: 1,
    radiology_center_id: null,
    name: u.name,
    email: u.email,
    password_hash: defaultHash,
    role: u.role,
    department_id: findDeptId(u.department),
    doctor_id: u.doctorId ?? null,
    status: u.status,
    last_login_at: null,
    created_at: ts,
    updated_at: ts,
  }));

  // ── Patients ─────────────────────────────────────────────────────────────
  const patients: Row[] = patientsData.map((p) => ({
    id: p.id,
    hospital_id: 1,
    patient_code: p.patientId ?? `HMS-${String(p.id).padStart(4, "0")}`,
    name: p.name,
    age: p.age,
    gender: p.gender,
    phone: p.phone,
    email: null,
    blood_group: p.bloodGroup ?? null,
    dob: null,
    reason: p.reason,
    doctor_id: findDoctorId(p.doctor),
    doctor: p.doctor,
    status: p.status,
    visit_date: p.date,
    visit_time: p.time,
    address: null,
    city: null,
    state: null,
    pincode: null,
    allergies: (ALLERGIES[p.id] ?? []).join(", ") || null,
    chronic_conditions: (CHRONIC[p.id] ?? []).join(", ") || null,
    abha_id: ABHA[p.id] ?? null,
    emergency_name: null,
    emergency_relation: null,
    emergency_phone: null,
    insurer: null,
    policy_number: null,
    corporate: null,
    created_at: ts,
    updated_at: ts,
  }));

  // ── Appointments ─────────────────────────────────────────────────────────
  const appointments: Row[] = appointmentsData.map((a) => ({
    id: a.id,
    hospital_id: 1,
    patient_id: findPatientByName(a.patientName)?.id ?? null,
    patient_name: a.patientName,
    patient_age: a.patientAge,
    doctor_id: findDoctorId(a.doctor),
    doctor: a.doctor,
    appointment_date: a.date,
    appointment_time: a.time,
    type: a.type,
    reason: a.reason,
    status: a.status,
    created_at: ts,
    updated_at: ts,
  }));

  // ── OPD visits ───────────────────────────────────────────────────────────
  const opdVisits: Row[] = opdData.map((o) => ({
    id: o.id,
    hospital_id: 1,
    token_number: o.tokenNumber,
    appointment_id: null,
    patient_id: findPatientByName(o.patientName)?.id ?? null,
    patient_name: o.patientName,
    patient_age: o.patientAge,
    doctor_id: findDoctorId(o.doctor),
    doctor: o.doctor,
    reason: findPatientByName(o.patientName)?.reason ?? "",
    priority: "Normal",
    vitals_recorded: o.vitalsRecorded,
    bp_systolic: o.vitalsRecorded ? 118 + (o.id % 5) * 4 : null,
    bp_diastolic: o.vitalsRecorded ? 76 + (o.id % 3) * 2 : null,
    pulse: o.vitalsRecorded ? 72 + (o.id % 7) : null,
    temperature: o.vitalsRecorded ? Number((98.4 + (o.id % 3) * 0.4).toFixed(1)) : null,
    spo2: o.vitalsRecorded ? 97 + (o.id % 3) : null,
    wait_time: o.waitTime,
    check_in_time: o.checkInTime,
    status: o.status,
    created_at: ts,
    updated_at: ts,
  }));

  // ── Medicines (catalog) ──────────────────────────────────────────────────
  const medicines: Row[] = medicinesData.map((m) => ({
    id: m.id,
    hospital_id: 1,
    name: m.name,
    generic: m.generic,
    category: m.category,
    default_dosage: m.defaultDosage,
    default_frequency: m.defaultFrequency,
    default_duration: m.defaultDuration,
    unit: m.unit,
    created_at: ts,
    updated_at: ts,
  }));

  // ── Prescriptions + items ────────────────────────────────────────────────
  const prescriptions: Row[] = [];
  const prescriptionItems: Row[] = [];
  let itemId = 1;
  for (const rx of prescriptionsData) {
    prescriptions.push({
      id: rx.id,
      hospital_id: 1,
      rx_number: rx.rxNumber,
      patient_id: findPatientByName(rx.patientName)?.id ?? null,
      patient_name: rx.patientName,
      patient_age: rx.patientAge,
      doctor_id: findDoctorId(rx.doctor),
      doctor: rx.doctor,
      diagnosis: rx.diagnosis,
      medicine_count: rx.medicineCount,
      prescribed_date: rx.date,
      status: rx.status,
      created_at: ts,
      updated_at: ts,
    });
    // Synthesize real line items from the catalog to match the count.
    for (let i = 0; i < rx.medicineCount; i++) {
      const med = medicinesData[(rx.id * 3 + i) % medicinesData.length];
      prescriptionItems.push({
        id: itemId++,
        prescription_id: rx.id,
        medicine_id: med.id,
        medicine_name: med.name,
        dosage: med.defaultDosage,
        frequency: med.defaultFrequency,
        duration: med.defaultDuration,
        instructions: "After food",
        created_at: ts,
      });
    }
  }

  // ── Pharmacy inventory ───────────────────────────────────────────────────
  const pharmacyItems: Row[] = pharmacyData.map((p) => ({
    id: p.id,
    hospital_id: 1,
    name: p.name,
    category: p.category,
    stock: p.stock,
    min_stock: p.minStock,
    expiry_date: p.expiryDate,
    supplier: p.supplier,
    status: p.status,
    unit_price: 4 + ((p.id * 37) % 46) + (p.id % 3) * 0.5,
    created_at: ts,
    updated_at: ts,
  }));

  // ── Lab tests ────────────────────────────────────────────────────────────
  const labTests: Row[] = labData.map((l) => ({
    id: l.id,
    hospital_id: 1,
    patient_id: findPatientByName(l.patientName)?.id ?? null,
    patient_name: l.patientName,
    patient_age: l.patientAge,
    order_number: `LAB-${String(l.id).padStart(4, "0")}`,
    test_name: l.testName,
    requested_by: "",
    doctor_id: null,
    doctor: "",
    // A couple of demo tests carry a doctor-set priority so the worklist tags show up.
    priority: ({ 2: "STAT", 3: "Urgent", 5: "Urgent" } as Record<number, string>)[l.id] ?? "Routine",
    collection_date: "",
    discount: 0,
    sample_status: l.sampleStatus,
    report_status: l.reportStatus,
    test_date: l.date,
    amount: l.amount,
    status: l.status,
    lab_center_id: null,
    created_at: ts,
    updated_at: ts,
  }));

  // ── Bills ────────────────────────────────────────────────────────────────
  const bills: Row[] = billsData.map((b) => ({
    id: b.id,
    hospital_id: 1,
    bill_number: b.billNumber,
    patient_id: findPatientByName(b.patientName)?.id ?? null,
    patient_name: b.patientName,
    type: b.type,
    bill_date: b.date,
    amount: b.amount,
    discount: b.discount,
    gst: b.gst,
    total: b.total,
    status: b.status,
    created_at: ts,
    updated_at: ts,
  }));

  // ── Wards + beds ─────────────────────────────────────────────────────────
  const wardNames = Array.from(new Set(bedsData.map((b) => b.ward)));
  /** Demo bed rates (₹/day) by ward type. */
  const wardRate = (name: string): number => {
    const n = name.toLowerCase();
    if (n.includes("icu")) return 7500;
    if (n.includes("hdu")) return 4500;
    if (n.includes("private")) return 3000;
    if (n.includes("cardio") || n.includes("neuro")) return 4000;
    if (n.includes("surg") || n.includes("ortho") || n.includes("matern")) return 2500;
    return 1200;
  };
  const wards: Row[] = wardNames.map((name, i) => ({
    id: i + 1,
    hospital_id: 1,
    name,
    capacity: bedsData.filter((b) => b.ward === name).length,
    daily_rate: wardRate(name),
    created_at: ts,
    updated_at: ts,
  }));
  const wardId = (name: string) =>
    wards.find((w) => w.name === name)?.id ?? null;

  const beds: Row[] = bedsData.map((b) => ({
    id: b.id,
    hospital_id: 1,
    bed_number: b.bedNumber,
    ward_id: wardId(b.ward) as number | null,
    ward: b.ward,
    patient_id: b.patientName ? (findPatientByName(b.patientName)?.id ?? null) : null,
    patient_name: b.patientName ?? null,
    patient_code: b.patientId ?? null,
    status: b.status,
    created_at: ts,
    updated_at: ts,
  }));

  // ── Bed transfer history ─────────────────────────────────────────────────
  // Oldest first so descending-id listing shows newest transfers on top.
  const bedTransfers: Row[] = [
    { patient: "Olivia Davis",  from: "General Ward · A-11", to: "Surgery Ward · D-01", date: "7 Nov 2025",  reason: "Surgery scheduled",    status: "Pending" },
    { patient: "James Brown",   from: "General Ward · A-03", to: "Cardiology · C-07",   date: "8 Nov 2025",  reason: "Cardiac monitoring",   status: "Completed" },
    { patient: "Emma Williams", from: "Maternity · E-01",    to: "ICU · B-03",          date: "9 Nov 2025",  reason: "Emergency escalation", status: "Completed" },
    { patient: "Liam Johnson",  from: "Surgery Ward · D-03", to: "General Ward · A-08", date: "10 Nov 2025", reason: "Post-op recovery",     status: "Completed" },
    { patient: "Sophia Adams",  from: "General Ward · A-05", to: "Surgery Ward · D-02", date: "11 Nov 2025", reason: "Pre-op preparation",   status: "Completed" },
    { patient: "Noah Carter",   from: "ICU · B-01",          to: "Cardiology · C-04",   date: "12 Nov 2025", reason: "Stable condition",     status: "Completed" },
  ].map((t, i) => ({
    id: i + 1,
    hospital_id: 1,
    patient_name: t.patient,
    from_label: t.from,
    to_label: t.to,
    transfer_date: t.date,
    reason: t.reason,
    status: t.status,
    created_at: ts,
    updated_at: ts,
  }));

  // ── IPD admissions ───────────────────────────────────────────────────────
  const ipdAdmissions: Row[] = ipdData.map((r) => ({
    id: r.id,
    hospital_id: 1,
    patient_id: findPatientByName(r.patientName)?.id ?? null,
    patient_name: r.patientName,
    patient_age: r.patientAge,
    patient_code: r.patientId,
    admission_date: r.admissionDate,
    ward_id: wardId(`${r.ward} Ward`) ?? wardId(r.ward),
    ward: r.ward,
    bed_id: beds.find((b) => b.bed_number === r.bed)?.id ?? null,
    bed: r.bed,
    doctor_id: findDoctorId(r.doctor),
    doctor: r.doctor,
    diagnosis: r.diagnosis,
    credit_limit: r.creditLimit,
    status: r.status,
    admission_no: `ADM/${new Date(r.admissionDate).getFullYear()}/${String(r.id).padStart(5, "0")}`,
    admission_type: r.status === "ICU" ? "Emergency" : "Planned",
    is_mlc: false,
    family_name: "",
    family_relation: "",
    family_phone: "",
    deposit_amount: 0,
    deposit_mode: "",
    primary_nurse_id: null,
    primary_nurse: "",
    expected_stay_days: null,
    diet: "",
    created_at: ts,
    updated_at: ts,
  }));

  // ── Nurse station demo data ──────────────────────────────────────────────
  // Each patient still in hospital gets a couple of orders, a set of vitals (one deliberately out of range)
  // and, for the first, a drip — so the nurse station has something on it from the first launch.
  const inHospital = ipdAdmissions.filter((a) => a.status !== "Discharged");
  const today = new Date().toISOString().slice(0, 10);
  const orders = [
    { name: "Inj. Ceftriaxone", dosage: "1 g", frequency: "BD", route: "IV" },
    { name: "Tab. Paracetamol", dosage: "650 mg", frequency: "TDS", route: "Oral" },
    { name: "Inj. Pantoprazole", dosage: "40 mg", frequency: "OD", route: "IV" },
  ];
  const ipdMedications: Row[] = inHospital.flatMap((a, i) =>
    [orders[i % 3], orders[(i + 1) % 3]].map((o, k) => ({
      id: i * 2 + k + 1,
      admission_id: a.id as number,
      medicine_name: o.name,
      dosage: o.dosage,
      frequency: o.frequency,
      route: o.route,
      start_date: today,
      end_date: "",
      status: "Active",
      last_given_at: "",
      notes: "",
      created_at: ts,
      updated_at: ts,
    })),
  );
  const ipdVitals: Row[] = inHospital.map((a, i) => ({
    id: i + 1,
    hospital_id: 1,
    admission_id: a.id as number,
    recorded_at: ts,
    temp_c: i === 1 ? 39.8 : 37.2,
    pulse: i === 1 ? 118 : 82,
    bp_systolic: 124,
    bp_diastolic: 80,
    spo2: i === 1 ? 88 : 98,
    resp_rate: i === 1 ? 26 : 16,
    note: "",
    recorded_by: "Rekha Menon",
    created_at: ts,
    updated_at: ts,
  }));
  const ipdIvLines: Row[] = inHospital.slice(0, 1).map((a, i) => ({
    id: i + 1,
    hospital_id: 1,
    admission_id: a.id as number,
    fluid: "Normal saline 0.9%",
    volume_ml: 500,
    rate_ml_hr: 100,
    started_at: ts,
    stopped_at: null,
    status: "Running",
    started_by: "Rekha Menon",
    note: "",
    created_at: ts,
    updated_at: ts,
  }));
  const ipdNursingTasks: Row[] = [
    { title: "Check the crash cart", admission_id: null },
    { title: "Change dressing", admission_id: (inHospital[0]?.id as number | undefined) ?? null },
  ].map((t, i) => ({
    id: i + 1,
    hospital_id: 1,
    admission_id: t.admission_id,
    title: t.title,
    due_at: null,
    status: "To do",
    created_by: "Rekha Menon",
    done_by: null,
    done_at: null,
    created_at: ts,
    updated_at: ts,
  }));

  // ── OT schedules ─────────────────────────────────────────────────────────
  const otSchedules: Row[] = otData.map((o) => ({
    id: o.id,
    hospital_id: 1,
    patient_id: findPatientByName(o.patientName)?.id ?? null,
    patient_name: o.patientName,
    procedure: o.procedure,
    ot_room: o.otRoom,
    surgeon_id: findDoctorId(o.surgeon),
    surgeon: o.surgeon,
    anesthetist: o.anesthetist,
    scheduled_date: o.scheduledDate,
    scheduled_time: o.scheduledTime,
    status: o.status,
    created_at: ts,
    updated_at: ts,
  }));

  // ── OT rooms, equipment and a few current bookings ───────────────────────
  const otRooms: Row[] = [
    { name: "Major OT-1", kind: "Major" }, { name: "Major OT-2", kind: "Major" }, { name: "Major OT-3", kind: "Major" }, { name: "Minor OT", kind: "Minor" },
  ].map((r, i) => ({ id: i + 1, hospital_id: 1, ...r, active: true, created_at: ts, updated_at: ts }));
  const otEquipment: Row[] = [
    ["Anaesthesia Workstation (Drager)", "Available"], ["Arthroscopy System", "Available"], ["Boyle's Apparatus", "Available"],
    ["C-Arm Image Intensifier", "Available"], ["Cardiac Monitor (multipara)", "Available"], ["Defibrillator", "Available"],
    ["Electrosurgical Unit / Diathermy", "Maintenance"], ["Harmonic Scalpel Generator", "Available"],
    ["Laparoscopy Tower (Karl Storz)", "Available"], ["Operating Microscope (Zeiss)", "Available"],
  ].map(([name, status], i) => ({ id: i + 1, hospital_id: 1, name, status, note: status === "Maintenance" ? "Under service until further notice" : "", created_at: ts, updated_at: ts }));
  // A few surgeries around today (dates relative to it) so the Day, Week and Register views have something on them.
  const dayOffset = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
  const nextOtId = otSchedules.length + 1;
  const nowOt = [
    { off: 0, time: "09:00", min: 90, room: 1, name: "Laparoscopic Cholecystectomy", cat: "Major", status: "Scheduled", eq: [9, 1], p: 0 },
    { off: 0, time: "11:30", min: 60, room: 2, name: "Knee Arthroscopy", cat: "Major", status: "Scheduled", eq: [2], p: 1 },
    { off: 0, time: "10:00", min: 30, room: 4, name: "Cyst Excision", cat: "Minor", status: "Scheduled", eq: [], p: 2 },
    { off: 1, time: "08:00", min: 120, room: 1, name: "Total Knee Replacement", cat: "Major", status: "Scheduled", eq: [4], p: 3 },
    { off: 2, time: "14:00", min: 75, room: 3, name: "Open Appendectomy", cat: "Major", status: "Scheduled", eq: [], p: 4 },
    { off: -3, time: "09:30", min: 87, room: 1, name: "Open Appendectomy", cat: "Major", status: "Completed", eq: [], p: 5 },
    { off: -4, time: "08:00", min: 110, room: 2, name: "Laparoscopic Cholecystectomy", cat: "Major", status: "Completed", eq: [9], p: 6 },
    { off: -4, time: "12:00", min: 121, room: 3, name: "Total Knee Replacement", cat: "Major", status: "Completed", eq: [4], p: 7 },
  ];
  const otCurrent: Row[] = nowOt.map((o, i) => {
    const pat = patients[o.p % patients.length] as { id: number; name: string };
    const doc = doctors[i % doctors.length] as { id: number; name: string };
    const anaes = doctors[(i + 1) % doctors.length] as { id: number; name: string };
    const start = Date.parse(`${dayOffset(o.off)}T${o.time}:00`);
    const done = o.status === "Completed";
    return {
      id: nextOtId + i,
      hospital_id: 1,
      patient_id: pat.id,
      patient_name: pat.name,
      procedure: o.name,
      surgery_name: o.name,
      case_type: "Elective",
      category: o.cat,
      procedure_code: "",
      ot_room: (otRooms.find((r) => r.id === o.room) as Row).name,
      room_id: o.room,
      duration_min: o.min,
      surgeon_id: doc.id,
      surgeon: doc.name,
      co_surgeon_id: null,
      co_surgeon: "",
      anesthetist_id: anaes.id,
      anesthetist: anaes.name,
      anaesthesia_type: o.cat === "Minor" ? "Local" : "General (GA)",
      scrub_nurse_id: null, scrub_nurse: "", circulating_nurse_id: null, circulating_nurse: "",
      technician_ids: [], technicians: [],
      equipment_ids: o.eq,
      equipment: o.eq.map((e) => (otEquipment.find((x) => x.id === e) as Row).name),
      special_requirements: "",
      allow_overlap: false,
      fitness: done || o.off <= 0 ? "Fit" : "Pending",
      booking_no: `OT/${dayOffset(0).slice(0, 4)}/${String(nextOtId + i).padStart(4, "0")}`,
      scheduled_date: dayOffset(o.off),
      scheduled_time: o.time,
      status: o.status,
      started_at: done ? new Date(start).toISOString() : null,
      ended_at: done ? new Date(start + o.min * 60_000).toISOString() : null,
      created_at: ts,
      updated_at: ts,
    };
  });

  // ── Hospitals ────────────────────────────────────────────────────────────
  // Hospital 1 is today's single tenant, carried over unchanged. Hospital 2
  // is a minimal second tenant that exists only so multi-tenant isolation is
  // actually exercisable in dev, not just correct in theory.
  const hospitals: Row[] = [
    {
      id: 1,
      code: "HOSP-0001",
      status: "Active",
      name: hospitalSettings.name,
      address: hospitalSettings.address,
      city: hospitalSettings.city,
      state: hospitalSettings.state,
      pincode: hospitalSettings.pincode,
      phone: hospitalSettings.phone,
      mobile: hospitalSettings.mobile,
      email: hospitalSettings.email,
      website: hospitalSettings.website,
      gst_number: hospitalSettings.gstNumber,
      pan_number: hospitalSettings.panNumber,
      reg_number: hospitalSettings.regNumber,
      working_hours: hospitalSettings.workingHours,
      updated_at: ts,
    },
    {
      id: 2,
      code: "HOSP-0002",
      status: "Active",
      name: "Sunrise Multispecialty Hospital",
      address: "221 MG Road",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
      phone: "020-2345 6789",
      mobile: "+91 98220 11223",
      email: "contact@sunrisehospital.in",
      website: "www.sunrisehospital.in",
      gst_number: "27SUNRI1234H1Z5",
      pan_number: "SUNRI1234H",
      reg_number: "MH/HOSP/2019/0456",
      working_hours: hospitalSettings.workingHours,
      updated_at: ts,
    },
  ];

  // ── Platform billing ─────────────────────────────────────────────────────
  // A platform admin's own invoices to each hospital tenant for their
  // subscription — separate from a hospital's own patient billing.
  const platformBills: Row[] = [
    {
      id: 1,
      bill_number: "PB-00001",
      hospital_id: 1,
      hospital_name: hospitalSettings.name,
      period: "October 2025",
      amount: 25000,
      gst: 2250,
      total: 27250,
      status: "Paid",
      issued_date: "2025-10-01",
      due_date: "2025-10-10",
      notes: "Monthly platform subscription",
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 2,
      bill_number: "PB-00002",
      hospital_id: 1,
      hospital_name: hospitalSettings.name,
      period: "November 2025",
      amount: 25000,
      gst: 2250,
      total: 27250,
      status: "Pending",
      issued_date: "2025-11-01",
      due_date: "2025-11-10",
      notes: "Monthly platform subscription",
      created_at: ts,
      updated_at: ts,
    },
    {
      id: 3,
      bill_number: "PB-00003",
      hospital_id: 2,
      hospital_name: "Sunrise Multispecialty Hospital",
      period: "September 2025",
      amount: 18000,
      gst: 1620,
      total: 19620,
      status: "Overdue",
      issued_date: "2025-09-01",
      due_date: "2025-09-10",
      notes: "Monthly platform subscription",
      created_at: ts,
      updated_at: ts,
    },
  ];

  // Second tenant's own minimal data — enough to prove list/get/create are
  // hospital-isolated without duplicating the whole fixture set.
  const h2Department: Row = {
    id: 9001,
    hospital_id: 2,
    name: "Radiology",
    head: "Dr. Meera Kulkarni",
    extension: "401",
    created_at: ts,
    updated_at: ts,
  };
  const h2Doctor: Row = {
    id: 9001,
    hospital_id: 2,
    name: "Dr. Meera Kulkarni",
    specialty: "Radiologist",
    department_id: 9001,
    department: "Radiology",
    phone: "+91 98765 43210",
    experience: "12 years",
    patients_today: 0,
    status: "Active",
    created_at: ts,
    updated_at: ts,
  };
  const h2Patient: Row = {
    id: 9001,
    hospital_id: 2,
    patient_code: "HMS2-0001",
    name: "Aarav Deshmukh",
    age: 34,
    gender: "Male",
    phone: "+91 90210 33445",
    email: null,
    blood_group: "B+",
    dob: null,
    reason: "Routine checkup",
    doctor_id: 9001,
    doctor: "Dr. Meera Kulkarni",
    status: "Active",
    visit_date: "12 Nov 2025",
    visit_time: "10:30 AM",
    address: null,
    city: null,
    state: null,
    pincode: null,
    allergies: null,
    chronic_conditions: null,
    abha_id: null,
    emergency_name: null,
    emergency_relation: null,
    emergency_phone: null,
    insurer: null,
    policy_number: null,
    corporate: null,
    created_at: ts,
    updated_at: ts,
  };
  const h2AdminUser: Row = {
    id: 9001,
    hospital_id: 2,
    radiology_center_id: null,
    name: "Sunrise Admin",
    email: "admin@sunrisehospital.in",
    password_hash: defaultHash,
    role: "Super Admin",
    department_id: null,
    doctor_id: null,
    status: "Active",
    last_login_at: null,
    created_at: ts,
    updated_at: ts,
  };
  // One platform-level operator account, scoped to no single hospital's data.
  const platformAdminUser: Row = {
    id: 9000,
    hospital_id: 1,
    radiology_center_id: null,
    name: "Platform Operations",
    email: "platform-admin@samvaad.dev",
    password_hash: defaultHash,
    role: "Platform Admin",
    department_id: null,
    doctor_id: null,
    status: "Active",
    last_login_at: null,
    created_at: ts,
    updated_at: ts,
  };

  // ── Radiology centers ────────────────────────────────────────────────────
  // An independent tenant, not owned by any hospital — its account carries
  // radiology_center_id instead of hospital_id.
  const radiologyCenters: Row[] = [
    {
      id: 1,
      code: "RADC-0001",
      status: "Active",
      name: "Apex Radiology Network",
      address: "48 Link Road",
      city: "Mumbai",
      state: "Maharashtra",
      phone: "+91 22 6789 0123",
      contact_email: "reports@apexradiology.in",
      created_at: ts,
      updated_at: ts,
    },
  ];
  const radiologyCenterUser: Row = {
    id: 9002,
    hospital_id: null,
    radiology_center_id: 1,
    name: "Apex Radiology Network",
    email: "admin@apexradiology.in",
    password_hash: defaultHash,
    role: "Radiology Partner",
    department_id: null,
    doctor_id: null,
    status: "Active",
    last_login_at: null,
    created_at: ts,
    updated_at: ts,
  };

  // ── Lab centers ──────────────────────────────────────────────────────────
  // A second independent tenant type, alongside radiology centers — its
  // account carries lab_center_id instead of hospital_id.
  const labCenters: Row[] = [
    {
      id: 1,
      code: "LABC-0001",
      status: "Active",
      name: "Pathcare Diagnostics",
      address: "12 MG Road",
      city: "Mumbai",
      state: "Maharashtra",
      phone: "+91 22 4567 8901",
      contact_email: "reports@pathcarediagnostics.in",
      created_at: ts,
      updated_at: ts,
    },
  ];
  const labCenterUser: Row = {
    id: 9003,
    hospital_id: null,
    radiology_center_id: null,
    lab_center_id: 1,
    name: "Pathcare Diagnostics",
    email: "admin@pathcarediagnostics.in",
    password_hash: defaultHash,
    role: "Lab Partner",
    department_id: null,
    doctor_id: null,
    status: "Active",
    last_login_at: null,
    created_at: ts,
    updated_at: ts,
  };

  // ── Service modules ──────────────────────────────────────────────────────
  // ── Blood bank ───────────────────────────────────────────────────────────
  // Donors, bags of blood and components in every state (quarantined, available, held for a cross-match, issued,
  // discarded), the cross-matches and the transfusions — dates relative to today, so it always looks current.
  const bbDay = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
  const bbAt = (daysAgo: number, hour: number) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hour, (daysAgo * 7) % 60, 0, 0); return d.toISOString(); };
  let bbSeed = 7;
  const bbRand = () => { bbSeed = (bbSeed * 9301 + 49297) % 233280; return bbSeed / 233280; };
  const bbPick = <T,>(a: readonly T[]): T => a[Math.floor(bbRand() * a.length)];
  const bbYY = bbDay(0).slice(2, 4);
  const bbGroups = ["O+", "O+", "O+", "B+", "B+", "A+", "A+", "AB+", "O-", "A-", "B-", "AB-"] as const;
  const donorNames = ["Vikram Singh", "Anita Deshmukh", "Ravi Patil", "Meera Kulkarni", "Sanjay Gupta", "Pooja Sharma", "Harit Varma", "Bala Gandhi", "Aasha Ahluwalia", "Sukanya Kaur", "Deepan Chattopadhyay",
    "Jagmeet Kaul", "Tejas Guneta", "Ojaswini Agarwal", "Asha Kaul", "Upendra Reddy", "Ganaka Marar", "Vasudev Kakkar", "Niro Guneta", "Dhruv Kakkar", "Charuvrat Kakkar", "Rohana Khan",
    "Navin Namboothiri", "Bhagwati Kapoor", "Akshita Arora", "Kiran Joshi", "Tara Menon", "Imran Qureshi", "Lata Bhosale", "Sunil Yadav"];
  const idProofs = ["aadhaar", "pan", "voter_id", "driving_licence", "passport"] as const;
  const bloodDonors: Row[] = donorNames.map((name, i) => {
    const gender = i % 4 === 3 ? "Female" : i % 3 === 0 ? "Female" : "Male";
    const donations = Math.floor(bbRand() * 14);
    const deferred = i === 8 || i === 9 || i === 24;
    return {
      id: i + 1,
      hospital_id: 1,
      donor_no: `BD/${bbYY}/${String(i + 1).padStart(5, "0")}`,
      name,
      age: 22 + (i % 30),
      gender,
      blood_group: bbGroups[i % bbGroups.length],
      phone: `9${String(100000000 + Math.floor(bbRand() * 899999999))}`,
      dob: bbDay(-365 * (22 + (i % 30)) - 40),
      id_proof_type: idProofs[i % idProofs.length],
      id_proof_last4: String(1000 + Math.floor(bbRand() * 8999)),
      aadhaar_number: "",
      last_donation_date: donations === 0 ? "" : bbDay(-(130 + Math.floor(bbRand() * 260))),
      total_donations: donations,
      status: deferred ? "Deferred" : "Eligible",
      deferral_reason: deferred ? "Low haemoglobin" : "",
      deferred_until: null,
      created_at: ts,
      updated_at: ts,
    };
  });

  const SHELF: Record<string, number> = { "Whole blood": 35, PRBC: 42, Platelets: 5, Plasma: 365, Cryoprecipitate: 365 };
  const VOL: Record<string, number> = { "Whole blood": 350, PRBC: 280, Platelets: 60, Plasma: 200, Cryoprecipitate: 20 };
  const clear = { hiv: "Negative", hbsag: "Negative", hcv: "Negative", malaria: "Negative", syphilis: "Negative" };
  const untested = { hiv: "", hbsag: "", hcv: "", malaria: "", syphilis: "" };
  const bloodUnits: Row[] = [];
  const unitNo = () => `BU/${bbYY}/${String(bloodUnits.length + 1).padStart(5, "0")}`;
  const addUnit = (o: { group: string; component: string; ageDays: number; status: string; donor?: number; serology?: Record<string, string>; reason?: string; parent?: number; vol?: number }) => {
    const id = bloodUnits.length + 1;
    const collected = bbDay(-o.ageDays);
    const d = o.donor ? (bloodDonors[o.donor - 1] as Row) : null;
    bloodUnits.push({
      id, hospital_id: 1, unit_no: unitNo(), source: d ? "Donation" : "Purchased", donor_id: d ? (d.id as number) : null, donor_no: d ? (d.donor_no as string) : "",
      supplier: d ? "" : "City Blood Centre", bag_no: o.parent ? "" : `BAG-${1000 + id}`, blood_group: o.group, component: o.component, volume_ml: o.vol ?? VOL[o.component],
      collected_on: collected, expiry_on: bbDay(-o.ageDays + SHELF[o.component]),
      serology: o.serology ?? (o.status === "Quarantined" ? untested : clear), serology_by: o.status === "Quarantined" ? null : "Rekha Menon", serology_on: o.status === "Quarantined" ? null : collected,
      status: o.status, root_unit_id: o.parent ? ((bloodUnits[o.parent - 1] as Row).root_unit_id as number) : id, parent_unit_id: o.parent ?? null,
      left_on: ["Issued", "Processed", "Discarded"].includes(o.status) ? bbDay(-Math.max(0, o.ageDays - 1)) : null,
      discard_reason: o.reason ?? "", discarded_by: o.status === "Discarded" ? "Rekha Menon" : null, created_by: "Rekha Menon", created_at: ts, updated_at: ts,
    });
    return id;
  };
  // Usable stock, some of it close to expiry
  for (let i = 0; i < 34; i++) {
    const component = i % 9 === 0 ? "Platelets" : i % 4 === 0 ? "PRBC" : i % 11 === 0 ? "Plasma" : "Whole blood";
    const life = SHELF[component];
    const age = component === "Platelets" ? Math.floor(bbRand() * 3) : Math.floor(bbRand() * Math.min(life - 8, 26)) + (i % 5 === 0 ? Math.max(0, life - 7 - 4) : 0);
    addUnit({ group: bbPick(bbGroups), component, ageDays: Math.min(age, life - 1), status: "Available", donor: (i % donorNames.length) + 1 });
  }
  addUnit({ group: "O+", component: "Whole blood", ageDays: 40, status: "Available", donor: 3 }); // expired, still on the shelf
  addUnit({ group: "B+", component: "Platelets", ageDays: 9, status: "Available", donor: 5 });
  for (let i = 0; i < 4; i++) addUnit({ group: bbPick(bbGroups), component: "Whole blood", ageDays: i, status: "Quarantined", donor: 10 + i });
  const parentWb = addUnit({ group: "A+", component: "Whole blood", ageDays: 3, status: "Processed", donor: 12 });
  addUnit({ group: "A+", component: "PRBC", ageDays: 3, status: "Available", parent: parentWb });
  addUnit({ group: "A+", component: "Plasma", ageDays: 3, status: "Available", parent: parentWb });
  for (const [g, reason, ser] of [["B+", "Reactive serology: HIV", { ...clear, hiv: "Reactive" }], ["O+", "Expired", undefined], ["A+", "Bag leak or damage", undefined], ["O+", "Cold chain break", undefined]] as const) {
    addUnit({ group: g, component: "PRBC", ageDays: 12, status: "Discarded", donor: 14, serology: ser as Record<string, string> | undefined, reason });
  }
  // Issued units, each with its cross-match and transfusion
  const bloodCrossmatches: Row[] = [];
  const bloodTransfusions: Row[] = [];
  const xmNo = () => `XM/${bbYY}/${String(bloodCrossmatches.length + 1).padStart(5, "0")}`;
  const patientRow = (i: number) => patients[i % patients.length] as Row;
  const addXm = (unitId: number, patientIdx: number, result: string, status: string, daysAgo: number) => {
    const u = bloodUnits[unitId - 1] as Row; const p = patientRow(patientIdx);
    const id = bloodCrossmatches.length + 1;
    bloodCrossmatches.push({
      id, hospital_id: 1, xm_no: xmNo(), patient_id: p.id as number, patient_name: p.name as string, patient_code: (p.patient_code as string) ?? "",
      unit_id: unitId, unit_no: u.unit_no as string, unit_group: u.blood_group as string, unit_component: u.component as string,
      requested_at: bbAt(daysAgo, 9), requested_by: "Rekha Menon", result, result_by: result === "pending" ? null : "Rekha Menon", result_at: result === "pending" ? null : bbAt(daysAgo, 10),
      status, created_at: ts, updated_at: ts,
    });
    return id;
  };
  for (let i = 0; i < 9; i++) {
    const unitId = addUnit({ group: bbPick(["O+", "A+", "B+"] as const), component: i % 3 === 0 ? "PRBC" : "Whole blood", ageDays: 6 + i, status: "Issued", donor: 15 + i });
    const xm = addXm(unitId, i, "compatible", "issued", 5 + i);
    const u = bloodUnits[unitId - 1] as Row; const p = patientRow(i);
    const returned = i === 7;
    bloodTransfusions.push({
      id: bloodTransfusions.length + 1, hospital_id: 1, issue_no: `BI/${bbYY}/${String(bloodTransfusions.length + 1).padStart(5, "0")}`, crossmatch_id: xm,
      patient_id: p.id as number, patient_name: p.name as string, patient_code: (p.patient_code as string) ?? "", unit_id: unitId, unit_no: u.unit_no as string,
      unit_group: u.blood_group as string, unit_component: u.component as string, issued_at: bbAt(5 + i, 11), issued_by: "Rekha Menon",
      transfused_at: returned ? null : bbAt(5 + i, 14), transfused_by: returned ? null : "Rekha Menon", disposition: returned ? "returned · wasted" : "", returned_at: returned ? bbAt(5 + i, 13) : null,
      reactions: i === 2 ? [{ at: bbAt(5 + i, 15), by: "Rekha Menon", kind: "Febrile non-haemolytic", severity: "Mild", note: "Settled with paracetamol" }] : [],
      created_at: ts, updated_at: ts,
    });
    if (returned) { u.status = "Discarded"; u.discard_reason = "Returned unused — outside window"; }
  }
  // Open cross-matches: one waiting for its result, one compatible and ready to issue, one incompatible (unit released)
  const xmUnits = [addUnit({ group: "O+", component: "Whole blood", ageDays: 5, status: "Cross-matched", donor: 26 }), addUnit({ group: "B+", component: "PRBC", ageDays: 4, status: "Cross-matched", donor: 27 })];
  addXm(xmUnits[0], 9, "pending", "requested", 0);
  addXm(xmUnits[1], 3, "compatible", "resulted", 0);
  addXm(addUnit({ group: "A+", component: "PRBC", ageDays: 6, status: "Available", donor: 28 }), 4, "incompatible", "resulted", 1);

  const radiologyTests: Row[] = radiologyData.map((r) => ({
    id: r.id,
    hospital_id: 1,
    order_number: `RAD-${String(r.id).padStart(4, "0")}`,
    patient_id: findPatientByName(r.patientName)?.id ?? null,
    patient_name: r.patientName,
    patient_age: r.patientAge,
    test_name: r.testName,
    scan_status: r.scanStatus,
    report_status: r.reportStatus,
    test_date: r.date,
    amount: r.amount,
    // A few demo studies carry a doctor-set priority so the worklist tags show up.
    priority: ({ 2: "STAT", 3: "Urgent", 5: "Urgent" } as Record<number, string>)[r.id] ?? "Routine",
    status: r.status,
    created_at: ts,
    updated_at: ts,
  }));

  const ambulances: Row[] = ambulancesData.map((a) => ({
    id: a.id,
    hospital_id: 1,
    vehicle_number: a.vehicleNumber,
    model: a.model,
    driver_name: a.driverName,
    driver_phone: a.driverPhone,
    status: a.status,
    created_at: ts,
    updated_at: ts,
  }));

  const ambulanceCalls: Row[] = ambulanceCallsData.map((c) => ({
    id: c.id,
    hospital_id: 1,
    patient_name: c.patientName,
    phone: c.phone,
    pickup_location: c.pickupLocation,
    drop_location: c.dropLocation,
    ambulance_id: c.ambulanceId,
    vehicle_number: c.vehicleNumber,
    driver_name: c.driverName,
    call_date: c.date,
    call_time: c.time,
    amount: c.amount,
    status: c.status,
    created_at: ts,
    updated_at: ts,
  }));

  const birthRecords: Row[] = birthRecordsData.map((b) => ({
    id: b.id,
    hospital_id: 1,
    child_name: b.childName,
    gender: b.gender,
    birth_date: b.date,
    birth_time: b.time,
    weight_kg: b.weightKg,
    mother_name: b.motherName,
    father_name: b.fatherName,
    phone: b.phone,
    address: b.address,
    created_at: ts,
    updated_at: ts,
  }));

  const deathRecords: Row[] = deathRecordsData.map((d) => ({
    id: d.id,
    hospital_id: 1,
    deceased_name: d.deceasedName,
    gender: d.gender,
    age: d.age,
    death_date: d.date,
    death_time: d.time,
    guardian_name: d.guardianName,
    cause: d.cause,
    phone: d.phone,
    address: d.address,
    created_at: ts,
    updated_at: ts,
  }));

  const tpas: Row[] = tpasData.map((t) => ({
    id: t.id,
    hospital_id: 1,
    name: t.name,
    code: t.code,
    contact_person: t.contactPerson,
    phone: t.phone,
    email: t.email,
    address: t.address,
    status: t.status,
    created_at: ts,
    updated_at: ts,
  }));

  const tpaClaims: Row[] = tpaClaimsData.map((c) => ({
    id: c.id,
    hospital_id: 1,
    tpa_id: c.tpaId,
    tpa_name: c.tpaName,
    patient_id: findPatientByName(c.patientName)?.id ?? null,
    patient_name: c.patientName,
    bill_number: c.billNumber,
    claim_amount: c.claimAmount,
    approved_amount: c.approvedAmount,
    claim_date: c.date,
    status: c.status,
    created_at: ts,
    updated_at: ts,
  }));

  const financeEntry = (e: (typeof financeIncomesData)[number]): Row => ({
    id: e.id,
    hospital_id: 1,
    category: e.category,
    description: e.description,
    invoice_number: e.invoiceNumber,
    amount: e.amount,
    entry_date: e.date,
    created_at: ts,
    updated_at: ts,
  });
  const financeIncomes: Row[] = financeIncomesData.map(financeEntry);
  const financeExpenses: Row[] = financeExpensesData.map(financeEntry);

  const inventoryItems: Row[] = inventoryItemsData.map((i) => ({
    id: i.id,
    hospital_id: 1,
    name: i.name,
    category: i.category,
    unit: i.unit,
    stock: i.stock,
    min_stock: i.minStock,
    supplier: i.supplier,
    status: i.status,
    created_at: ts,
    updated_at: ts,
  }));

  const inventoryIssues: Row[] = inventoryIssuesData.map((i) => ({
    id: i.id,
    hospital_id: 1,
    item_id: i.itemId,
    item_name: i.itemName,
    department: i.department,
    quantity: i.quantity,
    issued_to: i.issuedTo,
    issue_date: i.date,
    note: i.note,
    created_at: ts,
    updated_at: ts,
  }));

  const tasks: Row[] = tasksData.map((t) => ({
    id: t.id,
    hospital_id: 1,
    title: t.title,
    description: t.description,
    goal: t.goal,
    assignee_id: t.assigneeId,
    assignee_name: t.assigneeName,
    assigned_by: t.assignedBy,
    priority: t.priority,
    status: t.status,
    due_date: t.dueDate,
    created_at: ts,
    updated_at: ts,
  }));

  const scribeNotes: Row[] = scribeNotesData.map((s) => ({
    id: s.id,
    hospital_id: 1,
    appointment_id: s.appointmentId,
    patient_id: s.patientId,
    patient_name: s.patientName,
    doctor_id: s.doctorId,
    doctor_name: s.doctorName,
    transcript: s.transcript,
    brief: s.brief,
    language: s.language,
    duration_sec: s.durationSec,
    status: s.status,
    created_at: ts,
    updated_at: ts,
  }));

  // Follow-ups: about 80 return visits spread over the last 100 days and the next 3 weeks (dates relative to today),
  // booked by doctors and the front desk, most marked Done, a few Missed, and the recent ones still waiting.
  const followups: Row[] = (() => {
    const reasons = ["Review lab reports and adjust treatment", "Suture removal and wound inspection", "Recheck blood pressure and assess medication adherence",
      "Repeat thyroid profile and dose adjustment", "Assess symptom response to current therapy", "Post-procedure check", "Vaccination due", "Diabetes review"];
    const iso = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    let seedN = 7;
    const rnd = () => { seedN = (seedN * 9301 + 49297) % 233280; return seedN / 233280; };
    const people = patientsData.slice(0, 14);
    const docs = doctorsData.slice(0, 6);
    const rows: Row[] = [];
    for (let i = 0; i < 80; i++) {
      const offset = i < 62 ? -Math.floor(rnd() * 100) : 1 + Math.floor(rnd() * 21);
      const patient = people[Math.floor(rnd() * people.length)];
      const doctor = docs[Math.floor(rnd() * docs.length)];
      const bookedByDoctor = rnd() < 0.6;
      const past = offset < 0;
      const roll = rnd();
      const status = !past ? "Pending" : offset > -4 ? (roll < 0.6 ? "Pending" : roll < 0.9 ? "Done" : "Missed") : roll < 0.74 ? "Done" : roll < 0.9 ? "Missed" : "Pending";
      const resolvedByDoctor = rnd() < 0.35;
      rows.push({
        id: i + 1,
        hospital_id: 1,
        patient_id: patient.id,
        patient_name: patient.name,
        patient_code: patient.patientId,
        doctor_id: doctor.id,
        doctor: doctor.name,
        reason: reasons[Math.floor(rnd() * reasons.length)],
        due_on: iso(offset),
        status,
        created_by: bookedByDoctor ? doctor.name : "Deepak Nair",
        created_by_role: bookedByDoctor ? "Doctor" : "Receptionist",
        resolved_by: status === "Pending" ? null : resolvedByDoctor ? doctor.name : "Deepak Nair",
        resolved_by_role: status === "Pending" ? null : resolvedByDoctor ? "Doctor" : "Receptionist",
        resolved_on: status === "Pending" ? null : iso(offset),
        reschedules: rnd() < 0.12 ? 1 : 0,
        note: "",
        created_at: ts,
        updated_at: ts,
      });
    }
    return rows;
  })();


  // ── MRD demo data ────────────────────────────────────────────────────────
  // Locations, one file per patient in every state (available, checked out — some overdue, in transit, archived),
  // requests, each file's movement trail, document folders, consent signatures, discharge coding and register entries.
  const mrdDay = bbDay;
  const mrdYY = mrdDay(0).slice(2, 4);
  const mrdLocations: Row[] = defaultLocationPlan(departments.map((d) => String(d.name)), doctors.map((d) => String(d.name))).map((l, i) => ({
    id: i + 1, hospital_id: 1, name: l.name, kind: l.kind, code: l.code, active: true, created_at: ts, updated_at: ts,
  }));
  const mrdRacks = mrdLocations.filter((l) => l.kind === "MRD rack");
  const mrdArchive = mrdLocations.filter((l) => l.kind === "Archive room");
  const mrdOut = mrdLocations.filter((l) => l.kind === "Nurse station" || l.kind === "Doctor cabin");
  const admittedIds = new Set(ipdAdmissions.map((a) => a.patient_id as number | null).filter((x): x is number => x != null));
  const hospitalPatients = patients.filter((p) => p.hospital_id === 1);
  const mrdFiles: Row[] = [];
  const mrdMovements: Row[] = [];
  const mrdRequests: Row[] = [];
  const holderPool = doctors.map((d) => String(d.name));
  const trail = (f: Row, action: string, from: string, to: string, holder: string | null, dueOn: string | null, note: string, by: string, daysAgo: number) =>
    mrdMovements.push({
      id: mrdMovements.length + 1, hospital_id: 1, file_id: f.id, file_no: f.file_no, action, from_location: from, to_location: to,
      holder_name: holder, due_on: dueOn, note, by_name: by, at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(), created_at: ts, updated_at: ts,
    });
  hospitalPatients.forEach((p, i) => {
    const home = rackFor(String(p.patient_code), mrdRacks.map((r) => ({ name: String(r.name), id: r.id }))) as { name: string; id: number | string } | null;
    const fileNo = `F/${mrdYY}/${String(i + 1).padStart(5, "0")}`;
    const file: Row = {
      id: i + 1, hospital_id: 1, file_no: fileNo, patient_id: p.id, patient_name: p.name, patient_code: p.patient_code,
      file_type: admittedIds.has(p.id as number) ? "IPD" : "OPD", status: "Available",
      location_id: home?.id ?? null, location_name: (home?.name as string) ?? "", home_location_id: home?.id ?? null,
      holder_name: null, due_on: null, checked_out_at: null, archived_on: null, created_at: ts, updated_at: ts,
    };
    trail(file, "Created", "", String(file.location_name), null, null, "File opened", "Deepak Nair", 60 + (i % 40));
    const out = mrdOut[i % mrdOut.length];
    const holder = holderPool[i % holderPool.length];
    if (i % 5 === 1) {
      // checked out — every third of them is past its due date
      const due = i % 3 === 0 ? mrdDay(-(2 + (i % 4))) : mrdDay(1 + (i % 6));
      Object.assign(file, { status: "Checked out", location_id: out.id, location_name: out.name, holder_name: holder, due_on: due, checked_out_at: new Date(Date.now() - 4 * 86_400_000).toISOString() });
      trail(file, "Checked out", String(home?.name ?? ""), String(out.name), holder, due, "", "Deepak Nair", 4);
    } else if (i % 11 === 4) {
      const due = i % 2 === 0 ? mrdDay(-1) : mrdDay(2);
      Object.assign(file, { status: "In transit", location_id: out.id, location_name: out.name, holder_name: holder, due_on: due, checked_out_at: new Date(Date.now() - 2 * 86_400_000).toISOString() });
      trail(file, "Dispatched", String(home?.name ?? ""), String(out.name), holder, due, "Request by Ward desk", "Deepak Nair", 2);
      mrdRequests.push({
        id: mrdRequests.length + 1, hospital_id: 1, file_id: file.id, file_no: fileNo, patient_id: p.id, patient_name: p.name, urgency: i % 2 === 0 ? "Urgent" : "Routine",
        status: "Dispatched", requested_on: mrdDay(-3), requested_by: "Ward desk", requested_for: holder, destination_id: out.id, destination_name: out.name,
        note: "", dispatched_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), dispatched_by: "Deepak Nair", returned_at: null, returned_by: null, cancelled_at: null,
        created_at: ts, updated_at: ts,
      });
    } else if (i % 7 === 3) {
      const room = mrdArchive[i % mrdArchive.length];
      Object.assign(file, { status: "Archived", location_id: room.id, location_name: room.name, archived_on: mrdDay(-30) });
      trail(file, "Archived", String(home?.name ?? ""), String(room.name), null, null, "Closed episode", "Deepak Nair", 30);
    }
    mrdFiles.push(file);
  });
  // Requests waiting for MRD to dispatch (against files that are on the shelf), and two that came back.
  const onShelf = mrdFiles.filter((f) => f.status === "Available");
  [[0, "Urgent", "Dr. Ava Johnson"], [3, "Routine", "Ward desk"], [6, "Routine", "Casualty desk"]].forEach(([k, urgency, who], n) => {
    const f = onShelf[k as number];
    if (!f) return;
    const dest = mrdOut[(n + 2) % mrdOut.length];
    mrdRequests.push({
      id: mrdRequests.length + 1, hospital_id: 1, file_id: f.id, file_no: f.file_no, patient_id: f.patient_id, patient_name: f.patient_name, urgency, status: "Pending",
      requested_on: mrdDay(-(n % 2)), requested_by: String(who), requested_for: String(who), destination_id: dest.id, destination_name: dest.name, note: "",
      dispatched_at: null, dispatched_by: null, returned_at: null, returned_by: null, cancelled_at: null, created_at: ts, updated_at: ts,
    });
  });
  [[8, 12], [10, 20]].forEach(([k, daysAgo]) => {
    const f = onShelf[k];
    if (!f) return;
    mrdRequests.push({
      id: mrdRequests.length + 1, hospital_id: 1, file_id: f.id, file_no: f.file_no, patient_id: f.patient_id, patient_name: f.patient_name, urgency: "Routine", status: "Returned",
      requested_on: mrdDay(-daysAgo), requested_by: "Ward desk", requested_for: "Ward desk", destination_id: null, destination_name: "", note: "",
      dispatched_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(), dispatched_by: "Deepak Nair", returned_at: new Date(Date.now() - (daysAgo - 3) * 86_400_000).toISOString(), returned_by: "Deepak Nair",
      cancelled_at: null, created_at: ts, updated_at: ts,
    });
    trail(f, "Dispatched", String(f.location_name), "Ward desk", "Ward desk", mrdDay(-daysAgo + 7), "", "Deepak Nair", daysAgo);
    trail(f, "Returned", "Ward desk", String(f.location_name), "Ward desk", null, "", "Deepak Nair", daysAgo - 3);
  });

  const mrdFolders: Row[] = DEFAULT_FOLDERS.map((f, i) => ({ id: i + 1, hospital_id: 1, name: f.name, class: f.class, description: f.description, created_at: ts, updated_at: ts }));

  const mrdPolicies: Row[] = DEFAULT_POLICIES.map((p, i) => ({ id: i + 1, hospital_id: 1, name: p.name, class: p.class, retention_years: p.years, categories: p.categories, action_after: "Review", active: true, created_at: ts, updated_at: ts }));

  const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
  const sigPatients = hospitalPatients.slice(0, 6);
  const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==";
  const consentTitle = (key: string, lang: "English" | "Hindi" | "Gujarati") => consentForm(key)!.title[lang];
  const consentBody = (key: string, lang: "English" | "Hindi" | "Gujarati") => consentForm(key)!.body[lang];
  const signatureRequests: Row[] = [
    { key: "general-consent", lang: "Hindi", status: "Draft", madeH: -3 },
    { key: "general-consent", lang: "English", status: "Waiting", madeH: -2, delivery: "whatsapp", expH: 70, extra: {} },
    { key: "surgery-consent", lang: "English", status: "Signed", madeH: -50, delivery: "qr", expH: -2, extra: { signed_via: "phone", signed_at: inHours(-48), signer_name: String(sigPatients[2]?.name ?? ""), signer_relation: "Self", signature_data: tinyPng, opened_at: inHours(-49) } },
    { key: "transfusion-consent", lang: "Gujarati", status: "Refused", madeH: -26, delivery: "email", expH: 40, extra: { refused_reason: "Wants to talk to family first", opened_at: inHours(-25) } },
    { key: "admission-consent", lang: "Hindi", status: "Cancelled", madeH: -30, delivery: "whatsapp", expH: 40, extra: { cancelled_at: inHours(-29) } },
    { key: "photography-consent", lang: "Gujarati", status: "Signed", madeH: -20, extra: { signed_via: "paper", signed_at: inHours(-19), signer_name: String(sigPatients[5]?.name ?? ""), signer_relation: "Self", witness_name: "Deepak Nair" } },
  ].map((r, i) => {
    const p = sigPatients[i] ?? sigPatients[0];
    const lang = r.lang as "English" | "Hindi" | "Gujarati";
    const linked = r.status !== "Draft" && r.status !== "Signed" || r.extra?.signed_via === "phone";
    return {
      id: i + 1, hospital_id: 1, patient_id: p.id, patient_name: p.name, patient_code: p.patient_code, patient_phone: p.phone ?? "",
      template_key: r.key, form_title: consentTitle(r.key, lang), form_body: consentBody(r.key, lang), language: lang, include_english: lang !== "English" && i % 2 === 0,
      token: linked ? randomBytes(24).toString("base64url") : null, status: r.status,
      sent_by: "Dr. Kevin Carter", sent_at: inHours(r.madeH), expires_at: linked ? inHours(r.expH ?? 70) : null,
      link_sent_at: linked ? inHours(r.madeH) : null, delivery: linked ? r.delivery ?? null : null, opened_at: null,
      signed_at: null, signer_name: null, signer_relation: null, signed_via: null, signed_language: null, witness_name: null, signed_document_id: null,
      signature_data: null, refused_reason: null, cancelled_at: null, ...r.extra, created_at: ts, updated_at: ts,
    };
  });

  const dischargedAdmissions = ipdAdmissions.filter((a) => a.status === "Discharged");
  const mrdCases: Row[] = dischargedAdmissions.map((a, i) => ({
    id: i + 1, hospital_id: 1, admission_id: a.id, admission_no: a.admission_no, patient_id: a.patient_id, patient_name: a.patient_name, patient_code: a.patient_code,
    doctor: a.doctor, admitted_on: a.admission_date,
    status: i === 0 ? "Signed off" : "Pending",
    principal_dx_code: i === 0 ? "O80" : "", principal_dx_text: i === 0 ? "Encounter for full-term uncomplicated delivery" : String(a.diagnosis ?? ""),
    secondary_dx: i === 0 ? [{ code: "Z37.0", text: "Single live birth" }] : [], procedures: [],
    coder_name: i === 0 ? "Deepak Nair" : null, coded_at: i === 0 ? mrdDay(-5) : null, signed_off_by: i === 0 ? "Dr. Kevin Carter" : null, signed_off_at: i === 0 ? mrdDay(-4) : null,
    queued_at: ts, created_at: ts, updated_at: ts,
  }));

  const entryAt = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  const mrdRegisterEntries: Row[] = [
    { register: "birth", entry_date: mrdDay(-9), data: { motherName: String(hospitalPatients[3]?.name ?? "Meena Reddy"), babySex: "female", weightG: "3100", timeOfBirth: "04:35", deliveryType: "Normal vaginal", attendant: "Dr. Sophia Adams", fatherName: "Ramesh Reddy", address: "Hyderabad" }, report_to: "Municipal registrar" },
    { register: "birth", entry_date: mrdDay(-2), data: { motherName: String(hospitalPatients[8]?.name ?? "Anita Rao"), babySex: "male", weightG: "2850", timeOfBirth: "19:10", deliveryType: "Caesarean section", attendant: "Dr. Sophia Adams", fatherName: "Vikram Rao", address: "Secunderabad" }, report_to: "Municipal registrar" },
    { register: "death", entry_date: mrdDay(-6), data: { deceasedName: "Rajan Mehta", sex: "male", age: "62", timeOfDeath: "02:20", causeOfDeath: "Acute myocardial infarction", placeOfDeath: "ICU", certifiedBy: "Dr. Noah Carter", informant: "Family member" }, report_to: "Municipal registrar" },
  ].map((r, i, all) => {
    const nth = all.slice(0, i + 1).filter((x) => x.register === r.register).length;
    return { id: i + 1, hospital_id: 1, ...r, entry_no: `${r.register === "birth" ? "BR" : "DR"}/${mrdYY}/${String(nth).padStart(5, "0")}`, filed_by: "Deepak Nair", filed_at: entryAt(-(r.entry_date < mrdDay(-5) ? 6 : 2)), amends_id: null, superseded_by: null, created_at: ts, updated_at: ts };
  });


  // ── CSSD demo data ───────────────────────────────────────────────────────
  // Sterilizers, instrument sets in every state (sterile, expiring, expired, packed, dirty, in a running cycle, issued — two
  // of those overdue), passed / failed / quarantined cycles, and requests, issues and returns.
  const cssdSterilizers: Row[] = DEFAULT_STERILIZERS.map((st, i) => ({ id: i + 1, hospital_id: 1, ...st, active: true, created_at: ts, updated_at: ts }));
  const setKinds: [string, string, number][] = [
    ["LSCS / Caesarean Set", "Obstetric", 850], ["Minor OT Procedure Set", "Procedure", 600], ["ENT Endoscopy Set", "Endoscopy", 979], ["Cystoscopy Set", "Endoscopy", 1038],
    ["Ortho Implant Set", "Orthopaedic", 2500], ["General Surgery Major Set", "Surgical", 410], ["Episiotomy / Delivery Set", "Obstetric", 960], ["Suture Removal / Dressing Set", "Dressing", 676],
    ["Appendicectomy Set", "Surgical", 322], ["Laparoscopy Set", "Surgical", 958],
  ];
  const wraps = ["Pouched", "Wrapped", "Rigid container"];
  const cssdSets: Row[] = [];
  const cssdCycles: Row[] = [];
  const cssdIssues: Row[] = [];
  const cycleNo = () => `CC/${mrdYY}/${String(cssdCycles.length + 1).padStart(5, "0")}`;
  const addCycle = (sterilizerIdx: number, status: string, hoursAgo: number, setIds: number[], note = "") => {
    const st = cssdSterilizers[sterilizerIdx];
    const id = cssdCycles.length + 1;
    cssdCycles.push({
      id, hospital_id: 1, cycle_no: cycleNo(), sterilizer_id: st.id, sterilizer_name: st.name, method: st.method, started_at: inHours(-hoursAgo), started_by: "Deepak Nair",
      set_ids: setIds, temp_c: 134, pressure_psi: 30, exposure_min: 20, indicator: status === "Running" ? "pending" : status === "Failed" ? "fail" : "pass", status,
      result_by: status === "Running" ? null : "Deepak Nair", result_at: status === "Running" ? null : inHours(-hoursAgo + 2), note, created_at: ts, updated_at: ts,
    });
    return id;
  };
  const dept = (i: number) => departments[i % departments.length] as Row;
  for (let i = 0; i < 24; i++) {
    const [name, type, charge] = setKinds[i % setKinds.length];
    const d = dept(i);
    const base: Row = {
      id: i + 1, hospital_id: 1, set_no: `CS-${String(i + 1).padStart(5, "0")}`, name, type, department_id: d.id, department_name: String(d.name),
      instruments: [{ name: "Artery forceps", qty: 6 }, { name: "Needle holder", qty: 2 }, { name: "Scissors", qty: 2 }], usage_charge: charge,
      status: "Dirty", packaging: null, sterile_until: null, last_cycle_id: null, times_processed: 1 + (i % 5), created_at: ts, updated_at: ts,
    };
    cssdSets.push(base);
  }
  const put = (i: number, patch: Record<string, unknown>) => Object.assign(cssdSets[i], patch);
  // 0-5 sterile and in date (two expiring this week), 6-10 sterile but past their date
  for (let i = 0; i <= 5; i++) put(i, { status: "Sterile", packaging: wraps[i % 3], sterile_until: mrdDay(i < 2 ? 3 + i : 14 + i * 5) });
  for (let i = 6; i <= 10; i++) put(i, { status: "Sterile", packaging: wraps[i % 3], sterile_until: mrdDay(-(i - 4)) });
  for (let i = 11; i <= 13; i++) put(i, { status: "Packed", packaging: wraps[i % 3] });
  // 14-15 dirty (as registered)
  for (let i = 16; i <= 18; i++) put(i, { status: "In cycle", packaging: wraps[i % 3] });
  for (let i = 19; i <= 22; i++) put(i, { status: "Sterile", packaging: wraps[i % 3], sterile_until: mrdDay(20) });
  // The cycles that made the sterile ones sterile, plus a failed and a quarantined one, and the running cycle.
  const passed = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9, 10], [19, 20, 21, 22]];
  passed.forEach((ids, n) => {
    const cid = addCycle(n % 6, "Passed", 30 + n * 20, ids.map((x) => x + 1));
    ids.forEach((x) => put(x, { last_cycle_id: cid }));
  });
  addCycle(5, "Failed", 14, [12, 13]);
  addCycle(3, "Quarantined", 400, [14], "Biological indicator read late");
  const running = addCycle(0, "Running", 1, [17, 18, 19]);
  for (const i of [16, 17, 18]) put(i, { last_cycle_id: running });
  // Issues: two requests waiting; four sets out (two overdue); a history of returns.
  const people = hospitalPatients;
  const issueNo = () => `CI/${mrdYY}/${String(cssdIssues.filter((x) => x.issue_no).length + 1).padStart(5, "0")}`;
  const addIssue = (setIdx: number, status: string, hoursAgo: number, who: number, extra: Record<string, unknown> = {}) => {
    const set = cssdSets[setIdx];
    const p = people[who % people.length];
    const issued = status === "Issued" || status === "Returned";
    cssdIssues.push({
      id: cssdIssues.length + 1, hospital_id: 1, issue_no: issued ? issueNo() : null, set_id: set.id, set_no: set.set_no, set_name: set.name,
      patient_id: p.id, patient_name: p.name, department_name: set.department_name, case_id: null, case_label: "", status, requested_at: inHours(-hoursAgo - 1), requested_by: "Ward desk",
      issued_at: issued ? inHours(-hoursAgo) : null, issued_by: issued ? "Deepak Nair" : null, expected_back: issued ? inHours(-hoursAgo + 24) : null,
      returned_at: status === "Returned" ? inHours(-hoursAgo + 20) : null, returned_by: status === "Returned" ? "Deepak Nair" : null,
      investigate: false, return_note: "", charge: set.usage_charge, bill_number: null, created_at: ts, updated_at: ts, ...extra,
    });
  };
  [[2, 100], [3, 150], [4, 200], [5, 260], [6, 330], [7, 410], [8, 500], [9, 600]].forEach(([set, h], n) => addIssue(set, "Returned", h, n, n === 2 || n === 5 ? { investigate: true, return_note: "One artery forceps missing from the count" } : {}));
  for (const [set, h, who] of [[19, 52, 0], [20, 51, 1], [21, 30, 2], [22, 28, 3]] as const) { addIssue(set, "Issued", h, who); put(set, { status: "Issued" }); }
  addIssue(11, "Requested", 3, 4);
  addIssue(12, "Requested", 2, 5);

  // ── HR demo data ─────────────────────────────────────────────────────────
  // Profile details (some licences close to lapsing), the four usual leave types and shifts, a few leave requests (one
  // waiting, one running now, two past — one unpaid), this week's duty roster and a salary for everyone on the books.
  const hrProfile: Record<number, Record<string, unknown>> = {
    1: { qualification: "B.Sc Nursing, ICU diploma", licence_no: "GNC-48211", licence_expiry: bbDay(40), gender: "Female" },
    2: { qualification: "B.Pharm", licence_no: "GPC-90133", licence_expiry: bbDay(300), gender: "Male" },
    3: { qualification: "DMLT, B.Sc MLT", licence_no: "LT-5521", licence_expiry: bbDay(-12), gender: "Female" },
    5: { qualification: "GNM", licence_no: "GNC-61920", licence_expiry: bbDay(25), gender: "Female" },
    9: { qualification: "B.Sc Radiography", licence_no: "AERB-7714", licence_expiry: bbDay(200), gender: "Female" },
  };
  for (const st of staff) {
    st.employee_no = `EMP-${1000 + Number(st.id)}`;
    st.emergency_name = "Family contact";
    st.emergency_phone = `+91 98000000${String(st.id).padStart(2, "0")}`;
    Object.assign(st, hrProfile[Number(st.id)] ?? {});
  }
  const hrLeaveTypes: Row[] = DEFAULT_LEAVE_TYPES.map((t, i) => ({ id: i + 1, hospital_id: 1, name: t.name, code: t.code, days_per_year: t.daysPerYear, paid: t.paid, active: true, created_at: ts, updated_at: ts }));
  const hrShifts: Row[] = DEFAULT_SHIFTS.map((t, i) => ({ id: i + 1, hospital_id: 1, ...t, active: true, created_at: ts, updated_at: ts }));
  const leaveRows: Row[] = [];
  const addLeave = (staffId: number, typeIdx: number, from: number, to: number, status: string, reason: string, note = "") => {
    const st = staff.find((x) => x.id === staffId)!;
    const t = hrLeaveTypes[typeIdx];
    leaveRows.push({
      id: leaveRows.length + 1, hospital_id: 1, staff_id: staffId, staff_name: st.name, department: st.department, leave_type_id: t.id, type_name: t.name, type_code: t.code, paid: t.paid,
      from_date: bbDay(from), to_date: bbDay(to), days: to - from + 1, reason, status, applied_by: st.name, applied_at: bbAt(Math.max(1, -from + 3), 10),
      decided_by: status === "Pending" ? null : "Dr. Kevin Carter", decided_at: status === "Pending" ? null : bbAt(Math.max(1, -from + 2), 11), decision_note: note, created_at: ts, updated_at: ts,
    });
  };
  addLeave(3, 0, 5, 6, "Pending", "Family function");
  addLeave(9, 1, -1, 2, "Approved", "Viral fever");
  addLeave(5, 0, -20, -19, "Approved", "Travel");
  addLeave(8, 3, -10, -9, "Approved", "Personal work");
  const hrRoster: Row[] = [];
  const mondayOffset = -((new Date().getDay() + 6) % 7);
  const onLeaveOn = (id: number, date: string) => leaveRows.some((l) => l.staff_id === id && l.status === "Approved" && String(l.from_date) <= date && date <= String(l.to_date));
  const rotation = [1, 2, 3]; // morning, evening, night
  const nursing = [1, 5, 8];
  for (const st of staff) {
    if (st.status === "Inactive") continue;
    for (let d = 0; d < 7; d++) {
      const date = bbDay(mondayOffset + d);
      if (onLeaveOn(Number(st.id), date) || (d === 6)) continue; // Sunday off
      const nurseIdx = nursing.indexOf(Number(st.id));
      const shiftId = nurseIdx >= 0 ? rotation[(Math.floor(d / 2) + nurseIdx) % 3] : 4;
      hrRoster.push({ id: hrRoster.length + 1, hospital_id: 1, staff_id: st.id, work_date: date, shift_id: shiftId, created_at: ts, updated_at: ts });
    }
  }
  const basics: Record<number, number> = { 1: 42000, 2: 38000, 3: 30000, 4: 24000, 5: 32000, 6: 34000, 7: 28000, 8: 18000, 9: 36000, 10: 52000, 11: 30000, 12: 20000 };
  const hrSalaries: Row[] = staff.filter((x) => x.status !== "Inactive").map((x, i) => {
    const basic = basics[Number(x.id)] ?? 25000;
    return { id: i + 1, hospital_id: 1, staff_id: x.id, basic, hra: Math.round(basic * 0.4), allowances: Math.round(basic * 0.15), pf_percent: 12, prof_tax: 200, other_deduction: 0, updated_by: "Dr. Kevin Carter", created_at: ts, updated_at: ts };
  });

  return {
    [TABLES.departments]: [...departments, h2Department],
    [TABLES.doctors]: [...doctors, h2Doctor],
    [TABLES.staff]: staff,
    [TABLES.users]: [...users, h2AdminUser, platformAdminUser, radiologyCenterUser, labCenterUser],
    [TABLES.radiologyCenters]: radiologyCenters,
    [TABLES.hospitalRadiologyLinks]: [],
    [TABLES.labCenters]: labCenters,
    [TABLES.hospitalLabLinks]: [],
    [TABLES.patients]: [...patients, h2Patient],
    [TABLES.appointments]: appointments,
    [TABLES.opdVisits]: opdVisits,
    [TABLES.medicines]: medicines,
    [TABLES.prescriptions]: prescriptions,
    [TABLES.prescriptionItems]: prescriptionItems,
    [TABLES.pharmacyItems]: pharmacyItems,
    [TABLES.labTests]: labTests,
    [TABLES.bills]: bills,
    [TABLES.wards]: wards,
    [TABLES.beds]: beds,
    [TABLES.ipdAdmissions]: ipdAdmissions,
    [TABLES.otSchedules]: [...otSchedules, ...otCurrent],
    [TABLES.otRooms]: otRooms,
    [TABLES.otEquipment]: otEquipment,
    [TABLES.hospitals]: hospitals,
    [TABLES.platformBills]: platformBills,
    [TABLES.auditLogs]: [],
    [TABLES.bloodDonors]: bloodDonors,
    [TABLES.bloodUnits]: bloodUnits,
    [TABLES.bloodCrossmatches]: bloodCrossmatches,
    [TABLES.bloodTransfusions]: bloodTransfusions,
    [TABLES.radiologyTests]: radiologyTests,
    [TABLES.ambulances]: ambulances,
    [TABLES.ambulanceCalls]: ambulanceCalls,
    [TABLES.birthRecords]: birthRecords,
    [TABLES.deathRecords]: deathRecords,
    [TABLES.tpas]: tpas,
    [TABLES.tpaClaims]: tpaClaims,
    [TABLES.followups]: followups,
    [TABLES.financeIncomes]: financeIncomes,
    [TABLES.financeExpenses]: financeExpenses,
    [TABLES.inventoryItems]: inventoryItems,
    [TABLES.inventoryIssues]: inventoryIssues,
    [TABLES.documents]: [],
    [TABLES.mrdLocations]: mrdLocations,
    [TABLES.mrdFiles]: mrdFiles,
    [TABLES.mrdFileRequests]: mrdRequests,
    [TABLES.mrdFileMovements]: mrdMovements,
    [TABLES.mrdRetentionPolicies]: mrdPolicies,
    [TABLES.mrdFolders]: mrdFolders,
    [TABLES.mrdCodingCases]: mrdCases,
    [TABLES.mrdDeficiencies]: [],
    [TABLES.mrdRegisterEntries]: mrdRegisterEntries,
    [TABLES.signatureRequests]: signatureRequests,
    [TABLES.cssdSterilizers]: cssdSterilizers,
    [TABLES.cssdSets]: cssdSets,
    [TABLES.cssdCycles]: cssdCycles,
    [TABLES.cssdIssues]: cssdIssues,
    [TABLES.cssdSettings]: [],
    [TABLES.hrLeaveTypes]: hrLeaveTypes,
    [TABLES.hrLeaveRequests]: leaveRows,
    [TABLES.hrShifts]: hrShifts,
    [TABLES.hrRoster]: hrRoster,
    [TABLES.hrSalaries]: hrSalaries,
    [TABLES.hrPayrollRuns]: [],
    [TABLES.hrPayslips]: [],
    [TABLES.staffAttendance]: [],
    [TABLES.teleconsultBookings]: [],
    [TABLES.googleConnections]: [],
    [TABLES.teleconsultPayments]: [],
    [TABLES.ipdNotes]: [],
    [TABLES.ipdMedications]: ipdMedications,
    [TABLES.ipdVitals]: ipdVitals,
    [TABLES.ipdIvLines]: ipdIvLines,
    [TABLES.ipdDoseLog]: [],
    [TABLES.ipdNursingTasks]: ipdNursingTasks,
    [TABLES.ipdHandovers]: [],
    [TABLES.ipdAlertAcks]: [],
    [TABLES.ipdChecklistTemplates]: [],
    [TABLES.ipdChecklists]: [],
    [TABLES.purchaseOrders]: [],
    [TABLES.purchaseOrderItems]: [],
    [TABLES.pharmacySales]: [],
    [TABLES.pharmacySaleItems]: [],
    [TABLES.tasks]: tasks,
    [TABLES.scribeNotes]: scribeNotes,
    [TABLES.bedTransfers]: bedTransfers,
  };
}
