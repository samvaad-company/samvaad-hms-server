/**
 * Canonical table names + persisted row shapes.
 *
 * Columns use snake_case to match the Postgres schema exactly, so the
 * in-memory and Supabase adapters return identically-shaped rows. The
 * repository/mapper layer translates these rows into the camelCase DTOs the
 * frontend consumes.
 */
import { type Row } from "@/server/db/adapter";

export const TABLES = {
  users: "users",
  departments: "departments",
  doctors: "doctors",
  staff: "staff",
  patients: "patients",
  appointments: "appointments",
  opdVisits: "opd_visits",
  medicines: "medicines",
  prescriptions: "prescriptions",
  prescriptionItems: "prescription_items",
  pharmacyItems: "pharmacy_items",
  labTests: "lab_tests",
  bills: "bills",
  wards: "wards",
  beds: "beds",
  ipdAdmissions: "ipd_admissions",
  otSchedules: "ot_schedules",
  hospitalSettings: "hospital_settings",
  auditLogs: "audit_logs",
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];

// ─── Persisted row types (snake_case) ──────────────────────────────────────

export interface UserRow extends Row {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  department_id: number | null;
  status: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepartmentRow extends Row {
  id: number;
  name: string;
  head: string;
  extension: string;
  created_at: string;
  updated_at: string;
}

export interface DoctorRow extends Row {
  id: number;
  name: string;
  specialty: string;
  department_id: number | null;
  department: string;
  phone: string;
  experience: string;
  patients_today: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface StaffRow extends Row {
  id: number;
  name: string;
  role: string;
  department_id: number | null;
  department: string;
  phone: string;
  email: string;
  join_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PatientRow extends Row {
  id: number;
  patient_code: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  email: string | null;
  blood_group: string | null;
  dob: string | null;
  reason: string;
  doctor_id: number | null;
  doctor: string;
  status: string;
  visit_date: string;
  visit_time: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
  abha_id: string | null;
  emergency_name: string | null;
  emergency_relation: string | null;
  emergency_phone: string | null;
  insurer: string | null;
  policy_number: string | null;
  corporate: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentRow extends Row {
  id: number;
  patient_id: number | null;
  patient_name: string;
  patient_age: number;
  doctor_id: number | null;
  doctor: string;
  appointment_date: string;
  appointment_time: string;
  type: string;
  reason: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OpdVisitRow extends Row {
  id: number;
  token_number: string;
  patient_id: number | null;
  patient_name: string;
  patient_age: number;
  doctor_id: number | null;
  doctor: string;
  vitals_recorded: boolean;
  wait_time: string;
  check_in_time: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface MedicineRow extends Row {
  id: number;
  name: string;
  generic: string;
  category: string;
  default_dosage: string;
  default_frequency: string;
  default_duration: string;
  unit: string;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionRow extends Row {
  id: number;
  rx_number: string;
  patient_id: number | null;
  patient_name: string;
  patient_age: number;
  doctor_id: number | null;
  doctor: string;
  diagnosis: string;
  medicine_count: number;
  prescribed_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionItemRow extends Row {
  id: number;
  prescription_id: number;
  medicine_id: number | null;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  created_at: string;
}

export interface PharmacyItemRow extends Row {
  id: number;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  expiry_date: string;
  supplier: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface LabTestRow extends Row {
  id: number;
  patient_id: number | null;
  patient_name: string;
  patient_age: number;
  test_name: string;
  sample_status: string;
  report_status: string;
  test_date: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BillRow extends Row {
  id: number;
  bill_number: string;
  patient_id: number | null;
  patient_name: string;
  type: string;
  bill_date: string;
  amount: number;
  discount: number;
  gst: number;
  total: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface WardRow extends Row {
  id: number;
  name: string;
  capacity: number;
  created_at: string;
  updated_at: string;
}

export interface BedRow extends Row {
  id: number;
  bed_number: string;
  ward_id: number | null;
  ward: string;
  patient_id: number | null;
  patient_name: string | null;
  patient_code: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface IpdAdmissionRow extends Row {
  id: number;
  patient_id: number | null;
  patient_name: string;
  patient_age: number;
  patient_code: string;
  admission_date: string;
  ward_id: number | null;
  ward: string;
  bed_id: number | null;
  bed: string;
  doctor_id: number | null;
  doctor: string;
  diagnosis: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OtScheduleRow extends Row {
  id: number;
  patient_id: number | null;
  patient_name: string;
  procedure: string;
  ot_room: string;
  surgeon_id: number | null;
  surgeon: string;
  anesthetist: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface HospitalSettingsRow extends Row {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  mobile: string;
  email: string;
  website: string;
  gst_number: string;
  pan_number: string;
  reg_number: string;
  working_hours: unknown;
  updated_at: string;
}

export interface AuditLogRow extends Row {
  id: number;
  actor_id: number | null;
  actor_name: string;
  action: string;
  entity: string;
  entity_id: string;
  meta: unknown;
  created_at: string;
}
