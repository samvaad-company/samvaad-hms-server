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
  hospitals: "hospitals",
  radiologyCenters: "radiology_centers",
  hospitalRadiologyLinks: "hospital_radiology_links",
  labCenters: "lab_centers",
  hospitalLabLinks: "hospital_lab_links",
  auditLogs: "audit_logs",
  bloodDonors: "blood_donors",
  bloodStock: "blood_stock",
  bloodIssues: "blood_issues",
  radiologyTests: "radiology_tests",
  ambulances: "ambulances",
  ambulanceCalls: "ambulance_calls",
  birthRecords: "birth_records",
  deathRecords: "death_records",
  tpas: "tpas",
  tpaClaims: "tpa_claims",
  financeIncomes: "finance_incomes",
  financeExpenses: "finance_expenses",
  inventoryItems: "inventory_items",
  inventoryIssues: "inventory_issues",
  tasks: "tasks",
  scribeNotes: "scribe_notes",
  documents: "documents",
  staffAttendance: "staff_attendance",
  ipdNotes: "ipd_notes",
  ipdMedications: "ipd_medications",
  purchaseOrders: "purchase_orders",
  purchaseOrderItems: "purchase_order_items",
  pharmacySales: "pharmacy_sales",
  pharmacySaleItems: "pharmacy_sale_items",
  bedTransfers: "bed_transfers",
  prescriptionTemplates: "prescription_templates",
  chatThreads: "chat_threads",
  chatMessages: "chat_messages",
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];

// ─── Persisted row types (snake_case) ──────────────────────────────────────

