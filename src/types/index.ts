export type Gender = "Male" | "Female";
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

export type AppointmentStatus = "Completed" | "Today" | "Upcoming" | "Cancelled";
export type OpdStatus = "Waiting" | "In Consultation" | "Completed";
export type OpdPriority = "Normal" | "Urgent" | "Emergency";
export type DoctorStatus = "Active" | "On Leave" | "In OPD";
export type PrescriptionStatus = "Dispensed" | "Pending" | "Draft";
export type PharmacyStatus = "In Stock" | "Low Stock" | "Out of Stock" | "Expired";
export type LabStatus = "Pending" | "Sample Collected" | "Report Ready" | "Cancelled";
export type BillingStatus = "Paid" | "Pending" | "Partial" | "Refunded";
export type IpdStatus = "Admitted" | "ICU" | "Discharged";
export type OtStatus = "Scheduled" | "In Progress" | "Completed" | "Cancelled";
export type BedStatus = "Available" | "Occupied" | "Reserved" | "Maintenance";
export type StaffStatus = "Active" | "On Leave" | "Inactive";
export type DonorStatus = "Eligible" | "Deferred";
/** Set by the ordering doctor on a lab or imaging order; STAT is read first, then Urgent, then Routine. */
export type TestPriority = "Routine" | "Urgent" | "STAT";
export type RadiologyPriority = TestPriority;
export type LabPriority = TestPriority;
export type RadiologyStatus = "Pending" | "Scan Done" | "Report Ready" | "Cancelled";
export type AmbulanceStatus = "Available" | "On Call" | "Maintenance";
export type AmbulanceCallStatus = "Dispatched" | "Completed" | "Cancelled";
export type TpaStatus = "Active" | "Inactive";
export type ClaimStatus = "Submitted" | "In Review" | "Approved" | "Rejected" | "Settled";
export type InventoryStatus = "In Stock" | "Low Stock" | "Out of Stock";
export type TaskStatus = "To Do" | "In Progress" | "Blocked" | "Done";
export type TaskPriority = "Low" | "Medium" | "High" | "Urgent";
export type ScribeStatus = "Draft" | "Saved" | "Signed";

export interface Patient {
  id: number;
  name: string;
  age: number;
  phone: string;
  gender: Gender;
  reason: string;
  doctor: string;
  status: AppointmentStatus;
  date: string;
  time: string;
  patientId?: string;
  bloodGroup?: BloodGroup;
}

export interface Appointment {
  id: number;
  patientName: string;
  patientAge: number;
  doctor: string;
  date: string;
  time: string;
  type: "Walk-in" | "Booked" | "Tele-consult";
  reason: string;
  status: AppointmentStatus;
}

export interface Vitals {
  bpSystolic: number | null;
  bpDiastolic: number | null;
  pulse: number | null;
  temperature: number | null;
  spo2: number | null;
}

export interface OpdRecord {
  id: number;
  tokenNumber: string;
  patientName: string;
  patientAge: number;
  doctor: string;
  reason: string;
  priority: OpdPriority;
  vitalsRecorded: boolean;
  vitals: Vitals;
  waitTime: string;
  checkInTime: string;
  status: OpdStatus;
}

export interface Doctor {
  id: number;
  name: string;
  specialty: string;
  department: string;
  phone: string;
  experience: string;
  patientsToday: number;
  status: DoctorStatus;
}

export interface Medicine {
  name: string;
  dosage: string;
  timing: string;
  duration: string;
}

export interface Prescription {
  id: number;
  rxNumber: string;
  patientName: string;
  patientAge: number;
  doctor: string;
  diagnosis: string;
  medicineCount: number;
  date: string;
  status: PrescriptionStatus;
}

export interface PharmacyItem {
  id: number;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  expiryDate: string;
  supplier: string;
  status: PharmacyStatus;
}

export interface LabTest {
  id: number;
  patientName: string;
  patientAge: number;
  testName: string;
  sampleStatus: "Pending" | "Collected";
  reportStatus: "Pending" | "Ready";
  date: string;
  amount: number;
  status: LabStatus;
}

export interface Bill {
  id: number;
  billNumber: string;
  patientName: string;
  type: "OPD" | "Pharmacy" | "Lab" | "IPD" | "Blood" | "Ambulance" | "Radiology";
  date: string;
  amount: number;
  discount: number;
  gst: number;
  total: number;
  status: BillingStatus;
}

export interface IpdRecord {
  id: number;
  patientName: string;
  patientAge: number;
  patientId: string;
  admissionDate: string;
  ward: string;
  bed: string;
  doctor: string;
  diagnosis: string;
  creditLimit: number;
  status: IpdStatus;
}

export interface OtRecord {
  id: number;
  patientName: string;
  procedure: string;
  otRoom: string;
  surgeon: string;
  anesthetist: string;
  scheduledTime: string;
  scheduledDate: string;
  status: OtStatus;
}

export interface Bed {
  id: number;
  bedNumber: string;
  ward: string;
  patientName?: string;
  patientId?: string;
  status: BedStatus;
}

export interface Staff {
  id: number;
  name: string;
  role: string;
  department: string;
  phone: string;
  email: string;
  joinDate: string;
  status: StaffStatus;
}

export interface KpiStat {
  label: string;
  value: string;
  /** Period-over-period trend, when a historical baseline is available. */
  change?: string;
  positive?: boolean;
}

export interface ReportRow {
  id: number;
  doctor: string;
  specialty: string;
  patientsCount: number;
  revenue: number;
  satisfaction: string;
  avgConsultTime: string;
}
