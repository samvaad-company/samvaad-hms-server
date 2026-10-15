/**
 * Canonical table names + persisted row shapes.
 *
 * Columns use snake_case to match the Postgres schema exactly, so the
 * in-memory and Supabase adapters return identically-shaped rows. The
 * repository/mapper layer translates these rows into the camelCase DTOs the
 * frontend consumes.
 */
import { type Row } from "@/db/adapter";

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
  platformBills: "platform_bills",
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
  enquiries: "enquiries",
  followups: "followups",
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
  teleconsultBookings: "teleconsult_bookings",
  googleConnections: "google_connections",
  teleconsultPayments: "teleconsult_payments",
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];

// ─── Persisted row types (snake_case) ──────────────────────────────────────

export interface UserRow extends Row {
  id: number;
  /** Exactly one of hospital_id / radiology_center_id / lab_center_id is set — see chk_users_one_tenant. */
  hospital_id: number | null;
  radiology_center_id: number | null;
  lab_center_id: number | null;
  /** The staff record this login belongs to; lets the attendance app punch the right person. */
  staff_id?: number | null;
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
  /** How many patients this doctor sees in one hour (must divide 60). Each gets 60 / this minutes. Default 2. */
  patients_per_hour?: number | null;
  /** The doctor takes video consultations (needs the hospital's tele-consult switch on as well). Default off. */
  video_enabled?: boolean;
  /** Weekly hours reserved for video consultations; outside them the doctor's hours are in-person only. */
  video_hours?: { day: string; start: string; end: string }[] | null;
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
  // Wider profile (all optional) — see services/patient-profile.ts
  age_months?: number | null;
  referral_source?: string | null;
  medico_legal?: boolean | null;
  is_temporary?: boolean | null;
  data_consent?: boolean | null;
  alternate_phone?: string | null;
  address_line2?: string | null;
  title?: string | null;
  guardian_name?: string | null;
  care_of?: string | null;
  anniversary?: string | null;
  marital_status?: string | null;
  religion?: string | null;
  language?: string | null;
  nationality?: string | null;
  education?: string | null;
  notes?: string | null;
  occupation?: string | null;
  employer?: string | null;
  designation?: string | null;
  work_phone?: string | null;
  privilege_card_no?: string | null;
  payers?: { type: string; name: string; policyNumber: string; validUntil: string | null }[] | null;
  identity_documents?: { type: string; last4: string; fingerprint: string }[] | null;
  covid_details?: { vaccination: string | null; lastDose: string | null; infectedBefore: boolean } | null;
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
  /** Tele-consult: the video link (Google Meet, or one pasted manually), once available. */
  video_url?: string | null;
  video_provider?: string | null;
  /** Tele-consult: why the Meet link couldn't be created automatically, if it failed. */
  meet_error?: string | null;
  /** Tele-consult: the access type the Meet room really has (OPEN | TRUSTED | RESTRICTED | calendar-default). */
  meet_access?: string | null;
  /** Tele-consult: set when the room doesn't have the requested access type (patients may be unable to join). */
  meet_warning?: string | null;
  /** Tele-consult: the Google Calendar event holding the room, so a reschedule can move it. */
  meet_event_id?: string | null;
  /** Length of the slot this appointment holds, in minutes (the doctor's slot length when it was booked). */
  slot_minutes?: number | null;
  /** How many times it has been moved to another time, and what it was before the last move. */
  reschedule_count?: number | null;
  rescheduled_from?: string | null;
  /** Tele-consult: fee charged (INR) and its payment state. */
  consult_amount?: number | null;
  payment_status?: string | null;
  booking_id?: number | null;
  /** Tele-consult: the gateway ids of the payment that bought this appointment (or the staff reference). */
  payment_id?: string | null;
  order_id?: string | null;
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
  /** Attendance geofence centre and radius; unset until an admin configures it. */
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius_m?: number | null;
  /** Tele-consult: whether patients can book video consultations, and the fee (INR) set by an admin. */
  teleconsult_enabled?: boolean;
  teleconsult_price?: number | null;
  /** Who may join a tele-consult's Meet room without being let in: OPEN (default) | TRUSTED | RESTRICTED. */
  teleconsult_meet_access?: string | null;
  /** The brand colour chosen in Settings (a key from src/lib/theme.ts); teal when unset. */
  theme_color?: string | null;
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

/** A platform-admin invoice billing a hospital tenant for its Samvaad HMS subscription/usage. */
export interface PlatformBillRow extends Row {
  id: number;
  bill_number: string;
  hospital_id: number;
  hospital_name: string;
  period: string;
  amount: number;
  gst: number;
  total: number;
  /** "Pending" | "Paid" | "Overdue" */
  status: string;
  issued_date: string;
  due_date: string;
  notes: string;
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
  /** "Routine" | "Urgent" | "STAT" — chosen by the ordering doctor. */
  priority: string;
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

/**
 * A planned return visit for a patient (a "follow-up"): booked by a doctor or the front desk, then marked
 * Done when the patient comes, or Missed when they stay away. A Pending one whose date has passed is "due".
 */
export interface FollowUpRow extends Row {
  id: number;
  hospital_id: number;
  patient_id: number | null;
  patient_name: string;
  patient_code: string;
  doctor_id: number | null;
  doctor: string;
  reason: string;
  /** yyyy-mm-dd the patient is due back. */
  due_on: string;
  status: string;
  /** Who booked it, and in what role (Doctor, Receptionist, …). */
  created_by: string;
  created_by_role: string;
  /** Who marked it Done/Missed, and in what role; null while Pending. */
  resolved_by: string | null;
  resolved_by_role: string | null;
  resolved_on: string | null;
  /** How many times the date was moved. */
  reschedules: number;
  note: string;
  created_at: string;
  updated_at: string;
}

/** A lead captured before registration: someone who asked about a service and may later become a patient. */
export interface EnquiryRow extends Row {
  id: number;
  hospital_id: number;
  name: string;
  mobile: string;
  department: string;
  interested_in: string;
  source: string;
  estimated_value: number;
  /** When to contact them next (yyyy-mm-dd), or null when nothing is scheduled. */
  follow_up_on: string | null;
  notes: string;
  /** Open → Follow-up → Converted (became a patient) or Closed (lost). */
  status: string;
  /** How many times they have been contacted so far, counting the first enquiry. */
  contacts: number;
  converted_patient_id: number | null;
  history: { at: string; by: string; note: string; nextOn: string | null }[];
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
  /** The patient this reply resolved to, if any — powers a "View patient" link. */
  patient_id: number | null;
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
  /** "manual" (punched by an admin) or "qr" (staff scanned the reception QR). */
  method?: string;
  /** Exact ISO instants — the display strings above lose the date and timezone. */
  punch_in_at?: string | null;
  punch_out_at?: string | null;
  /** GPS fix and metres from the hospital at each QR scan. */
  in_lat?: number | null;
  in_lng?: number | null;
  in_distance_m?: number | null;
  out_lat?: number | null;
  out_lng?: number | null;
  out_distance_m?: number | null;
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

/**
 * A tele-consult booking, from the moment a patient (or the tele-caller)
 * starts one until it becomes an appointment. Holds the server-side booking
 * intent so nothing sensitive needs to ride in the payment order's notes, and
 * the payment reference used to confirm it exactly once.
 */
export interface TeleconsultBookingRow extends Row {
  id: number;
  hospital_id: number;
  patient_id: number;
  patient_name: string;
  patient_email: string | null;
  doctor_id: number;
  doctor_name: string;
  appointment_date: string;
  /** 12-hour "h:mm AM/PM", the same format appointments use. */
  appointment_time: string;
  reason: string;
  /** Fee in INR, fixed by the server from the hospital's price when the booking was created. */
  amount: number;
  currency: string;
  /** "portal" (patient app), "link" (the HMS booking link a tele-caller sent) or "staff" (booked by staff in the HMS). */
  source: string;
  /** pending_payment → confirmed, or failed / slot_conflict / cancelled. */
  status: string;
  /** razorpay | mock | cash | upi | card | waived | free */
  payment_mode: string;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  paid_at: string | null;
  appointment_id: number | null;
  failure_reason: string | null;
  created_by: number | null;
  /** Set when the fee was returned (online refund id, or a note for cash/UPI that staff hand back). */
  refund_reference?: string | null;
  refunded_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** A hospital's connected Google account, used to create Meet links on its calendar. */
export interface GoogleConnectionRow extends Row {
  id: number;
  hospital_id: number;
  account_email: string;
  /** AES-GCM encrypted refresh token (see google-meet.ts); never returned to the client. */
  refresh_token_enc: string;
  connected_by: number | null;
  /** Scopes Google actually granted (the user can untick some). */
  scopes?: string;
  /** The connection exists but can't be used (calendar access missing, revoked or expired) — the admin must reconnect. */
  needs_reconnect?: boolean;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * One row per payment attempt for a tele-consult — the transaction ledger.
 * Ties the gateway's ids to the booking, the appointment, the patient and the
 * doctor so any payment can be traced to its appointment (and back) by id.
 * Written by whichever of the webhook, the patient's confirmation call, the
 * reconciliation sweep or staff sees the payment first; updated by the rest.
 */
export interface TeleconsultPaymentRow extends Row {
  id: number;
  hospital_id: number;
  booking_id: number;
  appointment_id: number | null;
  patient_id: number;
  patient_name: string;
  doctor_id: number;
  doctor_name: string;
  order_id: string | null;
  /** The gateway payment id (unique); staff payments use their receipt reference or a generated "STAFF-…" id. */
  payment_id: string | null;
  /** Fee in INR (main units). */
  amount: number;
  currency: string;
  /** razorpay | mock | cash | upi | card | waived | free */
  mode: string;
  /** Gateway's method (card, upi, netbanking, …) when known. */
  method: string | null;
  /** created | authorized | captured | failed | refunded */
  status: string;
  signature_verified: boolean;
  /** verify | webhook | sweep | staff | system */
  recorded_via: string;
  error_code: string | null;
  error_description: string | null;
  /** Anything staff should look at (amount mismatch, unverified confirmation, …). */
  note: string | null;
  gateway_email: string | null;
  gateway_contact: string | null;
  refund_id: string | null;
  refunded_at: string | null;
  /** Webhook / confirmation events seen for this payment, for de-duplication and audit. */
  events: { event: string; id: string | null; at: string }[];
  created_at: string;
  updated_at: string;
}