export interface UserRow extends Row {
  id: number;
  /** Exactly one of hospital_id / radiology_center_id / lab_center_id is set — see chk_users_one_tenant. */
  hospital_id: number | null;
  radiology_center_id: number | null;
  lab_center_id: number | null;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  department_id: number | null;
  doctor_id: number | null;
  status: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepartmentRow extends Row {
  id: number;
  hospital_id: number;
  name: string;
  head: string;
  extension: string;
  created_at: string;
  updated_at: string;
}

export interface DoctorRow extends Row {
  id: number;
  hospital_id: number;
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
  hospital_id: number;
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
  hospital_id: number;
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
  hospital_id: number;
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
  hospital_id: number;
  token_number: string;
  /** Set when the visit was created by checking in a booked appointment. */
  appointment_id: number | null;
  patient_id: number | null;
  patient_name: string;
  patient_age: number;
  doctor_id: number | null;
  doctor: string;
  reason: string;
  priority: string;
  vitals_recorded: boolean;
  /** Vitals readings; null until recorded. */
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse: number | null;
  temperature: number | null;
  spo2: number | null;
  wait_time: string;
  check_in_time: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface MedicineRow extends Row {
  id: number;
  hospital_id: number;
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
  hospital_id: number;
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
  hospital_id: number;
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
  hospital_id: number;
  /** Tests booked together share one order number (LAB-0001). */
  order_number: string;
  patient_id: number | null;
  patient_name: string;
  patient_age: number;
  test_name: string;
  requested_by: string;
  doctor_id: number | null;
  doctor: string;
  priority: string;
  sample_status: string;
  report_status: string;
  test_date: string;
  collection_date: string;
  amount: number;
  /** The price itself is the routed-to center's call, not the hospital's — only a discount is captured here. */
  discount: number;
  /** "percent" | "amount" — how `discount` should be read. */
  discount_type: string;
  status: string;
  /** Null keeps the test in-house; set once routed to a linked lab center. */
  lab_center_id: number | null;
  /** Uploaded report document as a data URL (PDF/image), when present. */
  report_file: string | null;
  report_file_name: string | null;
  report_note: string | null;
  report_uploaded_by: string | null;
  report_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillRow extends Row {
  id: number;
  hospital_id: number;
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
  hospital_id: number;
  name: string;
  capacity: number;
  created_at: string;
  updated_at: string;
}

export interface BedTransferRow extends Row {
  id: number;
  hospital_id: number;
  patient_name: string;
  from_label: string;
  to_label: string;
  transfer_date: string;
  reason: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BedRow extends Row {
  id: number;
  hospital_id: number;
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
  hospital_id: number;
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
  credit_limit: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface OtScheduleRow extends Row {
  id: number;
  hospital_id: number;
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

/** A hospital tenant. Doubles as its own settings/letterhead record. */
export interface HospitalRow extends Row {
  id: number;
  code: string;
  status: string;
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

/**
 * A radiology center tenant — independent of any hospital, so it can (once
 * linked, see Phase 3) serve more than one.
 */
export interface RadiologyCenterRow extends Row {
  id: number;
  code: string;
  status: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  contact_email: string;
  created_at: string;
  updated_at: string;
}

/** A hospital's request to route radiology work to a center, and the center's answer. */
export interface HospitalRadiologyLinkRow extends Row {
  id: number;
  hospital_id: number;
  radiology_center_id: number;
  /** "Pending" | "Active" | "Rejected" | "Revoked" */
  status: string;
  requested_by: string;
  requested_at: string;
  responded_by: string;
  responded_at: string;
  revoked_by: string;
  revoked_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * A lab center tenant — independent of any hospital, so it can (once linked)
 * serve more than one. Mirrors RadiologyCenterRow exactly.
 */
export interface LabCenterRow extends Row {
  id: number;
  code: string;
  status: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  contact_email: string;
  created_at: string;
  updated_at: string;
}

/** A hospital's request to route lab work to a center, and the center's answer. */
export interface HospitalLabLinkRow extends Row {
  id: number;
  hospital_id: number;
  lab_center_id: number;
  /** "Pending" | "Active" | "Rejected" | "Revoked" */
  status: string;
  requested_by: string;
  requested_at: string;
  responded_by: string;
  responded_at: string;
  revoked_by: string;
  revoked_at: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRow extends Row {
  id: number;
  hospital_id: number;
  actor_id: number | null;
  actor_name: string;
  action: string;
  entity: string;
  entity_id: string;
  meta: unknown;
  created_at: string;
}

export interface BloodDonorRow extends Row {
  id: number;
  hospital_id: number;
  name: string;
  age: number;
  gender: string;
  blood_group: string;
  phone: string;
  aadhaar_number: string;
  last_donation_date: string;
  total_donations: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BloodStockRow extends Row {
  id: number;
  hospital_id: number;
  blood_group: string;
  component: string;
  units: number;
  created_at: string;
  updated_at: string;
}

export interface BloodIssueRow extends Row {
  id: number;
  hospital_id: number;
  patient_id: number | null;
  patient_name: string;
  blood_group: string;
  component: string;
  units: number;
  doctor: string;
  issue_date: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RadiologyTestRow extends Row {
  id: number;
  hospital_id: number;
  /** Studies ordered together share one order number (RAD-0001). */
  order_number: string;
  patient_id: number | null;
  patient_name: string;
  patient_age: number;
  test_name: string;
  scan_status: string;
  report_status: string;
  test_date: string;
  amount: number;
  /** The price itself is the routed-to center's call, not the hospital's — only a discount is captured here. */
  discount: number;
  /** "percent" | "amount" — how `discount` should be read. */
  discount_type: string;
  status: string;
  doctor_id: number | null;
  doctor: string;
  /** Null keeps the study in-house; set once routed to a linked center. */
  radiology_center_id: number | null;
  /** Uploaded report document as a data URL (PDF/image), when present. */
  report_file: string | null;
  report_file_name: string | null;
  report_note: string | null;
  report_uploaded_by: string | null;
  report_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AmbulanceRow extends Row {
  id: number;
  hospital_id: number;
  vehicle_number: string;
  model: string;
  driver_name: string;
  driver_phone: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AmbulanceCallRow extends Row {
  id: number;
  hospital_id: number;
  patient_name: string;
  phone: string;
  pickup_location: string;
  drop_location: string;
  ambulance_id: number | null;
  vehicle_number: string;
  driver_name: string;
  call_date: string;
  call_time: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BirthRecordRow extends Row {
  id: number;
  hospital_id: number;
  child_name: string;
  gender: string;
  birth_date: string;
  birth_time: string;
  weight_kg: number;
  mother_name: string;
  father_name: string;
  phone: string;
  address: string;
  created_at: string;
  updated_at: string;
}

export interface DeathRecordRow extends Row {
  id: number;
  hospital_id: number;
  deceased_name: string;
  gender: string;
  age: number;
  death_date: string;
  death_time: string;
  guardian_name: string;
  cause: string;
  phone: string;
  address: string;
  created_at: string;
  updated_at: string;
}

export interface TpaRow extends Row {
  id: number;
  hospital_id: number;
  name: string;
  code: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TpaClaimRow extends Row {
  id: number;
  hospital_id: number;
  tpa_id: number | null;
  tpa_name: string;
  patient_id: number | null;
  patient_name: string;
  bill_number: string;
  claim_amount: number;
  approved_amount: number;
  claim_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FinanceIncomeRow extends Row {
  id: number;
  hospital_id: number;
  category: string;
  description: string;
  invoice_number: string;
  amount: number;
  entry_date: string;
  created_at: string;
  updated_at: string;
}

export interface FinanceExpenseRow extends Row {
  id: number;
  hospital_id: number;
  category: string;
  description: string;
  invoice_number: string;
  amount: number;
  entry_date: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryItemRow extends Row {
  id: number;
  hospital_id: number;
  name: string;
  category: string;
  unit: string;
  stock: number;
  min_stock: number;
  supplier: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryIssueRow extends Row {
  id: number;
  hospital_id: number;
  item_id: number | null;
  item_name: string;
  department: string;
  quantity: number;
  issued_to: string;
  issue_date: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface TaskRow extends Row {
  id: number;
  hospital_id: number;
  title: string;
  description: string;
  goal: string;
  assignee_id: number | null;
  assignee_name: string;
  assigned_by: string;
  priority: string;
  status: string;
  due_date: string;
  created_at: string;
  updated_at: string;
}

export interface ChatThreadRow extends Row {
  id: number;
  hospital_id: number | null;
  radiology_center_id: number | null;
  lab_center_id: number | null;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow extends Row {
  id: number;
  thread_id: number;
  role: string;
  content: string;
  sources: string[] | null;
  created_at: string;
}

export interface PurchaseOrderRow extends Row {
  id: number;
  hospital_id: number;
  po_number: string;
  supplier: string;
  order_date: string;
  expected_date: string;
  item_count: number;
  total: number;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItemRow extends Row {
  id: number;
  purchase_order_id: number;
  pharmacy_item_id: number | null;
  medicine_name: string;
  quantity: number;
  unit_cost: number;
  created_at: string;
}

export interface PharmacySaleRow extends Row {
  id: number;
  hospital_id: number;
  sale_number: string;
  patient_id: number | null;
  patient_name: string;
  prescription_id: number | null;
  rx_number: string;
  item_count: number;
  subtotal: number;
  discount: number;
  total: number;
  payment_mode: string;
  sale_date: string;
  bill_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface PharmacySaleItemRow extends Row {
  id: number;
  sale_id: number;
  pharmacy_item_id: number | null;
  medicine_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface StaffAttendanceRow extends Row {
  id: number;
  hospital_id: number;
  staff_id: number;
  staff_name: string;
  work_date: string;
  punch_in: string;
  punch_out: string;
  /** Minutes between punch in and punch out; 0 until punched out. */
  minutes: number;
  status: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface IpdNoteRow extends Row {
  id: number;
  admission_id: number;
  /** "Daily Note" | "Doctor Round" | "Diet" — one table, three timelines. */
  note_type: string;
  note_date: string;
  note_time: string;
  author: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface IpdMedicationRow extends Row {
  id: number;
  admission_id: number;
  medicine_name: string;
  dosage: string;
  frequency: string;
  route: string;
  start_date: string;
  end_date: string;
  /** "Active" | "Stopped" | "Completed" */
  status: string;
  last_given_at: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow extends Row {
  id: number;
  hospital_id: number;
  /** What the file is attached to, e.g. "patient" | "lab" | "donor". */
  owner_type: string;
  owner_id: number;
  category: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface ScribeNoteRow extends Row {
  id: number;
  hospital_id: number;
  appointment_id: number | null;
  patient_id: number | null;
  patient_name: string;
  doctor_id: number | null;
  doctor_name: string;
  transcript: string;
  brief: string;
  language: string;
  duration_sec: number;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * A doctor's personal "quick fill" prescription template — private to the
 * doctor who created it, not shared across the practice.
 */
export interface PrescriptionTemplateRow extends Row {
  id: number;
  hospital_id: number;
  doctor_id: number;
  name: string;
  /** Array of { medicineName, dosage, frequency, duration, instructions }. */
  items: unknown;
  created_at: string;
  updated_at: string;
}
