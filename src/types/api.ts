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
  BloodIssueStatus,
  BloodComponent,
  RadiologyStatus,
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
}

export interface PrescriptionDTO extends Prescription {
  patientId: number | null;
  doctorId: number | null;
  items: PrescriptionItemDTO[];
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
  priority: string;
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

export interface BillDTO extends Bill {
  patientId: number | null;
}

export interface IpdRecordDTO extends IpdRecord {
  // Note: IpdRecord.patientId is the patient *code* (e.g. HMS-0007).
  patientRefId: number | null;
  doctorId: number | null;
  bedId: number | null;
  wardId: number | null;
}

export interface OtRecordDTO extends OtRecord {
  patientId: number | null;
  surgeonId: number | null;
}

export interface BedDTO extends Bed {
  wardId: number | null;
}

export interface WardDTO {
  id: number;
  name: string;
  capacity: number;
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
}

export interface PharmacyItemDTO extends PharmacyItem {}

export interface DepartmentDTO {
  id: number;
  name: string;
  head: string;
  ext: string;
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

export interface BloodDonorDTO {
  id: number;
  name: string;
  age: number;
  gender: Gender;
  bloodGroup: BloodGroup;
  phone: string;
  aadhaarNumber: string;
  lastDonationDate: string;
  totalDonations: number;
  status: DonorStatus;
}

export interface BloodStockDTO {
  id: number;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  units: number;
}

export interface BloodIssueDTO {
  id: number;
  patientId: number | null;
  patientName: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  units: number;
  doctor: string;
  date: string;
  amount: number;
  status: BloodIssueStatus;
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
