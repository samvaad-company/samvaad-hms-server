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
  otRooms: "ot_rooms",
  otEquipment: "ot_equipment",
  hospitals: "hospitals",
  radiologyCenters: "radiology_centers",
  hospitalRadiologyLinks: "hospital_radiology_links",
  labCenters: "lab_centers",
  hospitalLabLinks: "hospital_lab_links",
  platformBills: "platform_bills",
  auditLogs: "audit_logs",
  bloodDonors: "blood_donors",
  bloodUnits: "blood_units",
  bloodCrossmatches: "blood_crossmatches",
  bloodTransfusions: "blood_transfusions",
  mrdLocations: "mrd_locations",
  mrdFiles: "mrd_files",
  mrdFileRequests: "mrd_file_requests",
  mrdFileMovements: "mrd_file_movements",
  mrdRetentionPolicies: "mrd_retention_policies",
  mrdFolders: "mrd_folders",
  mrdCodingCases: "mrd_coding_cases",
  mrdDeficiencies: "mrd_deficiencies",
  mrdRegisterEntries: "mrd_register_entries",
  signatureRequests: "signature_requests",
  consentTemplates: "consent_templates",
  cssdSterilizers: "cssd_sterilizers",
  cssdSets: "cssd_sets",
  cssdCycles: "cssd_cycles",
  cssdIssues: "cssd_issues",
  cssdSettings: "cssd_settings",
  hrLeaveTypes: "hr_leave_types",
  hrLeaveRequests: "hr_leave_requests",
  setupRecords: "setup_records",
  billItems: "bill_items",
  billPayouts: "bill_payouts",
  pharmacyBatches: "pharmacy_batches",
  pharmacyDispenses: "pharmacy_dispenses",
  pharmacyDispenseLines: "pharmacy_dispense_lines",
  pharmacyReturns: "pharmacy_returns",
  hrShifts: "hr_shifts",
  hrRoster: "hr_roster",
  hrSalaries: "hr_salaries",
  hrPayrollRuns: "hr_payroll_runs",
  hrPayslips: "hr_payslips",
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
  ipdVitals: "ipd_vitals",
  ipdIvLines: "ipd_iv_lines",
  ipdDoseLog: "ipd_dose_log",
  ipdNursingTasks: "ipd_nursing_tasks",
  ipdHandovers: "ipd_handovers",
  ipdAlertAcks: "ipd_alert_acks",
  ipdChecklistTemplates: "ipd_checklist_templates",
  ipdChecklists: "ipd_checklists",
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
  /** Setup → Masters: a short code, the clinical specialty, whether it sees patients, and whether it is in use. */
  code?: string | null;
  specialty?: string | null;
  clinical?: boolean | null;
  active?: boolean | null;
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
  /** EMP-1001; older rows have none (the DTO derives one). */
  employee_no?: string;
  gender?: string;
  dob?: string | null;
  address?: string;
  qualification?: string;
  licence_no?: string;
  licence_expiry?: string | null;
  emergency_name?: string;
  emergency_phone?: string;
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
  /** Names from Setup → Masters (patient categories, income groups, visit purposes). */
  patient_category?: string | null;
  income_group?: string | null;
  visit_purpose?: string | null;
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
  /** A visit purpose from Setup → Masters. */
  visit_purpose?: string | null;
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
  /** ₹ per unit the counter charges; remembered from the first price entered at dispensing when unset. */
  unit_price?: number | null;
  created_at: string;
  updated_at: string;
}

