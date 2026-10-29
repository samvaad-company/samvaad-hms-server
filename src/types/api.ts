/**
 * API DTOs shared by the server (mappers) and client (hooks).
 *
 * These extend the base display types in `@/types` with the additional fields
 * returned by detail endpoints. Keeping them here ensures the request/response
 * contract is type-checked on both ends.
 */
import type {
  Patient,
  Appointment,
  OpdRecord,
  Doctor,
  Prescription,
  PharmacyItem,
  LabTest,
  Bill,
  IpdRecord,
  OtRecord,
  Bed,
  Staff,
  Gender,
  BloodGroup,
  DonorStatus,
  RadiologyStatus,
  RadiologyPriority,
  LabPriority,
  AmbulanceStatus,
  AmbulanceCallStatus,
  TpaStatus,
  ClaimStatus,
  InventoryStatus,
  TaskStatus,
  TaskPriority,
  ScribeStatus,
} from "./index";

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiList<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiItem<T> {
  data: T;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

// ── Extended DTOs ────────────────────────────────────────────────────────────

export interface PatientDTO extends Patient {
  email: string | null;
  dob: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  allergies: string[];
  chronicConditions: string[];
  abhaId: string | null;
  emergencyName: string | null;
  emergencyRelation: string | null;
  emergencyPhone: string | null;
  insurer: string | null;
  policyNumber: string | null;
  corporate: string | null;
  doctorId: number | null;
  ageMonths: number | null;
  referralSource: string | null;
  /** Names from Setup → Masters. */
  patientCategory: string | null;
  incomeGroup: string | null;
  visitPurpose: string | null;
  medicoLegal: boolean;
  temporary: boolean;
  dataConsent: boolean;
  alternatePhone: string | null;
  addressLine2: string | null;
  title: string | null;
  guardianName: string | null;
  careOf: string | null;
  anniversary: string | null;
  maritalStatus: string | null;
  religion: string | null;
  language: string | null;
  nationality: string | null;
  education: string | null;
  notes: string | null;
  occupation: string | null;
  employer: string | null;
  designation: string | null;
  workPhone: string | null;
  privilegeCardNo: string | null;
  payers: { type: string; name: string; policyNumber: string; validUntil: string | null }[];
  /** Identity documents on file — only the type and last four characters are ever returned. */
  identityDocuments: { type: string; last4: string }[];
  covid: { vaccination: string | null; lastDose: string | null; infectedBefore: boolean } | null;
}

export interface PrescriptionItemDTO {
  id: number;
  prescriptionId: number;
  medicineId: number | null;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  /** Generic (salt) name from the medicine master, when the item is linked to one. Detail view only. */
  generic?: string | null;
}

/** The patient facts a prescription is read against. Detail view only. */
export interface PrescriptionPatientDTO {
  code: string | null;
  gender: string | null;
  allergies: string | null;
  chronicConditions: string | null;
}

export interface PrescriptionDTO extends Prescription {
  patientId: number | null;
  doctorId: number | null;
  items: PrescriptionItemDTO[];
  /** Present on the single-prescription fetch; the list omits it. */
  patient?: PrescriptionPatientDTO | null;
}

export type RxFindingSeverity = "critical" | "warning" | "info";
export type RxFindingCategory = "Allergy" | "Interaction" | "Dose" | "Condition" | "Pregnancy" | "Duplicate" | "Indication" | "Note";

export interface RxAiFinding {
  category: RxFindingCategory;
  severity: RxFindingSeverity;
  /** Medicines the finding is about, as written on the prescription. */
  medicines: string[];
  detail: string;
  /** What the prescriber or pharmacist should do about it. */
  action: string;
}

/** Advisory AI safety review of one prescription — never a substitute for the prescriber's judgement. */
export interface RxAiReviewDTO {
  /** hold = at least one critical finding; review = warnings only; clear = nothing found. */
  verdict: "clear" | "review" | "hold";
  summary: string;
  findings: RxAiFinding[];
  /** Plain-language points to tell the patient. */
  tellPatient: string[];
  checked: { medicines: number; allergies: number; conditions: number };
  model: string | null;
  /** True when this is a stored result for an unchanged prescription rather than a fresh run. */
  cached: boolean;
  /** True when the AI did not run (no key configured, or the call failed) and only the built-in checks did. */
  mock: boolean;
  reason: "live" | "no-key" | "api-error";
  detail?: string;
  reviewedAt: string;
}

export interface PrescriptionTemplateItemDTO {
  medicineId: number | null;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

/** A doctor's personal "quick fill" prescription template. */
export interface PrescriptionTemplateDTO {
  id: number;
  doctorId: number;
  name: string;
  items: PrescriptionTemplateItemDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface DoctorDTO extends Doctor {
  departmentId: number | null;
  /** How many patients this doctor sees per hour, and the resulting minutes per patient. */
  patientsPerHour: number;
  slotMinutes: number;
  /** The doctor takes video consultations (needs the hospital's switch on as well) and the weekly hours reserved for them. */
  videoEnabled: boolean;
  videoHours: { day: string; start: string; end: string }[];
}

export interface DoctorScheduleDTO {
  doctorId: number;
  doctorName: string;
  patientsPerHour: number;
  slotMinutes: number;
  patientsPerHourOptions: number[];
  videoEnabled: boolean;
  videoHours: { day: string; start: string; end: string }[];
  /** The hospital's switch (Admin → Settings): when false the doctor can't take video whatever their own setting says. */
  hospitalVideoEnabled: boolean;
  /** Video is really on for this doctor: their switch AND the hospital's. */
  videoActive: boolean;
  warnings: string[];
}

export interface SlotsDTO {
  mode: "in_person" | "video";
  isOpen: boolean;
  closedReason: string | null;
  doctorName: string;
  patientsPerHour: number;
  slotMinutes: number;
  /** open: can be booked · booked: that exact time is taken · full: the hour's places are used up. */
  slots: { value: string; label: string; status: "open" | "booked" | "full" }[];
  hours: { label: string; booked: number; capacity: number; full: boolean }[];
  note: string;
}

export interface AppointmentDTO extends Appointment {
  /** A visit purpose from Setup → Masters. */
  visitPurpose: string | null;
  patientId: number | null;
  doctorId: number | null;
  /** Tele-consult only: the join link, once created (Google Meet or pasted by staff). */
  videoUrl: string | null;
  videoProvider: string | null;
  /** Tele-consult only: why the Meet link couldn't be created automatically. */
  meetError: string | null;
  /** Tele-consult only: who can join the Meet room without being let in (OPEN | TRUSTED | RESTRICTED), or "calendar-default" (invited guests only). */
  meetAccess: string | null;
  /** How many times the appointment has been moved, and what it was before the last move. */
  rescheduleCount: number;
  rescheduledFrom: string | null;
  /** Tele-consult only: set when the room doesn't have the access type the hospital chose, so a patient may not be able to join. */
  meetWarning: string | null;
  consultAmount: number | null;
  paymentStatus: string | null;
  /** Tele-consult only: the gateway payment id (or staff receipt) and order id that paid for this appointment. */
  paymentId: string | null;
  orderId: string | null;
}

export interface TeleconsultSlotsDTO {
  isOpen: boolean;
  closedReason: string | null;
  slots: { value: string; label: string }[];
}

export interface TeleconsultBookingLinkDTO {
  token: string;
  path: string;
  expiresAt: number;
  patientName: string;
  patientPhone: string;
}

export interface TeleconsultPaymentDTO {
  id: number;
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
  amount: number;
  currency: string;
  /** razorpay | mock | cash | upi | card | waived | free */
  mode: string;
  /** portal | link | staff */
  source: string;
  status: "Paid" | "Refunded" | "Waived" | "Free" | "Awaiting payment" | "Expired" | "Slot lost" | "Cancelled" | "Failed";
  patientId: number;
  doctorId: number;
  /** card / upi / netbanking … when the gateway told us. */
  method: string | null;
  /** What recorded the payment: verify (patient's confirmation), webhook, sweep or staff. */
  recordedVia: string | null;
  signatureVerified: boolean | null;
  paymentId: string | null;
  orderId: string | null;
  paidAt: string | null;
  refundReference: string | null;
  refundedAt: string | null;
  appointmentId: number | null;
  note: string | null;
  createdAt: string;
}

export interface TeleconsultPaymentsDTO {
  items: TeleconsultPaymentDTO[];
  totals: { collected: number; refunded: number; net: number; count: number };
}

export interface TeleconsultConfigDTO {
  enabled: boolean;
  price: number | null;
  currency: string;
  gatewayMode: "razorpay" | "mock" | "off";
  google: { configured: boolean; connected: boolean; needsReconnect: boolean; meetAccessControl: boolean; lastError: string | null; accountEmail: string };
}

export interface OpdRecordDTO extends OpdRecord {
  patientId: number | null;
  doctorId: number | null;
}

export interface LabTestDTO extends LabTest {
  hospitalId: number;
  orderNumber: string;
  requestedBy: string;
  doctorId: number | null;
  doctor: string;
  /** Set by the ordering doctor; the worklist sorts and tags on it. */
  priority: LabPriority;
  /** The patient's hospital ID (UHID), when the test is linked to a patient record. */
  patientCode: string | null;
  collectionDate: string;
  /** The price is the routed-to center's call, not the hospital's — only a discount is captured here. */
  discount: number;
  discountType: "percent" | "amount";
  patientId: number | null;
  /** Null when kept in-house; set once routed to a linked lab center. */
  labCenterId: number | null;
  labCenterName: string | null;
  /** Set only when a lab-center account is viewing — its own hospital is implicit otherwise. */
  hospitalName: string | null;
  /** True when a report document has been uploaded (fetch it via /lab/[id]/report). */
  hasReport: boolean;
  reportFileName: string | null;
  reportNote: string | null;
  reportUploadedBy: string | null;
  reportUploadedAt: string | null;
}

/** Fuller demographic/medical-safety detail for the patient behind one lab test — fetched via /lab/[id]/patient. */
export interface LabPatientDetailDTO {
  id: number;
  name: string;
  patientCode: string;
  age: number;
  gender: string;
  phone: string;
  email: string | null;
  bloodGroup: string | null;
  dob: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  allergies: string | null;
  chronicConditions: string | null;
}

export interface LabReportFileDTO {
  fileName: string;
  /** Firebase Storage download URL for the report document (PDF or image). */
  fileUrl: string;
  note: string | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
}

export interface BillItemDTO {
  /** What the contract pays for this line (only on an insured bill). */
  payerAmount?: number;
  id: number;
  serviceId: number | null;
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  hsnSac: string;
  amount: number;
}

export interface BillDTO extends Bill {
  patientId: number | null;
  /** A payment mode from Setup → Masters, when the bill was settled at the counter. */
  paymentMode?: string | null;
  /** The lines of an invoice raised from the service catalogue (only on a single bill, not in lists). */
  items?: BillItemDTO[];
  /** The doctor the bill is in the name of. */
  doctorName?: string;
  /** Set when the bill was raised under a sponsor contract: who the payer is and what each side owes. */
  contractId?: number;
  contractName?: string;
  payerShare?: number;
  patientShare?: number;
}

/** One service the billing counter can pick, priced from the patient's rate plan and taxed from its GST mapping. */
export interface BillingServiceDTO {
  id: number;
  code: string;
  name: string;
  group: string;
  unit: string;
  price: number;
  gstApplies: boolean;
  gstRate: number;
  hsnSac: string;
  /** The service's group and its parents, nearest first — copay rules are per group. */
  groupIds: number[];
  groupNames: string[];
}

/** A sponsor contract the patient is covered under, with the rules that split an invoice. */
export interface BillingContractDTO {
  id: number;
  name: string;
  sponsor: string;
  sponsorType: string;
  validFrom: string | null;
  validTo: string | null;
  /** The plan this contract prices from, when it names one. */
  ratePlan: string;
  terms: import("./coverage").CoverageTerms;
  past: import("./coverage").CoveragePast;
}

export interface BillingCatalogDTO {
  /** The rate plan prices came from; null when the hospital has none. */
  planId: number | null;
  planName: string;
  services: BillingServiceDTO[];
  /** Active payment modes from Setup → Masters. */
  paymentModes: string[];
  settings: { gstOnBills: boolean; pricesInclusive: boolean; roundOff: boolean; invoicePrefix: string };
  /** Contracts the patient is covered under today (empty for self-pay patients). */
  contracts: BillingContractDTO[];
  /** The contract the prices above came from, if one was chosen. */
  contractId: number | null;
  /** Doctors a bill can be raised in the name of. */
  doctors: { id: number; name: string }[];
}

export type IpdAdmissionType = "Emergency" | "Planned" | "Day care" | "Maternity" | "Transfer in";
export type DepositMode = "Cash" | "UPI" | "Card";

export interface IpdRecordDTO extends IpdRecord {
  // Note: IpdRecord.patientId is the patient *code* (e.g. HMS-0007).
  patientRefId: number | null;
  doctorId: number | null;
  bedId: number | null;
  wardId: number | null;
  /** ADM/2026/00003 */
  admissionNo: string;
  admissionType: IpdAdmissionType;
  isMlc: boolean;
  gender: string;
  familyName: string;
  familyRelation: string;
  familyPhone: string;
  depositAmount: number;
  depositMode: DepositMode | "";
  primaryNurseId: number | null;
  primaryNurse: string;
  expectedStayDays: number | null;
  diet: string;
}

/** Live state of one admission, for the admissions list and the nurse station. */
export interface IpdLiveDTO {
  admissionId: number;
  /** The signed-in user is this patient's doctor or primary nurse. */
  mine: boolean;
  /** A doctor round was recorded today; when, and by whom. */
  seenToday: boolean;
  lastRoundAt: string | null;
  lastRoundBy: string | null;
  ivRunning: number;
  /** Doses inside their window right now, and ones that have passed it unrecorded. */
  dosesDue: number;
  dosesMissed: number;
  /** Next dose still to come today, as an ISO instant. */
  nextDoseAt: string | null;
  /** New medication orders nobody has acted on yet. */
  newOrders: number;
  vitalsDue: boolean;
  lastVitalsAt: string | null;
  openTasks: number;
  openChecklists: number;
  /** Whole days in hospital, counting the admission day as day 1. */
  stayDay: number;
}

export interface IpdBoardDTO {
  live: IpdLiveDTO[];
  /** Rounds seen today among the signed-in doctor's own patients, when they have any. */
  rounds: { seen: number; total: number } | null;
}

export interface IpdVitalDTO {
  id: number;
  admissionId: number;
  recordedAt: string;
  tempC: number | null;
  pulse: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  spo2: number | null;
  respRate: number | null;
  note: string;
  recordedBy: string;
}

export interface IpdIvLineDTO {
  id: number;
  admissionId: number;
  fluid: string;
  volumeMl: number;
  rateMlHr: number;
  startedAt: string;
  stoppedAt: string | null;
  status: "Running" | "Stopped" | "Completed";
  startedBy: string;
  note: string;
  /** When the bottle runs dry at its set rate. */
  endsAt: string;
}

export type DoseState = "upcoming" | "due" | "missed" | "given" | "held";

/** One scheduled dose of one medicine, with what became of it. */
export interface DoseSlotDTO {
  key: string;
  admissionId: number;
  medicationId: number;
  medicineName: string;
  dosage: string;
  route: string;
  scheduledAt: string;
  state: DoseState;
  givenAt: string | null;
  givenBy: string | null;
  note: string;
}

export interface IpdNursingTaskDTO {
  id: number;
  admissionId: number | null;
  title: string;
  dueAt: string | null;
  status: "To do" | "Done";
  createdBy: string;
  doneBy: string | null;
  doneAt: string | null;
  overdue: boolean;
}

export interface IpdHandoverDTO {
  id: number;
  admissionId: number;
  shift: "Morning" | "Evening" | "Night";
  shiftDate: string;
  note: string;
  author: string;
  createdAt: string;
}

export type IpdAlertKind = "Critical vitals" | "Dose missed" | "Dose held" | "IV bottle" | "New order" | "Nursing task";

export interface IpdAlertDTO {
  /** Stable across refreshes, so an acknowledgement sticks. */
  key: string;
  kind: IpdAlertKind;
  severity: "critical" | "warning" | "info";
  admissionId: number;
  patientName: string;
  patientCode: string;
  title: string;
  detail: string;
  /** ISO instant the alert is about. */
  at: string;
}

export interface NurseBoardDTO {
  alerts: IpdAlertDTO[];
  tasks: IpdNursingTaskDTO[];
}

export interface ChecklistItemDefDTO {
  key: string;
  label: string;
  required: boolean;
  children?: { key: string; label: string }[];
}

export interface ChecklistTickDTO {
  done: boolean;
  by: string | null;
  at: string | null;
}

export interface IpdChecklistTemplateDTO {
  id: number;
  name: string;
  scope: string;
  description: string;
  items: ChecklistItemDefDTO[];
  active: boolean;
  /** Tickable lines, counting each sub-line. */
  lineCount: number;
}

export interface IpdChecklistDTO {
  id: number;
  templateId: number | null;
  name: string;
  scope: string;
  admissionId: number | null;
  patientId: number | null;
  patientName: string;
  patientCode: string;
  items: ChecklistItemDefDTO[];
  ticks: Record<string, ChecklistTickDTO>;
  status: "In progress" | "Complete" | "Cancelled";
  startedBy: string;
  startedAt: string;
  completedBy: string | null;
  completedAt: string | null;
  cancelledReason: string | null;
  done: number;
  total: number;
  /** Required lines still unticked. */
  requiredLeft: number;
}

export type OtCaseType = "Elective" | "Emergency" | "Outdoor";
export type OtCategory = "Major" | "Minor" | "Daycare";
export type OtFitness = "Pending" | "Fit" | "Unfit";
export const OT_ANAESTHESIA_TYPES = ["General (GA)", "Spinal", "Epidural", "Local", "Sedation (MAC)"] as const;

export interface OtRecordDTO extends OtRecord {
  patientId: number | null;
  surgeonId: number | null;
  /** The patient's hospital ID (UHID), when linked to a patient record. */
  patientCode: string | null;
  /** OT/2026/0008 */
  bookingNo: string;
  caseType: OtCaseType;
  /** What the register calls it; `procedure` is the free-text description. */
  surgeryName: string;
  category: OtCategory;
  procedureCode: string;
  /** Planned length in minutes (turnaround excluded). */
  durationMin: number;
  /** Actual length once started and finished, else null. */
  actualMin: number | null;
  roomId: number | null;
  coSurgeonId: number | null;
  coSurgeon: string;
  anesthetistId: number | null;
  anaesthesiaType: string;
  scrubNurseId: number | null;
  scrubNurse: string;
  circulatingNurseId: number | null;
  circulatingNurse: string;
  technicianIds: number[];
  technicians: string[];
  equipmentIds: number[];
  equipment: string[];
  specialRequirements: string;
  allowOverlap: boolean;
  fitness: OtFitness;
  startedAt: string | null;
  endedAt: string | null;
  /** Start and end as minutes after midnight on `scheduledDate` (hospital time); null when the time can't be read. */
  startMinute: number | null;
  endMinute: number | null;
}

export interface OtRoomDTO {
  id: number;
  name: string;
  kind: OtCategory;
  active: boolean;
  /** Surgeries booked in it, so a room in use can't be deleted. */
  bookings: number;
}

export interface OtEquipmentDTO {
  id: number;
  name: string;
  status: "Available" | "Maintenance";
  note: string;
}

/** What the Book dialog offers — one call, so roles without staff access can still pick a team. */
export interface OtOptionsDTO {
  rooms: OtRoomDTO[];
  equipment: OtEquipmentDTO[];
  doctors: { id: number; name: string }[];
  nurses: { id: number; name: string }[];
  technicians: { id: number; name: string }[];
  /** Minutes of turnaround kept free after every surgery. */
  bufferMin: number;
}

export interface OtConflictDTO {
  kind: "room" | "surgeon" | "equipment";
  bookingId: number;
  /** The equipment or doctor that clashes, so the dialog can mark it. */
  refId?: number;
  message: string;
}

export interface BedDTO extends Bed {
  wardId: number | null;
  /** ₹ per day, from the bed's ward. */
  dailyRate: number;
}

export interface WardDTO {
  id: number;
  name: string;
  capacity: number;
  /** ₹ per day a bed costs: the ward's own rate, else the catalogue's bed charge for its class. */
  dailyRate: number;
  /** The rate set on the ward itself (0 = none, the catalogue price is used). */
  ownRate: number;
  rateSource: "ward" | "catalogue" | "none";
  /** The catalogue service the rate comes from, when `rateSource` is "catalogue". */
  rateService: string;
  wardClassId: number | null;
  wardClass: string;
  facilityAreaId: number | null;
  facilityArea: string;
}

export interface BedTransferDTO {
  id: number;
  patientName: string;
  from: string;
  to: string;
  date: string;
  reason: string;
  status: string;
}

export interface StaffDTO extends Staff {
  departmentId: number | null;
  /** EMP-1001 */
  employeeNo: string;
  gender: string;
  dob: string | null;
  address: string;
  qualification: string;
  licenceNo: string;
  /** When the professional licence (nursing / pharmacy / lab) runs out. */
  licenceExpiry: string | null;
  emergencyName: string;
  emergencyPhone: string;
}

export interface PharmacyItemDTO extends PharmacyItem {}

export interface DepartmentDTO {
  id: number;
  name: string;
  head: string;
  ext: string;
  /** Setup → Masters: short code, clinical specialty, whether it sees patients, whether it is in use. */
  code: string;
  specialty: string;
  clinical: boolean;
  active: boolean;
}

export interface MedicineDTO {
  id: number;
  name: string;
  generic: string;
  category: string;
  defaultDosage: string;
  defaultFrequency: string;
  defaultDuration: string;
  unit: string;
}

export interface AdminUserDTO {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string | null;
  departmentId: number | null;
  /** The staff record this login punches attendance as. */
  staffId: number | null;
  /** The doctor record this login belongs to (Doctor role only). */
  doctorId: number | null;
  status: string;
  lastLogin: string;
}

export interface SessionUserDTO {
  id: number;
  name: string;
  email: string;
  role: string;
  hospitalId: number | null;
  radiologyCenterId: number | null;
  labCenterId: number | null;
  doctorId: number | null;
  permissions: Record<string, "none" | "read" | "write">;
}

export const BLOOD_COMPONENTS = ["Whole blood", "PRBC", "Platelets", "Plasma", "Cryoprecipitate"] as const;
export type BloodComponent = (typeof BLOOD_COMPONENTS)[number];
export type BloodUnitStatus = "Quarantined" | "Available" | "Cross-matched" | "Issued" | "Processed" | "Discarded";
export type SerologyFlag = "" | "Negative" | "Reactive";

/** The five tests every unit must clear before it can be used. */
export const SEROLOGY_TESTS = [
  { key: "hiv", label: "HIV" },
  { key: "hbsag", label: "HBsAg" },
  { key: "hcv", label: "HCV" },
  { key: "malaria", label: "Malaria" },
  { key: "syphilis", label: "Syphilis" },
] as const;
export type SerologyKey = (typeof SEROLOGY_TESTS)[number]["key"];
export type SerologyDTO = Record<SerologyKey, SerologyFlag>;

export const DONOR_ID_PROOFS = ["aadhaar", "pan", "voter_id", "driving_licence", "passport"] as const;

export interface BloodDonorDTO {
  id: number;
  /** BD/26/00080 */
  donorNo: string;
  name: string;
  gender: string;
  bloodGroup: BloodGroup;
  phone: string;
  dob: string | null;
  age: number;
  /** Only the type and the last four characters are kept — never the full number. */
  idProofType: string;
  idProofLast4: string;
  totalDonations: number;
  lastDonationDate: string;
  /** Deferred only while a deferral is in force; a temporary one lapses by itself. */
  status: DonorStatus;
  deferralReason: string;
  deferredUntil: string | null;
  /** Earliest day they may donate again, given the last donation. */
  nextEligibleOn: string | null;
}

export interface BloodUnitDTO {
  id: number;
  /** BU/26/00262 */
  unitNo: string;
  source: "Donation" | "Purchased";
  donorId: number | null;
  donorNo: string;
  supplier: string;
  bagNo: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  volumeMl: number;
  collectedOn: string;
  expiryOn: string;
  expired: boolean;
  /** Days until expiry (negative once expired). */
  daysToExpiry: number;
  serology: SerologyDTO;
  /** All five tests have a result. */
  serologyDone: boolean;
  status: BloodUnitStatus;
  rootUnitId: number | null;
  parentUnitId: number | null;
  discardReason: string;
}

export interface BloodStockGroupDTO {
  bloodGroup: BloodGroup;
  /** Usable units: Available and not expired. */
  available: number;
  /** Of those, how many expire within a week. */
  expiringSoon: number;
  byComponent: Record<string, number>;
}

export interface BloodStockSummaryDTO {
  groups: BloodStockGroupDTO[];
  quarantined: number;
  expiredInStock: number;
}

export interface BloodCrossmatchDTO {
  id: number;
  /** XM/26/00012 */
  xmNo: string;
  patientId: number | null;
  patientName: string;
  patientCode: string;
  unitId: number;
  unitNo: string;
  unitGroup: BloodGroup;
  unitComponent: string;
  requestedAt: string;
  requestedBy: string;
  result: "pending" | "compatible" | "incompatible";
  resultBy: string | null;
  resultAt: string | null;
  status: "requested" | "resulted" | "issued" | "cancelled";
}

export interface BloodReactionDTO {
  at: string;
  by: string;
  kind: string;
  severity: "Mild" | "Moderate" | "Severe";
  note: string;
}

export interface BloodTransfusionDTO {
  id: number;
  /** BI/26/00027 */
  issueNo: string;
  crossmatchId: number;
  patientId: number | null;
  patientName: string;
  patientCode: string;
  unitId: number;
  unitNo: string;
  unitGroup: BloodGroup;
  unitComponent: string;
  issuedAt: string;
  issuedBy: string;
  transfusedAt: string | null;
  transfusedBy: string | null;
  disposition: string;
  returnedAt: string | null;
  reactions: BloodReactionDTO[];
}

/** A statutory register as plain rows, so the printed copy is the same every time for the same data. */
export interface BloodRegisterDTO {
  kind: "donor" | "stock" | "issue" | "discard" | "serology";
  title: string;
  /** yyyy-mm-dd the register is for ("as on" for stock). */
  date: string;
  columns: string[];
  rows: string[][];
}


export interface RadiologyTestDTO {
  orderNumber: string;
  id: number;
  hospitalId: number;
  patientId: number | null;
  patientName: string;
  patientAge: number;
  testName: string;
  scanStatus: "Pending" | "Done";
  reportStatus: "Pending" | "Ready";
  date: string;
  amount: number;
  /** The price is the routed-to center's call, not the hospital's — only a discount is captured here. */
  discount: number;
  discountType: "percent" | "amount";
  status: RadiologyStatus;
  /** Set by the ordering doctor; the worklist sorts and tags on it. */
  priority: RadiologyPriority;
  /** The patient's hospital ID (UHID), when the study is linked to a patient record. */
  patientCode: string | null;
  doctorId: number | null;
  doctor: string;
  /** Null when kept in-house; set once routed to a linked radiology center. */
  radiologyCenterId: number | null;
  radiologyCenterName: string | null;
  /** Set only when a radiology-center account is viewing — its own hospital is implicit otherwise. */
  hospitalName: string | null;
  /** True when a report document has been uploaded (fetch it via /radiology/[id]/report). */
  hasReport: boolean;
  reportFileName: string | null;
  reportNote: string | null;
  reportUploadedBy: string | null;
  reportUploadedAt: string | null;
}

/** Fuller demographic/medical-safety detail for the patient behind one radiology study — fetched via /radiology/[id]/patient. */
export interface RadiologyPatientDetailDTO {
  id: number;
  name: string;
  patientCode: string;
  age: number;
  gender: string;
  phone: string;
  email: string | null;
  bloodGroup: string | null;
  dob: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  allergies: string | null;
  chronicConditions: string | null;
}

export interface RadiologyReportFileDTO {
  fileName: string;
  /** Firebase Storage download URL for the report document (PDF or image). */
  fileUrl: string;
  note: string | null;
  uploadedBy: string | null;
  uploadedAt: string | null;
}

export interface AmbulanceDTO {
  id: number;
  vehicleNumber: string;
  model: string;
  driverName: string;
  driverPhone: string;
  status: AmbulanceStatus;
}

export interface AmbulanceCallDTO {
  id: number;
  patientName: string;
  phone: string;
  pickupLocation: string;
  dropLocation: string;
  ambulanceId: number | null;
  vehicleNumber: string;
  driverName: string;
  date: string;
  time: string;
  amount: number;
  status: AmbulanceCallStatus;
}

export interface BirthRecordDTO {
  id: number;
  childName: string;
  gender: Gender;
  date: string;
  time: string;
  weightKg: number;
  motherName: string;
  fatherName: string;
  phone: string;
  address: string;
}

export interface DeathRecordDTO {
  id: number;
  deceasedName: string;
  gender: Gender;
  age: number;
  date: string;
  time: string;
  guardianName: string;
  cause: string;
  phone: string;
  address: string;
}

export interface TpaDTO {
  id: number;
  name: string;
  code: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  status: TpaStatus;
}

export interface TpaClaimDTO {
  id: number;
  tpaId: number | null;
  tpaName: string;
  patientId: number | null;
  patientName: string;
  billNumber: string;
  claimAmount: number;
  approvedAmount: number;
  date: string;
  status: ClaimStatus;
}

export type FollowUpStatus = "Pending" | "Done" | "Missed";

export interface FollowUpDTO {
  id: number;
  patientId: number | null;
  patientName: string;
  patientCode: string;
  doctorId: number | null;
  doctor: string;
  reason: string;
  /** yyyy-mm-dd the patient is due back. */
  dueOn: string;
  status: FollowUpStatus;
  createdBy: string;
  createdByRole: string;
  resolvedBy: string | null;
  resolvedByRole: string | null;
  resolvedOn: string | null;
  reschedules: number;
  note: string;
  createdAt: string;
}

export interface FollowUpSummaryDTO {
  /** Pending and past their date. */
  overdue: number;
  dueToday: number;
  next14: number;
  pending: number;
  done: number;
  missed: number;
}

/** Counts for one bucket (a day, or a week on the 12-month view) of the analytics chart and table. */
export interface FollowUpBucketDTO {
  /** yyyy-mm-dd the bucket starts on. */
  key: string;
  label: string;
  total: number;
  done: number;
  missed: number;
  /** Booked, date reached or passed, not yet marked — "due and not completed". Future ones count in `upcoming`. */
  due: number;
  upcoming: number;
}

export interface FollowUpAnalyticsDTO {
  period: { from: string; to: string; days: number; bucket: "day" | "week" };
  totals: {
    scheduled: number;
    done: number;
    missed: number;
    due: number;
    upcoming: number;
    /** done ÷ (done + missed), as a percentage; null until something has been marked. */
    keptRate: number | null;
    missedRate: number | null;
    /** Booked and still waiting beyond the window's end (the next 14 days). */
    next14: number;
  };
  buckets: FollowUpBucketDTO[];
  /** Who booked them and who marked them, by role group (Doctor, Receptionist, Others). */
  byRole: { role: string; booked: number; markedDone: number; markedMissed: number }[];
  byDoctor: { doctorId: number | null; doctor: string; total: number; done: number; missed: number; due: number; upcoming: number; keptRate: number | null }[];
}

export type EnquiryStatus = "Open" | "Contacted" | "Converted" | "Closed";

/** A lead captured before registration. */
export interface EnquiryDTO {
  id: number;
  name: string;
  mobile: string;
  department: string;
  interestedIn: string;
  source: string;
  estimatedValue: number;
  /** yyyy-mm-dd the lead is to be called back, or null. */
  callBackOn: string | null;
  notes: string;
  status: EnquiryStatus;
  /** Times contacted so far, counting the first enquiry. */
  contacts: number;
  convertedPatientId: number | null;
  history: { at: string; by: string; note: string; nextOn: string | null }[];
  createdAt: string;
}

export interface EnquirySummaryDTO {
  total: number;
  Open: number;
  Contacted: number;
  Converted: number;
  Closed: number;
  /** Open or contacted leads whose call-back date is today or earlier. */
  dueToday: number;
}

export interface FinanceEntryDTO {
  id: number;
  category: string;
  description: string;
  invoiceNumber: string;
  amount: number;
  date: string;
}

export interface InventoryItemDTO {
  id: number;
  name: string;
  category: string;
  unit: string;
  stock: number;
  minStock: number;
  supplier: string;
  status: InventoryStatus;
}

export interface InventoryIssueDTO {
  id: number;
  itemId: number | null;
  itemName: string;
  department: string;
  quantity: number;
  issuedTo: string;
  date: string;
  note: string;
}

export interface TaskDTO {
  id: number;
  title: string;
  description: string;
  goal: string;
  assigneeId: number | null;
  assigneeName: string;
  assignedBy: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatThreadDTO {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageDTO {
  id: number;
  threadId: number;
  role: "user" | "assistant";
  content: string;
  sources: string[] | null;
  /** The patient this reply resolved to, if any — powers a "View patient" link. */
  patientId: number | null;
  createdAt: string;
}

export interface ScribeNoteDTO {
  id: number;
  appointmentId: number | null;
  patientId: number | null;
  patientName: string;
  doctorId: number | null;
  doctorName: string;
  transcript: string;
  brief: string;
  language: string;
  durationSec: number;
  status: ScribeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItemDTO {
  id: number;
  medicineName: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrderDTO {
  id: number;
  poNumber: string;
  supplier: string;
  orderDate: string;
  expectedDate: string;
  itemCount: number;
  total: number;
  status: string;
  notes: string;
  items: PurchaseOrderItemDTO[];
}

export interface PharmacySaleItemDTO {
  id: number;
  medicineName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PharmacySaleDTO {
  id: number;
  saleNumber: string;
  patientId: number | null;
  patientName: string;
  rxNumber: string;
  itemCount: number;
  subtotal: number;
  discount: number;
  total: number;
  paymentMode: string;
  date: string;
  billId: number | null;
  items: PharmacySaleItemDTO[];
}

export interface StaffAttendanceDTO {
  id: number;
  staffId: number;
  staffName: string;
  date: string;
  punchIn: string;
  punchOut: string;
  minutes: number;
  status: string;
  note: string;
  /** "qr" when the staff member scanned in themselves, else "manual". */
  method: string;
  inDistanceM: number | null;
  outDistanceM: number | null;
}

export type AttendanceDayStatus = "Present" | "No punch-out" | "In progress" | "Absent" | "Not in yet" | "On Leave";

export interface AttendanceDayCellDTO {
  status: AttendanceDayStatus;
  punchIn: string;
  punchOut: string;
  minutes: number;
  method: string;
  inDistanceM: number | null;
  outDistanceM: number | null;
}

export interface AttendanceSummaryStaffDTO {
  staffId: number;
  name: string;
  role: string;
  department: string;
  joinDate: string;
  staffStatus: string;
  presentDays: number;
  absentDays: number;
  totalMinutes: number;
  /** Keyed by day of month ("1".."31"); days with nothing to show are absent from the map. */
  days: Record<string, AttendanceDayCellDTO>;
}

export interface AttendanceSummaryDTO {
  month: string;
  today: string;
  daysInMonth: number;
  staff: AttendanceSummaryStaffDTO[];
}

export interface AttendancePunchEventDTO {
  id: string;
  staffId: number;
  staffName: string;
  date: string;
  type: "in" | "out";
  time: string;
  method: string;
  distanceM: number | null;
}

export interface AttendanceHistoryDTO {
  from: string;
  to: string;
  events: AttendancePunchEventDTO[];
}

export interface AttendanceTodayDTO {
  date: string;
  totalStaff: number;
  present: number;
  checkedOut: number;
  onLeave: number;
  notIn: number;
  viaQr: number;
  recent: { staffId: number; staffName: string; punchIn: string; punchOut: string; method: string }[];
}

export interface IpdNoteDTO {
  id: number;
  admissionId: number;
  noteType: string;
  date: string;
  time: string;
  author: string;
  content: string;
}

export interface IpdMedicationDTO {
  id: number;
  admissionId: number;
  medicineName: string;
  dosage: string;
  frequency: string;
  route: string;
  startDate: string;
  endDate: string;
  status: string;
  lastGivenAt: string;
  notes: string;
}

export interface DocumentDTO {
  id: number;
  ownerType: string;
  ownerId: number;
  category: string;
  /** The name shown in lists (defaults to the file name). */
  title: string;
  /** The MRD folder it is filed in, if any. */
  folderId: number | null;
  folderName: string;
  /** A paper's own reference or certificate number. */
  referenceNo: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
  /** Ready-to-use download URL. */
  url: string;
}

export interface RadiologyCenterDTO {
  id: number;
  code: string;
  status: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  contactEmail: string;
}

export interface LabCenterDTO {
  id: number;
  code: string;
  status: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  contactEmail: string;
}

export interface RadiologyLinkDTO {
  id: number;
  status: string;
  hospitalId: number;
  hospitalName: string;
  radiologyCenterId: number;
  radiologyCenterName: string;
  requestedBy: string;
  requestedAt: string;
  respondedBy: string | null;
  respondedAt: string | null;
  revokedBy: string | null;
  revokedAt: string | null;
}

export interface LabLinkDTO {
  id: number;
  status: string;
  hospitalId: number;
  hospitalName: string;
  labCenterId: number;
  labCenterName: string;
  requestedBy: string;
  requestedAt: string;
  respondedBy: string | null;
  respondedAt: string | null;
  revokedBy: string | null;
  revokedAt: string | null;
}

export interface DashboardStatsDTO {
  patients: number;
  appointmentsToday: number;
  opdWaiting: number;
  ipdAdmitted: number;
  bedsAvailable: number;
  pendingBills: number;
  lowStock: number;
  pendingLabs: number;
  revenue: number;
}

// ── WhatsApp (Meta Cloud API) ────────────────────────────────────────────────

/** What a signed-in staff member needs to know: can this hospital send WhatsApp messages? */
export interface WhatsappLiteDTO { connected: boolean; displayPhone: string; templateReady: boolean }

/** The hospital's connection, for the admin screen. The access token is never included. */
export interface WhatsappStatusDTO {
  connected: boolean;
  wabaId: string;
  phoneNumberId: string;
  displayPhone: string;
  verifiedName: string;
  apiVersion: string;
  via: "embedded" | "manual" | "";
  subscribed: boolean;
  botEnabled: boolean;
  consentTemplate: { name: string; language: string; format: "named" | "positional" };
  defaultCountry: string;
  updatedAt: string | null;
  webhook: { path: string; verifyTokenConfigured: boolean; signatureCheck: boolean };
  /** What the "Connect with Facebook" button needs (all public values). */
  embedded: { available: boolean; appId: string; configId: string; apiVersion: string };
}

export interface WhatsappMessageDTO {
  id: number; direction: "in" | "out"; phone: string; kind: string; body: string;
  status: "received" | "sent" | "delivered" | "read" | "failed"; error: string | null; at: string;
}

/** The outcome of sending one message. */
export interface WhatsappSendResult { state: "sent" | "failed" | "not_connected"; /** Masked, e.g. +91 ••••• 43210 */ to?: string; detail?: string }

// ── Home overview (the admin command dashboard) ─────────────────────────────

export interface OverviewDTO {
  today: string;
  hospital: string;
  plan: { name: string; active: boolean };
  /** The one-line summary under the greeting. */
  summary: { patientsToday: number; collectedToday: number; opdWaiting: number; urgentLabs: number };
  attention: {
    opdWaiting: number;
    urgentLabs: { urgent: number; pending: number };
    unpaid: { amount: number; bills: number };
    claims: { count: number };
  };
  kpis: {
    patientsWeek: { value: number; previous: number };
    collectedWeek: { value: number; previous: number };
    appointments: { total: number; left: number };
    beds: { occupied: number; total: number };
  };
  trend: { date: string; patients: number; collected: number }[];
  byMode: { mode: string; amount: number; count: number }[];
  appointmentsToday: { id: number; time: string; patient: string; doctor: string; type: string; status: string }[];
  bedsByClass: { name: string; occupied: number; total: number }[];
  admittedToday: number;
  dischargedToday: number;
  doctorLoad: { doctor: string; total: number; seen: number }[];
  retention: {
    noShowRate: number | null;
    followUpsKept: number | null;
    cameBack90: number | null;
    returningShare: number | null;
    missed: number;
    followUpsDue: number;
    atRisk: number;
    lapsed: number;
  };
  alerts: { tone: "red" | "amber" | "grey"; title: string; detail: string; action: string; href: string }[];
  opdQueue: { id: number; token: string; patient: string; doctor: string; priority: string; wait: string }[];
  theatre: { id: number; time: string; procedure: string; patient: string; room: string; surgeon: string; status: string }[];
}

// ── MRD (medical records department) ─────────────────────────────────────────

export const MRD_LOCATION_KINDS = ["MRD rack", "Archive room", "Operation theatre", "Nurse station", "Doctor cabin", "Other"] as const;
export type MrdLocationKind = (typeof MRD_LOCATION_KINDS)[number];

export interface MrdLocationDTO {
  id: number;
  name: string;
  kind: MrdLocationKind;
  code: string;
  active: boolean;
  /** Files that are there right now. */
  fileCount: number;
}

export const MRD_FILE_STATUSES = ["Available", "Checked out", "In transit", "Archived"] as const;
export type MrdFileStatus = (typeof MRD_FILE_STATUSES)[number];

export interface MrdFileDTO {
  id: number;
  fileNo: string;
  patientId: number;
  patientName: string;
  patientCode: string;
  fileType: "OPD" | "IPD";
  status: MrdFileStatus;
  locationId: number | null;
  locationName: string;
  homeLocationId: number | null;
  holderName: string | null;
  dueOn: string | null;
  /** Checked out or in transit past its due date. */
  overdue: boolean;
  updatedAt: string;
}

export const MRD_MOVEMENT_ACTIONS = ["Created", "Checked out", "Dispatched", "Returned", "Moved", "Archived", "Retrieved"] as const;
export interface MrdFileMovementDTO {
  id: number;
  fileId: number;
  fileNo: string;
  action: (typeof MRD_MOVEMENT_ACTIONS)[number];
  fromLocation: string;
  toLocation: string;
  holderName: string | null;
  dueOn: string | null;
  note: string;
  byName: string;
  at: string;
}

export type MrdUrgency = "Routine" | "Urgent";
export type MrdRequestStatus = "Pending" | "Dispatched" | "Returned" | "Cancelled";
export interface MrdFileRequestDTO {
  id: number;
  fileId: number;
  fileNo: string;
  patientId: number;
  patientName: string;
  urgency: MrdUrgency;
  status: MrdRequestStatus;
  requestedOn: string;
  requestedBy: string;
  requestedFor: string;
  destinationId: number | null;
  destinationName: string;
  note: string;
  dispatchedAt: string | null;
  returnedAt: string | null;
}

export interface MrdFileSummaryDTO {
  available: number;
  checkedOut: number;
  inTransit: number;
  overdue: number;
  pendingRequests: number;
  archived: number;
}

export const MRD_DOC_CLASSES = ["Clinical", "Financial", "KYC", "Statutory"] as const;
export type MrdDocClass = (typeof MRD_DOC_CLASSES)[number];

export interface MrdRetentionPolicyDTO {
  id: number;
  name: string;
  class: MrdDocClass;
  retentionYears: number;
  categories: string[];
  actionAfter: "Review" | "Destroy";
  active: boolean;
}

export interface MrdFolderDTO {
  id: number;
  name: string;
  class: MrdDocClass | "General";
  description: string;
  documentCount: number;
}

export interface MrdRetentionItemDTO {
  id: number;
  fileName: string;
  category: string;
  class: MrdDocClass;
  ownerType: string;
  ownerId: number;
  patientName: string;
  folderName: string;
  policyName: string;
  uploadedOn: string;
  dueOn: string;
  actionAfter: "Review" | "Destroy";
}

export interface MrdRetentionQueueDTO {
  clinicalDue: number;
  financialDue: number;
  kycDue: number;
  statutoryDue: number;
  items: MrdRetentionItemDTO[];
}

export interface MrdFolderDocumentDTO {
  id: number;
  fileName: string;
  category: string;
  ownerType: string;
  ownerId: number;
  patientName: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedOn: string;
  retentionState: "Active" | "Due" | "Extended";
}

// ── Consents and signatures ──────────────────────────────────────────────────

export type ConsentStatus = "Draft" | "Waiting" | "Signed" | "Refused" | "Cancelled" | "Expired";
export const CONSENT_DELIVERIES = ["qr", "email", "whatsapp", "device"] as const;
export type ConsentDelivery = (typeof CONSENT_DELIVERIES)[number];

/** What staff read off a consent: "Not signed yet", "Sent to phone", "Opened on phone", "Signed on phone / paper"… */
export type ConsentStage = "Not signed yet" | "Sent to phone" | "Opened on phone" | "Signed on phone" | "Signed on paper" | "Declined" | "Link cancelled" | "Link expired";

export interface ConsentDTO {
  id: number;
  patientId: number | null;
  patientName: string;
  patientCode: string;
  templateKey: string;
  formTitle: string;
  /** The text in the language it was made in. */
  formBody: string;
  language: string;
  /** Print / show the English text after the patient's language. */
  includeEnglish: boolean;
  status: ConsentStatus;
  stage: ConsentStage;
  madeBy: string;
  madeAt: string;
  /** Who is expected to sign (set when a link is made), then who did. */
  signerName: string | null;
  signerRelation: string | null;
  delivery: ConsentDelivery | null;
  linkSentAt: string | null;
  expiresAt: string | null;
  openedAt: string | null;
  signedAt: string | null;
  signedVia: "phone" | "paper" | null;
  witnessName: string | null;
  refusedReason: string | null;
  /** The scanned copy filed when it was signed on paper. */
  signedDocumentId: number | null;
  /** Path of the page the patient opens (/sign/<token>); only while the link is live. */
  link: string | null;
  /** Only on the reply to "make a link" with WhatsApp delivery: whether the hospital's WhatsApp sent it. */
  whatsapp?: WhatsappSendResult;
}

/** A form a consent can be made from: one of the built-in ones, or one the hospital wrote. */
export interface ConsentTemplateDTO {
  /** Built-in key, or `custom-…`. */
  key: string;
  /** Database id of a custom template; null for a built-in one. */
  id: number | null;
  builtIn: boolean;
  titles: Record<string, string>;
  bodies: Record<string, string>;
  /** The languages this form has text in. */
  languages: string[];
  active: boolean;
}

export interface ConsentCountsDTO {
  draft: number;
  waiting: number;
  signed: number;
  refused: number;
  expiredOrCancelled: number;
  all: number;
}

export interface ConsentTextDTO { title: string; body: string }

/** What the patient's phone sees when it opens the link. */
export interface PublicConsentDTO {
  hospitalName: string;
  patientName: string;
  /** The language the form was made in (the page opens in it). */
  language: string;
  includeEnglish: boolean;
  /** The form in each language it exists in, so the patient can switch. */
  texts: Record<string, ConsentTextDTO>;
  status: ConsentStatus;
  expiresAt: string | null;
  signedAt: string | null;
  signerName: string | null;
}

/** Everything a printed form or signed copy shows. */
export interface ConsentDocumentDTO {
  hospital: { name: string; address: string; phone: string; email: string; gstNumber: string };
  patient: { name: string; code: string; age: number | null; gender: string };
  language: string;
  includeEnglish: boolean;
  texts: Record<string, ConsentTextDTO>;
  status: ConsentStatus;
  madeAt: string;
  signerName: string | null;
  signerRelation: string | null;
  signedAt: string | null;
  signedVia: "phone" | "paper" | null;
  /** The language the signer had the page in when they signed (the copy opens in it by default). */
  signedLanguage: string | null;
  witnessName: string | null;
  /** The drawn signature (PNG data URL), when it was signed on a phone. */
  signatureData: string | null;
}

export const CODING_STATUSES = ["Pending", "In review", "Deficient", "Coded", "Signed off"] as const;
export type CodingStatus = (typeof CODING_STATUSES)[number];

export interface CodeEntryDTO {
  code: string;
  text: string;
}

export interface MrdDeficiencyDTO {
  id: number;
  caseId: number;
  kind: string;
  note: string;
  status: "Open" | "Resolved";
  raisedBy: string;
  raisedAt: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

export const DEFICIENCY_KINDS = [
  "Discharge summary missing",
  "Consent form missing",
  "Diagnosis not specified",
  "Procedure note missing",
  "Doctor signature missing",
  "Investigation report missing",
  "Other",
] as const;

export interface MrdCodingCaseDTO {
  id: number;
  admissionId: number;
  admissionNo: string;
  patientId: number | null;
  patientName: string;
  patientCode: string;
  doctor: string;
  admittedOn: string;
  status: CodingStatus;
  principalDxCode: string;
  principalDxText: string;
  secondaryDx: CodeEntryDTO[];
  procedures: CodeEntryDTO[];
  coderName: string | null;
  codedAt: string | null;
  signedOffBy: string | null;
  signedOffAt: string | null;
  queuedAt: string;
  openDeficiencies: number;
}

export interface MrdCodingSummaryDTO {
  awaitingCoding: number;
  pending: number;
  deficient: number;
  coded: number;
  signedOff: number;
  openDeficiencies: number;
  pendingFileRequests: number;
}

export const MRD_REGISTERS = [
  { kind: "birth", title: "Birth register" },
  { kind: "death", title: "Death register" },
] as const;
export type MrdRegisterKind = (typeof MRD_REGISTERS)[number]["kind"];

export interface MrdRegisterEntryDTO {
  id: number;
  register: MrdRegisterKind;
  entryNo: string;
  entryDate: string;
  data: Record<string, string>;
  reportTo: string;
  filedBy: string;
  filedAt: string;
  amendsId: number | null;
  supersededBy: number | null;
}

export interface MrdRegisterFieldDTO {
  key: string;
  label: string;
  required: boolean;
  kind: "text" | "select" | "number" | "time";
  options?: string[];
  /** Suggestions for a free-text field (shown as a datalist). */
  suggestions?: string[];
}

export interface MrdRegisterDTO {
  kind: MrdRegisterKind;
  title: string;
  /** The register's own fields, in form and print order. */
  fields: MrdRegisterFieldDTO[];
  entries: MrdRegisterEntryDTO[];
}

// ── CSSD (central sterile services) ──────────────────────────────────────────

export type CssdSetStatus = "Dirty" | "Packed" | "In cycle" | "Sterile" | "Issued" | "Expired sterility";

export interface CssdInstrumentDTO { name: string; qty: number }

export interface CssdSetDTO {
  id: number;
  setNo: string;
  name: string;
  type: string;
  departmentId: number | null;
  departmentName: string;
  instruments: CssdInstrumentDTO[];
  /** ₹ posted to the patient's bill when the set is issued. */
  usageCharge: number;
  status: CssdSetStatus;
  packaging: string | null;
  /** The date it stops being sterile. */
  sterileUntil: string | null;
  /** Whole days left (negative once expired); null unless it is sterile. */
  daysLeft: number | null;
  timesProcessed: number;
}

export interface CssdSterilizerDTO { id: number; name: string; method: string; location: string; active: boolean; running: boolean }

export type CssdCycleStatus = "Running" | "Passed" | "Failed" | "Quarantined";
export interface CssdCycleDTO {
  id: number;
  cycleNo: string;
  sterilizerId: number;
  sterilizerName: string;
  method: string;
  startedAt: string;
  load: number;
  setNos: string[];
  tempC: number;
  pressurePsi: number;
  exposureMin: number;
  indicator: "pending" | "pass" | "fail";
  status: CssdCycleStatus;
  startedBy: string;
  resultBy: string | null;
  resultAt: string | null;
  note: string;
}

export type CssdIssueStatus = "Requested" | "Issued" | "Returned" | "Cancelled";
export interface CssdIssueDTO {
  id: number;
  /** Minted when the set is issued; null while it is only requested. */
  issueNo: string | null;
  setId: number;
  setNo: string;
  setName: string;
  patientId: number | null;
  patientName: string;
  departmentName: string;
  caseLabel: string;
  status: CssdIssueStatus;
  requestedAt: string;
  requestedBy: string;
  issuedAt: string | null;
  expectedBack: string | null;
  /** Issued and past its expected return. */
  overdue: boolean;
  returnedAt: string | null;
  /** Returned with something to look into (missing or damaged instruments, a recalled cycle). */
  investigate: boolean;
  returnNote: string;
  charge: number;
  billNumber: string | null;
}

export interface CssdSummaryDTO {
  sterile: number;
  inCycle: number;
  packed: number;
  dirty: number;
  issuedOut: number;
  requests: number;
  expiring7d: number;
  expired: number;
  /** Set numbers issued out past their expected return. */
  overdueSets: string[];
}

/** Effective shelf life in days for each method × packaging, and which cells the hospital has changed. */
export interface CssdShelfLifeDTO {
  days: Record<string, Record<string, number>>;
  overridden: Record<string, Record<string, boolean>>;
}

export interface CssdCaseDTO { id: number; patientId: number | null; patientName: string; procedure: string; scheduledDate: string; room: string }

// ── HR: leave, roster, payroll ───────────────────────────────────────────────

export interface HrLeaveTypeDTO { id: number; name: string; code: string; daysPerYear: number; paid: boolean; active: boolean }

export type HrLeaveStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";
export interface HrLeaveRequestDTO {
  id: number;
  staffId: number;
  staffName: string;
  department: string;
  leaveTypeId: number;
  typeName: string;
  typeCode: string;
  paid: boolean;
  fromDate: string;
  toDate: string;
  /** Calendar days, first and last included. */
  days: number;
  reason: string;
  status: HrLeaveStatus;
  appliedBy: string;
  appliedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string;
}

export interface HrLeaveBalanceDTO { typeId: number; code: string; name: string; paid: boolean; allocated: number; used: number; pending: number; remaining: number | null }
export interface HrStaffBalanceDTO { staffId: number; name: string; role: string; department: string; balances: HrLeaveBalanceDTO[] }

export interface HrLeaveCalendarDTO {
  month: string;
  daysInMonth: number;
  staff: { staffId: number; name: string; role: string; department: string; days: Record<string, { status: "Approved" | "Pending"; code: string; paid: boolean }> }[];
}

export interface HrShiftDTO { id: number; name: string; code: string; start: string; end: string; active: boolean }

export interface HrRosterDTO {
  from: string;
  to: string;
  entries: { staffId: number; date: string; shiftId: number }[];
  /** Days a person is on approved leave, so the roster can show it and refuse a shift there. */
  leaveDays: { staffId: number; date: string; code: string }[];
}

export interface HrDutyListDTO {
  date: string;
  shifts: { shift: HrShiftDTO; departments: { department: string; staff: { id: number; name: string; role: string }[] }[]; count: number }[];
  onLeave: { id: number; name: string; role: string; department: string; code: string }[];
  /** Active staff with no shift on this date. */
  unrostered: number;
}

export interface HrSalaryDTO {
  staffId: number;
  name: string;
  role: string;
  department: string;
  employeeNo: string;
  /** False until a salary has been set. */
  set: boolean;
  basic: number;
  hra: number;
  allowances: number;
  pfPercent: number;
  profTax: number;
  otherDeduction: number;
  gross: number;
}

export interface HrPayslipDTO {
  id: number;
  runId: number;
  staffId: number;
  staffName: string;
  employeeNo: string;
  role: string;
  department: string;
  month: string;
  monthDays: number;
  paidDays: number;
  unpaidLeaveDays: number;
  /** Extra days HR chose to dock (absences not covered by leave). */
  lopAdjust: number;
  /** Days with no attendance punch and no leave, for HR's information. */
  absentDays: number;
  basic: number;
  hra: number;
  allowances: number;
  gross: number;
  pf: number;
  profTax: number;
  otherDeduction: number;
  netPay: number;
}

export interface HrPayrollRunDTO {
  id: number;
  month: string;
  status: "Draft" | "Finalized";
  staffCount: number;
  totalGross: number;
  totalNet: number;
  createdBy: string;
  createdAt: string;
  finalizedBy: string | null;
  finalizedAt: string | null;
}

export interface HrPayrollRunDetailDTO extends HrPayrollRunDTO {
  payslips: HrPayslipDTO[];
  /** Staff left out because they have no salary set (or had not joined by the month's end). */
  skipped: { staffId: number; name: string; reason: string }[];
}

export interface HrOverviewDTO {
  today: string;
  staff: { total: number; active: number; onLeave: number };
  pendingLeave: number;
  leaveToday: { staffId: number; name: string; role: string; code: string }[];
  licences: { staffId: number; name: string; role: string; licenceNo: string; expiry: string; daysLeft: number }[];
  roster: { shift: string; code: string; count: number }[];
  unrosteredToday: number;
  payroll: { month: string; status: "Draft" | "Finalized" | null; totalNet: number } | null;
}

// ── Pharmacy dispensing ──────────────────────────────────────────────────────

export type DispenseBilling = "none" | "separate" | "patient";
export type ReturnCondition = "Usable" | "Damaged" | "Expired";

/** A medicine the counter can pick: what is on the shelf and fit to dispense. */
export interface DispenseStockDTO {
  itemId: number;
  name: string;
  category: string;
  /** Units in date and on the shelf — what can actually go out. */
  available: number;
  unitPrice: number;
  /** The earliest expiry among the units in date, YYYY-MM-DD, or "" when none is recorded. */
  nextExpiry: string;
}

export interface DispenseLineDTO {
  id: number;
  itemId: number;
  medicineName: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  returnedQty: number;
  returnable: number;
  unitPrice: number;
  lineTotal: number;
}

export interface DispenseReturnDTO {
  id: number;
  lineId: number;
  medicineName: string;
  batchNo: string;
  quantity: number;
  condition: ReturnCondition;
  creditNoteNo: string;
  creditValue: number;
  reason: string;
  returnedBy: string;
  at: string;
}

export interface DispenseDTO {
  id: number;
  dispenseNo: string;
  patientId: number | null;
  patientName: string;
  walkInNote: string;
  rxNumber: string;
  billing: DispenseBilling;
  /** "Not billed", "On stay ADM/2026/00001", "Billed INV-00000012" or "Added to bill INV-00000012". */
  billLabel: string;
  billNumber: string | null;
  admissionNo: string | null;
  subtotal: number;
  status: "Dispensed" | "Part returned" | "Returned";
  dispensedBy: string;
  /** ISO instant. */
  at: string;
  /** The first medicine, and how many more went with it ("Fepanil 500 +2 more"). */
  summary: string;
  lines: DispenseLineDTO[];
  returns: DispenseReturnDTO[];
  /** Set when the dispense went through but the bill could not be raised. */
  billingWarning?: string;
}

export interface DispenseRxLineDTO {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  /** From frequency × duration. */
  quantity: number;
  /** The stock item it matched, or null when the pharmacy doesn't stock it. */
  itemId: number | null;
  itemName: string;
  available: number;
  unitPrice: number;
}

export interface DispenseRxDTO {
  prescriptionId: number;
  rxNumber: string;
  doctor: string;
  diagnosis: string;
  date: string;
  lines: DispenseRxLineDTO[];
}

/** What a payout rule earned someone on one invoice. */
export interface PayoutDTO {
  id: number; billId: number; billNumber: string; date: string; rule: string; role: string;
  payeeType: "doctor" | "referral" | "centre"; payee: string;
  basis: number; valueKind: string; value: number; amount: number; status: "Pending" | "Paid" | "Void"; paidOn: string | null;
}
export interface PayoutsDTO {
  rows: PayoutDTO[];
  payees: { payee: string; payeeType: string; pending: number; paid: number; count: number }[];
  totals: { pending: number; paid: number };
}
