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
  permissions: Record<string, "none" | "read" | "write">;
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
