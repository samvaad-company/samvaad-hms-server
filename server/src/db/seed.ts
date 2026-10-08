/**
 * Seed data builder.
 *
 * Converts the original frontend sample data into normalized, snake_case rows
 * keyed by table name. Used to populate the in-memory adapter for development
 * and mirrored by the SQL migration seed for Supabase.
 */
import { type Row } from "@/db/adapter";
import { TABLES } from "@/db/tables";
import { hashPassword } from "@/auth/password";

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
  bloodDonors as bloodDonorsData,
  bloodStock as bloodStockData,
  bloodIssues as bloodIssuesData,
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
    priority: "Routine",
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
  const wards: Row[] = wardNames.map((name, i) => ({
    id: i + 1,
    hospital_id: 1,
    name,
    capacity: bedsData.filter((b) => b.ward === name).length,
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
  const bloodDonors: Row[] = bloodDonorsData.map((d) => ({
    id: d.id,
    hospital_id: 1,
    name: d.name,
    age: d.age,
    gender: d.gender,
    blood_group: d.bloodGroup,
    phone: d.phone,
    aadhaar_number: "",
    last_donation_date: d.lastDonationDate,
    total_donations: d.totalDonations,
    status: d.status,
    created_at: ts,
    updated_at: ts,
  }));

  const bloodStock: Row[] = bloodStockData.map((s) => ({
    id: s.id,
    hospital_id: 1,
    blood_group: s.bloodGroup,
    component: s.component,
    units: s.units,
    created_at: ts,
    updated_at: ts,
  }));

  const bloodIssues: Row[] = bloodIssuesData.map((i) => ({
    id: i.id,
    hospital_id: 1,
    patient_id: findPatientByName(i.patientName)?.id ?? null,
    patient_name: i.patientName,
    blood_group: i.bloodGroup,
    component: i.component,
    units: i.units,
    doctor: i.doctor,
    issue_date: i.date,
    amount: i.amount,
    status: i.status,
    created_at: ts,
    updated_at: ts,
  }));

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
    [TABLES.otSchedules]: otSchedules,
    [TABLES.hospitals]: hospitals,
    [TABLES.platformBills]: platformBills,
    [TABLES.auditLogs]: [],
    [TABLES.bloodDonors]: bloodDonors,
    [TABLES.bloodStock]: bloodStock,
    [TABLES.bloodIssues]: bloodIssues,
    [TABLES.radiologyTests]: radiologyTests,
    [TABLES.ambulances]: ambulances,
    [TABLES.ambulanceCalls]: ambulanceCalls,
    [TABLES.birthRecords]: birthRecords,
    [TABLES.deathRecords]: deathRecords,
    [TABLES.tpas]: tpas,
    [TABLES.tpaClaims]: tpaClaims,
    [TABLES.financeIncomes]: financeIncomes,
    [TABLES.financeExpenses]: financeExpenses,
    [TABLES.inventoryItems]: inventoryItems,
    [TABLES.inventoryIssues]: inventoryIssues,
    [TABLES.documents]: [],
    [TABLES.staffAttendance]: [],
    [TABLES.teleconsultBookings]: [],
    [TABLES.googleConnections]: [],
    [TABLES.teleconsultPayments]: [],
    [TABLES.ipdNotes]: [],
    [TABLES.ipdMedications]: [],
    [TABLES.purchaseOrders]: [],
    [TABLES.purchaseOrderItems]: [],
    [TABLES.pharmacySales]: [],
    [TABLES.pharmacySaleItems]: [],
    [TABLES.tasks]: tasks,
    [TABLES.scribeNotes]: scribeNotes,
    [TABLES.bedTransfers]: bedTransfers,
  };
}
