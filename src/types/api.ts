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
} from "@/types";

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

export interface DoctorDTO extends Doctor {
  departmentId: number | null;
}

export interface AppointmentDTO extends Appointment {
  patientId: number | null;
  doctorId: number | null;
}

export interface OpdRecordDTO extends OpdRecord {
  patientId: number | null;
  doctorId: number | null;
}

export interface LabTestDTO extends LabTest {
  orderNumber: string;
  requestedBy: string;
  priority: string;
  collectionDate: string;
  discount: number;
  patientId: number | null;
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
  status: string;
  lastLogin: string;
}

export interface SessionUserDTO {
  id: number;
  name: string;
  email: string;
  role: string;
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
  patientId: number | null;
  patientName: string;
  patientAge: number;
  testName: string;
  scanStatus: "Pending" | "Done";
  reportStatus: "Pending" | "Ready";
  date: string;
  amount: number;
  status: RadiologyStatus;
  /** True when a report document has been uploaded (fetch it via /radiology/[id]/report). */
  hasReport: boolean;
  reportFileName: string | null;
  reportNote: string | null;
  reportUploadedBy: string | null;
  reportUploadedAt: string | null;
}

export interface RadiologyReportFileDTO {
  fileName: string;
  /** data: URL containing the report document (PDF or image). */
  dataUrl: string;
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