/** A lot of one medicine in stock. The batches of an item add up to its `stock`. */
export interface PharmacyBatchRow extends Row {
  id: number;
  hospital_id: number;
  item_id: number;
  batch_no: string;
  /** YYYY-MM-DD, or empty when the pack carries none. */
  expiry_date: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

/** One trip to the dispensing counter: who it was for, how it was billed, and what went out. */
export interface PharmacyDispenseRow extends Row {
  id: number;
  hospital_id: number;
  /** DSP/26/00001 */
  dispense_no: string;
  patient_id: number | null;
  patient_name: string;
  walk_in_note: string;
  prescription_id: number | null;
  rx_number: string;
  /** none | separate | patient */
  billing: string;
  bill_id: number | null;
  bill_number: string | null;
  admission_id: number | null;
  admission_no: string | null;
  subtotal: number;
  /** Dispensed | Part returned | Returned */
  status: string;
  dispensed_by: string;
  created_at: string;
  updated_at: string;
}

/** One batch drawn from: a single medicine may span several lines when its stock sits in more than one batch. */
export interface PharmacyDispenseLineRow extends Row {
  id: number;
  hospital_id: number;
  dispense_id: number;
  item_id: number;
  medicine_name: string;
  batch_id: number | null;
  batch_no: string;
  expiry_date: string;
  quantity: number;
  returned_qty: number;
  unit_price: number;
  line_total: number;
  created_at: string;
  updated_at: string;
}

export interface PharmacyReturnRow extends Row {
  id: number;
  hospital_id: number;
  dispense_id: number;
  line_id: number;
  medicine_name: string;
  batch_no: string;
  quantity: number;
  /** Usable | Damaged | Expired — usable goes back into its batch, the others are written off. */
  condition: string;
  /** CN/26/00001 when the dispense was billed; empty otherwise. */
  credit_note_no: string;
  credit_value: number;
  reason: string;
  returned_by: string;
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
  /** A payment mode from Setup → Masters, recorded when the bill is settled at the counter. */
  payment_mode?: string | null;
  /** The doctor the bill is in the name of — payout rules for doctors follow this. */
  doctor_id?: number | null;
  doctor_name?: string | null;
  /** The sponsor contract the bill was raised under (Setup → Sponsors), and what each side owes. */
  contract_id?: number | null;
  contract_name?: string | null;
  payer_share?: number;
  patient_share?: number | null;
  created_at: string;
  updated_at: string;
}

/** One charge on an invoice: a service from the catalogue (with its price and tax as they were billed) or a custom line. */
export interface BillItemRow extends Row {
  id: number;
  hospital_id: number;
  bill_id: number;
  service_id: number | null;
  code: string;
  name: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  hsn_sac: string;
  amount: number;
  /** What the contract pays for this line (0 on a self-pay bill). */
  payer_amount?: number;
  created_at: string;
  updated_at: string;
}

/** What a payout rule earns someone from one bill (a doctor, a referrer, an outside lab). */
export interface BillPayoutRow extends Row {
  id: number;
  hospital_id: number;
  bill_id: number;
  bill_number: string;
  bill_date: string;
  rule_id: number | null;
  rule_name: string;
  role: string;
  /** doctor | referral | centre */
  payee_type: string;
  payee_id: number | null;
  payee_name: string;
  basis: number;
  value_kind: string;
  value: number;
  amount: number;
  /** Pending | Paid | Void */
  status: string;
  paid_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface WardRow extends Row {
  id: number;
  hospital_id: number;
  name: string;
  capacity: number;
  /** ₹ per day for a bed in this ward; shown when picking a bed at admission. */
  daily_rate?: number;
  /** Setup → Ward classes; decides which rate plans and bed-charge service apply to a stay here. */
  ward_class_id?: number | null;
  /** Setup → Facility areas: where in the building the ward is. */
  facility_area_id?: number | null;
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
  /** ADM/2026/00003 — the number the ward and the bill know the admission by. */
  admission_no?: string;
  /** Emergency | Planned | Day care | Maternity | Transfer in */
  admission_type?: string;
  /** Medico-legal case: police intimation needed. */
  is_mlc?: boolean;
  family_name?: string;
  family_relation?: string;
  family_phone?: string;
  deposit_amount?: number;
  /** Cash | UPI | Card */
  deposit_mode?: string;
  primary_nurse_id?: number | null;
  primary_nurse?: string;
  expected_stay_days?: number | null;
  diet?: string;
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
  /** OT/2026/0008 — issued when the surgery is booked. */
  booking_no?: string;
  /** Elective | Emergency | Outdoor */
  case_type?: string;
  /** What the surgery is called on the register ("Open Appendectomy"); `procedure` keeps the free-text description. */
  surgery_name?: string;
  /** Major | Minor | Daycare */
  category?: string;
  procedure_code?: string;
  /** Planned length of the surgery, in minutes (the turnaround buffer is not included). */
  duration_min?: number;
  room_id?: number | null;
  co_surgeon_id?: number | null;
  co_surgeon?: string;
  anesthetist_id?: number | null;
  /** General (GA) | Spinal | Epidural | Local | Sedation (MAC) */
  anaesthesia_type?: string;
  scrub_nurse_id?: number | null;
  scrub_nurse?: string;
  circulating_nurse_id?: number | null;
  circulating_nurse?: string;
  technician_ids?: number[];
  technicians?: string[];
  equipment_ids?: number[];
  equipment?: string[];
  special_requirements?: string;
  /** The booker chose to skip the room / surgeon / equipment conflict check. */
  allow_overlap?: boolean;
  /** Pending | Fit | Unfit — anaesthetic fitness. Never blocks booking; blocks starting (emergencies excepted). */
  fitness?: string;
  started_at?: string | null;
  ended_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** A theatre. */
export interface OtRoomRow extends Row {
  id: number;
  hospital_id: number;
  name: string;
  /** Major | Minor | Daycare */
  kind: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** A piece of theatre equipment that can be booked with a surgery, or taken out of use for maintenance. */
export interface OtEquipmentRow extends Row {
  id: number;
  hospital_id: number;
  name: string;
  /** Available | Maintenance */
  status: string;
  note: string;
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
  /** BD/26/00080 — issued at registration. */
  donor_no?: string;
  name: string;
  /** Kept for donors registered before the date of birth was captured; newer ones derive age from `dob`. */
  age: number;
  gender: string;
  /** "A+", "O-", … */
  blood_group: string;
  phone: string;
  dob?: string | null;
  /**
   * Only the TYPE and the LAST FOUR characters of the ID proof are ever stored — never the full number.
   * `aadhaar_number` is the old field and is no longer written.
   */
  id_proof_type?: string;
  id_proof_last4?: string;
  aadhaar_number?: string;
  last_donation_date: string;
  total_donations: number;
  /** Eligible | Deferred */
  status: string;
  deferral_reason?: string;
  /** yyyy-mm-dd the deferral ends, or null for an open-ended one. */
  deferred_until?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SerologyResult {
  hiv: string;
  hbsag: string;
  hcv: string;
  malaria: string;
  syphilis: string;
}

/** One bag of blood or one blood component, from collection until it is transfused or discarded. */
export interface BloodUnitRow extends Row {
  id: number;
  hospital_id: number;
  /** BU/26/00262 — minted on the server at collection. */
  unit_no: string;
  /** Donation | Purchased */
  source: string;
  donor_id: number | null;
  donor_no: string;
  /** Where a purchased unit came from. */
  supplier: string;
  bag_no: string;
  blood_group: string;
  /** Whole blood | PRBC | Platelets | Plasma | Cryoprecipitate */
  component: string;
  volume_ml: number;
  collected_on: string;
  expiry_on: string;
  /** "" = not tested yet, else Negative | Reactive, for each of the five mandatory tests. */
  serology: SerologyResult;
  serology_by: string | null;
  serology_on: string | null;
  /** Quarantined | Available | Cross-matched | Issued | Processed | Discarded */
  status: string;
  /** The donation this unit came from — a processed whole blood and its components share it, and so share serology. */
  root_unit_id: number | null;
  parent_unit_id: number | null;
  /** The day the unit left stock (issued, processed or discarded), for the "as on a date" stock register. */
  left_on: string | null;
  discard_reason: string;
  discarded_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** A request to cross-match a unit against a patient; the unit is held for it while it is open. */
export interface BloodCrossmatchRow extends Row {
  id: number;
  hospital_id: number;
  /** XM/26/00012 */
  xm_no: string;
  patient_id: number | null;
  patient_name: string;
  patient_code: string;
  unit_id: number;
  unit_no: string;
  unit_group: string;
  unit_component: string;
  requested_at: string;
  requested_by: string;
  /** pending | compatible | incompatible */
  result: string;
  result_by: string | null;
  result_at: string | null;
  /** requested | resulted | issued | cancelled */
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TransfusionReaction {
  at: string;
  by: string;
  kind: string;
  /** Mild | Moderate | Severe */
  severity: string;
  note: string;
}

/** A compatible, cross-matched unit handed over for a patient, and what became of it. */
export interface BloodTransfusionRow extends Row {
  id: number;
  hospital_id: number;
  /** BI/26/00027 */
  issue_no: string;
  crossmatch_id: number;
  patient_id: number | null;
  patient_name: string;
  patient_code: string;
  unit_id: number;
  unit_no: string;
  unit_group: string;
  unit_component: string;
  issued_at: string;
  issued_by: string;
  /** When the transfusion finished, or null while it hasn't. */
  transfused_at: string | null;
  transfused_by: string | null;
  /** "" | "returned · restock" | "returned · wasted" */
  disposition: string;
  returned_at: string | null;
  reactions: TransfusionReaction[];
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
  /** yyyy-mm-dd the lead is to be called back (named for the old "follow up" wording; not a patient follow-up). */
  follow_up_on: string | null;
  notes: string;
  /** Open → Contacted → Converted (became a patient) or Closed (lost). */
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

/** One set of bedside observations. `recorded_at` is a full ISO instant. */
export interface IpdVitalRow extends Row {
  id: number;
  hospital_id: number;
  admission_id: number;
  recorded_at: string;
  temp_c: number | null;
  pulse: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  spo2: number | null;
  resp_rate: number | null;
  note: string;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

/** A bottle / bag of IV fluid running on a patient. */
export interface IpdIvLineRow extends Row {
  id: number;
  hospital_id: number;
  admission_id: number;
  fluid: string;
  volume_ml: number;
  rate_ml_hr: number;
  started_at: string;
  stopped_at: string | null;
  /** Running | Stopped | Completed */
  status: string;
  started_by: string;
  note: string;
  created_at: string;
  updated_at: string;
}

/** What happened to one scheduled dose of a medication: given, or held back on purpose. */
export interface IpdDoseLogRow extends Row {
  id: number;
  hospital_id: number;
  admission_id: number;
  medication_id: number;
  /** The slot this entry answers, as a full ISO instant. */
  scheduled_at: string;
  /** Given | Held */
  status: string;
  given_at: string;
  given_by: string;
  note: string;
  created_at: string;
  updated_at: string;
}

/** A job or reminder for the ward — optionally about one admission. */
export interface IpdNursingTaskRow extends Row {
  id: number;
  hospital_id: number;
  admission_id: number | null;
  title: string;
  /** Full ISO instant, or null when it has no time. */
  due_at: string | null;
  /** To do | Done */
  status: string;
  created_by: string;
  done_by: string | null;
  done_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A shift-handover note about one patient. */
export interface IpdHandoverRow extends Row {
  id: number;
  hospital_id: number;
  admission_id: number;
  /** Morning | Evening | Night */
  shift: string;
  /** yyyy-mm-dd the shift started. */
  shift_date: string;
  note: string;
  author: string;
  created_at: string;
  updated_at: string;
}

/** An alert a nurse has acknowledged or dismissed. Alerts are derived, so they are identified by a stable key. */
export interface IpdAlertAckRow extends Row {
  id: number;
  hospital_id: number;
  alert_key: string;
  /** Acknowledged | Dismissed */
  action: string;
  by: string;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItemDef {
  key: string;
  label: string;
  required: boolean;
  /** Sub-lines ticked individually under this heading. */
  children?: { key: string; label: string }[];
}

export interface IpdChecklistTemplateRow extends Row {
  id: number;
  hospital_id: number;
  name: string;
  /** "Inpatient (IPD)" | "OPD" — where it is used. */
  scope: string;
  description: string;
  items: ChecklistItemDef[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChecklistTick {
  done: boolean;
  by: string | null;
  at: string | null;
}

export interface IpdChecklistRow extends Row {
  id: number;
  hospital_id: number;
  template_id: number | null;
  name: string;
  scope: string;
  admission_id: number | null;
  patient_id: number | null;
  patient_name: string;
  patient_code: string;
  /** The template's items, copied at start so later template edits never change a running checklist. */
  items: ChecklistItemDef[];
  /** Tick state by item / child key. */
  ticks: Record<string, ChecklistTick>;
  /** In progress | Complete | Cancelled */
  status: string;
  started_by: string;
  completed_by: string | null;
  completed_at: string | null;
  cancelled_reason: string | null;
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
  /** The name shown in lists; defaults to the file name. */
  title?: string | null;
  /** A paper's own reference or certificate number. */
  reference_no?: string | null;
  /** MRD folder the file is kept in (null = not filed). */
  folder_id?: number | null;
  /** Retention state: Active | Due | Extended. A null state means Active. (A disposed document is deleted; its audit entry is the record.) */
  retention_state?: string | null;
  /** Extended to this date by a reviewer; until then the policy's years decide. */
  retain_until?: string | null;
  retention_note?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
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

// ── MRD (medical records department) ─────────────────────────────────────────

/** A named home a patient file can live in: a rack, an archive room, a nurse station, a doctor's cabin. */
export interface MrdLocationRow extends Row {
  id: number;
  hospital_id: number;
  name: string;
  /** MRD rack | Archive room | Operation theatre | Nurse station | Doctor cabin | Other */
  kind: string;
  code: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** One physical patient file (folder of papers). `status` and `location_id` say where it is right now. */
export interface MrdFileRow extends Row {
  id: number;
  hospital_id: number;
  /** F/2026/00017 */
  file_no: string;
  patient_id: number;
  patient_name: string;
  patient_code: string;
  /** OPD | IPD */
  file_type: string;
  /** Available | Checked out | In transit | Archived */
  status: string;
  location_id: number | null;
  location_name: string;
  /** Where it goes back to on return / retrieve — normally the rack its UHID range belongs to. */
  home_location_id: number | null;
  holder_name: string | null;
  due_on: string | null;
  checked_out_at: string | null;
  archived_on: string | null;
  created_at: string;
  updated_at: string;
}

/** A ward or doctor asking MRD for a file. */
export interface MrdFileRequestRow extends Row {
  id: number;
  hospital_id: number;
  file_id: number;
  file_no: string;
  patient_id: number;
  patient_name: string;
  /** Routine | Urgent */
  urgency: string;
  /** Pending | Dispatched | Returned | Cancelled */
  status: string;
  requested_on: string;
  requested_by: string;
  /** Who the file is for (a person or a department). */
  requested_for: string;
  destination_id: number | null;
  destination_name: string;
  note: string;
  dispatched_at: string | null;
  dispatched_by: string | null;
  returned_at: string | null;
  returned_by: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The trail of a file: every time it was created, handed out, brought back, moved or archived. */
export interface MrdFileMovementRow extends Row {
  id: number;
  hospital_id: number;
  file_id: number;
  file_no: string;
  /** Created | Checked out | Dispatched | Returned | Moved | Archived | Retrieved */
  action: string;
  from_location: string;
  to_location: string;
  holder_name: string | null;
  due_on: string | null;
  note: string;
  by_name: string;
  at: string;
  created_at: string;
  updated_at: string;
}

/** How long a class of documents is kept before it is flagged for review. */
export interface MrdRetentionPolicyRow extends Row {
  id: number;
  hospital_id: number;
  name: string;
  /** Clinical | Financial | KYC | Statutory */
  class: string;
  retention_years: number;
  /** Document categories this policy covers (lower-cased match). */
  categories: string[];
  /** What a reviewer is expected to do once due: Review | Destroy */
  action_after: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MrdFolderRow extends Row {
  id: number;
  hospital_id: number;
  name: string;
  /** Clinical | Financial | KYC | Statutory | General */
  class: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface MrdCodingDiagnosis {
  /** ICD-10-CM code, e.g. E03.9 */
  code: string;
  text: string;
}

/** A discharged admission waiting for its diagnosis and procedure codes (ICD-10) and a sign-off. */
export interface MrdCodingCaseRow extends Row {
  id: number;
  hospital_id: number;
  admission_id: number;
  admission_no: string;
  patient_id: number | null;
  patient_name: string;
  patient_code: string;
  doctor: string;
  admitted_on: string;
  /** Pending | In review | Deficient | Coded | Signed off */
  status: string;
  principal_dx_code: string;
  principal_dx_text: string;
  secondary_dx: MrdCodingDiagnosis[];
  procedures: MrdCodingDiagnosis[];
  coder_name: string | null;
  coded_at: string | null;
  signed_off_by: string | null;
  signed_off_at: string | null;
  queued_at: string;
  created_at: string;
  updated_at: string;
}

/** Something missing from the chart that stops it being coded or signed off. */
export interface MrdDeficiencyRow extends Row {
  id: number;
  hospital_id: number;
  case_id: number;
  kind: string;
  note: string;
  /** Open | Resolved */
  status: string;
  raised_by: string;
  raised_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * One line of a statutory register (birth, death). Entries are permanent: a correction is a new entry that
 * `amends_id` the old one, and the old one is marked `superseded_by`. Nothing is edited in place.
 */
export interface MrdRegisterEntryRow extends Row {
  id: number;
  hospital_id: number;
  /** birth | death */
  register: string;
  /** BR/2026/00001 */
  entry_no: string;
  entry_date: string;
  /** The register's own fields (mother's name, weight, cause of death…). */
  data: Record<string, string>;
  report_to: string;
  filed_by: string;
  filed_at: string;
  amends_id: number | null;
  superseded_by: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * A consent / declaration form for a patient. It is made first (Draft), can be printed for signing on paper, or a
 * link is created for the patient to sign on a phone (Waiting) — the link's random token is the credential. A link
 * can be cancelled or expire and a new one made; a form signed on paper is recorded with its scanned copy.
 */
export interface SignatureRequestRow extends Row {
  id: number;
  hospital_id: number;
  patient_id: number | null;
  patient_name: string;
  patient_code: string;
  patient_phone: string;
  /** Key of the form: a built-in one from consent-catalog.ts or `custom-…` for the hospital's own; blank for older rows. */
  template_key?: string;
  /** The form's wording in every language it has, as it was when this consent was made (placeholders filled in). */
  template_texts?: Record<string, { title: string; body: string }> | null;
  form_title: string;
  form_body: string;
  /** English | Hindi | Gujarati */
  language: string;
  /** Show / print the English text after the patient's language. */
  include_english?: boolean;
  /** The live link's token; null until a link is made. */
  token: string | null;
  /** Draft | Waiting | Signed | Refused | Cancelled  (Expired is Waiting past `expires_at`) */
  status: string;
  /** Who made the form. */
  sent_by: string;
  /** When the form was made. */
  sent_at: string;
  /** When the live link stops working; null until a link is made. */
  expires_at: string | null;
  link_sent_at?: string | null;
  /** qr | email | whatsapp | device */
  delivery?: string | null;
  opened_at?: string | null;
  signed_at: string | null;
  signer_name: string | null;
  signer_relation?: string | null;
  /** phone | paper */
  signed_via?: string | null;
  signed_language?: string | null;
  witness_name?: string | null;
  /** The scanned paper copy (a documents row). */
  signed_document_id?: number | null;
  /** PNG data URL of the drawn signature (phone signing). */
  signature_data: string | null;
  refused_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A consent form the hospital wrote itself (the built-in ones live in code). `{{patient_name}}`, `{{age}}` and `{{date}}` are filled in when a consent is made. */
export interface ConsentTemplateRow extends Row {
  id: number;
  hospital_id: number;
  /** custom-ab12cd34 */
  key: string;
  /** Title per language (English required). */
  titles: Record<string, string>;
  /** Body per language (English required). */
  bodies: Record<string, string>;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ── CSSD ─────────────────────────────────────────────────────────────────────

export interface CssdSterilizerRow extends Row {
  id: number;
  hospital_id: number;
  name: string;
  /** One of STERILIZATION_METHODS. */
  method: string;
  location: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** An instrument set that goes round and round: used → dirty → packed → in a cycle → sterile → issued → returned. */
export interface CssdSetRow extends Row {
  id: number;
  hospital_id: number;
  /** CS-00009 — for the life of the set. */
  set_no: string;
  name: string;
  type: string;
  department_id: number | null;
  department_name: string;
  instruments: { name: string; qty: number }[];
  usage_charge: number;
  /** Dirty | Packed | In cycle | Sterile | Issued  (a Sterile set past `sterile_until` reads as "Expired sterility") */
  status: string;
  packaging: string | null;
  sterile_until: string | null;
  last_cycle_id: number | null;
  times_processed: number;
  created_at: string;
  updated_at: string;
}

export interface CssdCycleRow extends Row {
  id: number;
  hospital_id: number;
  /** CC/26/00035 */
  cycle_no: string;
  sterilizer_id: number;
  sterilizer_name: string;
  method: string;
  started_at: string;
  started_by: string;
  set_ids: number[];
  temp_c: number;
  pressure_psi: number;
  exposure_min: number;
  /** pending | pass | fail */
  indicator: string;
  /** Running | Passed | Failed | Quarantined */
  status: string;
  result_by: string | null;
  result_at: string | null;
  note: string;
  created_at: string;
  updated_at: string;
}

/** A request for a set and, once fulfilled, its issue to a patient and return. */
export interface CssdIssueRow extends Row {
  id: number;
  hospital_id: number;
  /** CI/26/00001 — minted at issue. */
  issue_no: string | null;
  set_id: number;
  set_no: string;
  set_name: string;
  patient_id: number | null;
  patient_name: string;
  department_name: string;
  case_id: number | null;
  case_label: string;
  /** Requested | Issued | Returned | Cancelled */
  status: string;
  requested_at: string;
  requested_by: string;
  issued_at: string | null;
  issued_by: string | null;
  expected_back: string | null;
  returned_at: string | null;
  returned_by: string | null;
  investigate: boolean;
  return_note: string;
  charge: number;
  bill_number: string | null;
  created_at: string;
  updated_at: string;
}

/** A hospital's changes to the default shelf lives: { "Dry heat": { "Wrapped": 10 } }. */
export interface CssdSettingsRow extends Row {
  id: number;
  hospital_id: number;
  shelf_life: Record<string, Record<string, number>>;
  created_at: string;
  updated_at: string;
}

// ── HR ───────────────────────────────────────────────────────────────────────

export interface HrLeaveTypeRow extends Row {
  id: number;
  hospital_id: number;
  name: string;
  code: string;
  /** Days a person gets each calendar year; 0 on a type that is not paid means no limit. */
  days_per_year: number;
  paid: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HrLeaveRequestRow extends Row {
  id: number;
  hospital_id: number;
  staff_id: number;
  staff_name: string;
  department: string;
  leave_type_id: number;
  type_name: string;
  type_code: string;
  paid: boolean;
  from_date: string;
  to_date: string;
  days: number;
  reason: string;
  /** Pending | Approved | Rejected | Cancelled */
  status: string;
  applied_by: string;
  applied_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string;
  created_at: string;
  updated_at: string;
}

export interface HrShiftRow extends Row {
  id: number;
  hospital_id: number;
  name: string;
  code: string;
  /** HH:MM, 24-hour */
  start: string;
  end: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** One person's shift on one date. A person has at most one shift a day. */
export interface HrRosterRow extends Row {
  id: number;
  hospital_id: number;
  staff_id: number;
  work_date: string;
  shift_id: number;
  created_at: string;
  updated_at: string;
}

export interface HrSalaryRow extends Row {
  id: number;
  hospital_id: number;
  staff_id: number;
  basic: number;
  hra: number;
  allowances: number;
  pf_percent: number;
  prof_tax: number;
  other_deduction: number;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface HrPayrollRunRow extends Row {
  id: number;
  hospital_id: number;
  /** YYYY-MM */
  month: string;
  /** Draft | Finalized */
  status: string;
  staff_count: number;
  total_gross: number;
  total_net: number;
  created_by: string;
  finalized_by: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HrPayslipRow extends Row {
  id: number;
  hospital_id: number;
  run_id: number;
  staff_id: number;
  staff_name: string;
  employee_no: string;
  role: string;
  department: string;
  month: string;
  month_days: number;
  paid_days: number;
  unpaid_leave_days: number;
  lop_adjust: number;
  absent_days: number;
  basic: number;
  hra: number;
  allowances: number;
  gross: number;
  pf: number;
  prof_tax: number;
  other_deduction: number;
  net_pay: number;
  created_at: string;
  updated_at: string;
}

/**
 * One entry of a Setup master (a service, a rate plan, a ward class…) or a configuration singleton. `kind` names the master
 * (see SETUP_KINDS in src/types/setup.ts); `data` holds the fields that master needs beyond code, name and active.
 */
export interface SetupRecordRow extends Row {
  id: number;
  hospital_id: number;
  kind: string;
  /** Short code, unique within a kind (empty for kinds without one). */
  code: string;
  name: string;
  active: boolean;
  sort_order: number;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
