/**
 * Row → DTO mappers. Translate persisted snake_case rows into the camelCase
 * DTOs the API returns and the frontend consumes.
 */
import type {
  PatientDTO,
  AppointmentDTO,
  OpdRecordDTO,
  DoctorDTO,
  PrescriptionDTO,
  PrescriptionItemDTO,
  PharmacyItemDTO,
  LabTestDTO,
  BillDTO,
  IpdRecordDTO,
  OtRecordDTO,
  BedDTO,
  StaffDTO,
  DepartmentDTO,
  MedicineDTO,
  AdminUserDTO,
  BloodDonorDTO,
  BloodStockDTO,
  BloodIssueDTO,
  RadiologyTestDTO,
  AmbulanceDTO,
  AmbulanceCallDTO,
  BirthRecordDTO,
  DeathRecordDTO,
  TpaDTO,
  TpaClaimDTO,
  FinanceEntryDTO,
  InventoryItemDTO,
  InventoryIssueDTO,
} from "@/types/api";
import type {
  PatientRow,
  AppointmentRow,
  OpdVisitRow,
  DoctorRow,
  PrescriptionRow,
  PrescriptionItemRow,
  PharmacyItemRow,
  LabTestRow,
  BillRow,
  IpdAdmissionRow,
  OtScheduleRow,
  BedRow,
  StaffRow,
  DepartmentRow,
  MedicineRow,
  UserRow,
  BloodDonorRow,
  BloodStockRow,
  BloodIssueRow,
  RadiologyTestRow,
  AmbulanceRow,
  AmbulanceCallRow,
  BirthRecordRow,
  DeathRecordRow,
  TpaRow,
  TpaClaimRow,
  FinanceIncomeRow,
  FinanceExpenseRow,
  InventoryItemRow,
  InventoryIssueRow,
} from "@/server/db/tables";
import type {
  Gender,
  BloodGroup,
  AppointmentStatus,
  OpdStatus,
  DoctorStatus,
  PrescriptionStatus,
  PharmacyStatus,
  LabStatus,
  BillingStatus,
  IpdStatus,
  OtStatus,
  BedStatus,
  StaffStatus,
  DonorStatus,
  BloodIssueStatus,
  BloodComponent,
  RadiologyStatus,
  AmbulanceStatus,
  AmbulanceCallStatus,
  TpaStatus,
  ClaimStatus,
  InventoryStatus,
} from "@/types";

function splitList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function toPatientDTO(r: PatientRow): PatientDTO {
  return {
    id: r.id,
    name: r.name,
    age: r.age,
    phone: r.phone,
    gender: r.gender as Gender,
    reason: r.reason,
    doctor: r.doctor,
    status: r.status as AppointmentStatus,
    date: r.visit_date,
    time: r.visit_time,
    patientId: r.patient_code,
    bloodGroup: (r.blood_group ?? undefined) as BloodGroup | undefined,
    email: r.email,
    dob: r.dob,
    address: r.address,
    city: r.city,
    state: r.state,
    pincode: r.pincode,
    allergies: splitList(r.allergies),
    chronicConditions: splitList(r.chronic_conditions),
    abhaId: r.abha_id,
    emergencyName: r.emergency_name,
    emergencyRelation: r.emergency_relation,
    emergencyPhone: r.emergency_phone,
    insurer: r.insurer,
    policyNumber: r.policy_number,
    corporate: r.corporate,
    doctorId: r.doctor_id,
  };
}

export function toAppointmentDTO(r: AppointmentRow): AppointmentDTO {
  return {
    id: r.id,
    patientName: r.patient_name,
    patientAge: r.patient_age,
    doctor: r.doctor,
    date: r.appointment_date,
    time: r.appointment_time,
    type: r.type as "Walk-in" | "Booked",
    reason: r.reason,
    status: r.status as AppointmentStatus,
    patientId: r.patient_id,
    doctorId: r.doctor_id,
  };
}

export function toOpdDTO(r: OpdVisitRow): OpdRecordDTO {
  return {
    id: r.id,
    tokenNumber: r.token_number,
    patientName: r.patient_name,
    patientAge: r.patient_age,
    doctor: r.doctor,
    vitalsRecorded: r.vitals_recorded,
    waitTime: r.wait_time,
    checkInTime: r.check_in_time,
    status: r.status as OpdStatus,
    patientId: r.patient_id,
    doctorId: r.doctor_id,
  };
}

export function toDoctorDTO(r: DoctorRow): DoctorDTO {
  return {
    id: r.id,
    name: r.name,
    specialty: r.specialty,
    department: r.department,
    phone: r.phone,
    experience: r.experience,
    patientsToday: r.patients_today,
    status: r.status as DoctorStatus,
    departmentId: r.department_id,
  };
}

export function toPrescriptionItemDTO(
  r: PrescriptionItemRow,
): PrescriptionItemDTO {
  return {
    id: r.id,
    prescriptionId: r.prescription_id,
    medicineId: r.medicine_id,
    medicineName: r.medicine_name,
    dosage: r.dosage,
    frequency: r.frequency,
    duration: r.duration,
    instructions: r.instructions,
  };
}

export function toPrescriptionDTO(
  r: PrescriptionRow,
  items: PrescriptionItemRow[] = [],
): PrescriptionDTO {
  return {
    id: r.id,
    rxNumber: r.rx_number,
    patientName: r.patient_name,
    patientAge: r.patient_age,
    doctor: r.doctor,
    diagnosis: r.diagnosis,
    medicineCount: r.medicine_count,
    date: r.prescribed_date,
    status: r.status as PrescriptionStatus,
    patientId: r.patient_id,
    doctorId: r.doctor_id,
    items: items.map(toPrescriptionItemDTO),
  };
}

export function toPharmacyDTO(r: PharmacyItemRow): PharmacyItemDTO {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    stock: r.stock,
    minStock: r.min_stock,
    expiryDate: r.expiry_date,
    supplier: r.supplier,
    status: r.status as PharmacyStatus,
  };
}

export function toLabDTO(r: LabTestRow): LabTestDTO {
  return {
    id: r.id,
    patientName: r.patient_name,
    patientAge: r.patient_age,
    testName: r.test_name,
    sampleStatus: r.sample_status as "Pending" | "Collected",
    reportStatus: r.report_status as "Pending" | "Ready",
    date: r.test_date,
    amount: Number(r.amount),
    status: r.status as LabStatus,
    patientId: r.patient_id,
  };
}

export function toBillDTO(r: BillRow): BillDTO {
  return {
    id: r.id,
    billNumber: r.bill_number,
    patientName: r.patient_name,
    type: r.type as "OPD" | "Pharmacy" | "Lab" | "IPD",
    date: r.bill_date,
    amount: Number(r.amount),
    discount: Number(r.discount),
    gst: Number(r.gst),
    total: Number(r.total),
    status: r.status as BillingStatus,
    patientId: r.patient_id,
  };
}

export function toIpdDTO(r: IpdAdmissionRow): IpdRecordDTO {
  return {
    id: r.id,
    patientName: r.patient_name,
    patientAge: r.patient_age,
    patientId: r.patient_code,
    admissionDate: r.admission_date,
    ward: r.ward,
    bed: r.bed,
    doctor: r.doctor,
    diagnosis: r.diagnosis,
    creditLimit: Number(r.credit_limit ?? 0),
    status: r.status as IpdStatus,
    patientRefId: r.patient_id,
    bedId: r.bed_id,
    wardId: r.ward_id,
    doctorId: r.doctor_id,
  };
}

export function toOtDTO(r: OtScheduleRow): OtRecordDTO {
  return {
    id: r.id,
    patientName: r.patient_name,
    procedure: r.procedure,
    otRoom: r.ot_room,
    surgeon: r.surgeon,
    anesthetist: r.anesthetist,
    scheduledTime: r.scheduled_time,
    scheduledDate: r.scheduled_date,
    status: r.status as OtStatus,
    patientId: r.patient_id,
    surgeonId: r.surgeon_id,
  };
}

export function toBedDTO(r: BedRow): BedDTO {
  return {
    id: r.id,
    bedNumber: r.bed_number,
    ward: r.ward,
    patientName: r.patient_name ?? undefined,
    patientId: r.patient_code ?? undefined,
    status: r.status as BedStatus,
    wardId: r.ward_id,
  };
}

export function toStaffDTO(r: StaffRow): StaffDTO {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    department: r.department,
    phone: r.phone,
    email: r.email,
    joinDate: r.join_date,
    status: r.status as StaffStatus,
    departmentId: r.department_id,
  };
}

export function toDepartmentDTO(r: DepartmentRow): DepartmentDTO {
  return {
    id: r.id,
    name: r.name,
    head: r.head,
    ext: r.extension,
  };
}

export function toMedicineDTO(r: MedicineRow): MedicineDTO {
  return {
    id: r.id,
    name: r.name,
    generic: r.generic,
    category: r.category,
    defaultDosage: r.default_dosage,
    defaultFrequency: r.default_frequency,
    defaultDuration: r.default_duration,
    unit: r.unit,
  };
}

export function toBloodDonorDTO(r: BloodDonorRow): BloodDonorDTO {
  return {
    id: r.id,
    name: r.name,
    age: r.age,
    gender: r.gender as Gender,
    bloodGroup: r.blood_group as BloodGroup,
    phone: r.phone,
    lastDonationDate: r.last_donation_date,
    totalDonations: r.total_donations,
    status: r.status as DonorStatus,
  };
}

export function toBloodStockDTO(r: BloodStockRow): BloodStockDTO {
  return {
    id: r.id,
    bloodGroup: r.blood_group as BloodGroup,
    component: r.component as BloodComponent,
    units: r.units,
  };
}

export function toBloodIssueDTO(r: BloodIssueRow): BloodIssueDTO {
  return {
    id: r.id,
    patientId: r.patient_id,
    patientName: r.patient_name,
    bloodGroup: r.blood_group as BloodGroup,
    component: r.component as BloodComponent,
    units: r.units,
    doctor: r.doctor,
    date: r.issue_date,
    amount: Number(r.amount),
    status: r.status as BloodIssueStatus,
  };
}

export function toRadiologyDTO(r: RadiologyTestRow): RadiologyTestDTO {
  return {
    id: r.id,
    patientId: r.patient_id,
    patientName: r.patient_name,
    patientAge: r.patient_age,
    testName: r.test_name,
    scanStatus: r.scan_status as "Pending" | "Done",
    reportStatus: r.report_status as "Pending" | "Ready",
    date: r.test_date,
    amount: Number(r.amount),
    status: r.status as RadiologyStatus,
  };
}

export function toAmbulanceDTO(r: AmbulanceRow): AmbulanceDTO {
  return {
    id: r.id,
    vehicleNumber: r.vehicle_number,
    model: r.model,
    driverName: r.driver_name,
    driverPhone: r.driver_phone,
    status: r.status as AmbulanceStatus,
  };
}

export function toAmbulanceCallDTO(r: AmbulanceCallRow): AmbulanceCallDTO {
  return {
    id: r.id,
    patientName: r.patient_name,
    phone: r.phone,
    pickupLocation: r.pickup_location,
    dropLocation: r.drop_location,
    ambulanceId: r.ambulance_id,
    vehicleNumber: r.vehicle_number,
    driverName: r.driver_name,
    date: r.call_date,
    time: r.call_time,
    amount: Number(r.amount),
    status: r.status as AmbulanceCallStatus,
  };
}

export function toBirthRecordDTO(r: BirthRecordRow): BirthRecordDTO {
  return {
    id: r.id,
    childName: r.child_name,
    gender: r.gender as Gender,
    date: r.birth_date,
    time: r.birth_time,
    weightKg: Number(r.weight_kg),
    motherName: r.mother_name,
    fatherName: r.father_name,
    phone: r.phone,
    address: r.address,
  };
}

export function toDeathRecordDTO(r: DeathRecordRow): DeathRecordDTO {
  return {
    id: r.id,
    deceasedName: r.deceased_name,
    gender: r.gender as Gender,
    age: r.age,
    date: r.death_date,
    time: r.death_time,
    guardianName: r.guardian_name,
    cause: r.cause,
    phone: r.phone,
    address: r.address,
  };
}

export function toTpaDTO(r: TpaRow): TpaDTO {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    contactPerson: r.contact_person,
    phone: r.phone,
    email: r.email,
    address: r.address,
    status: r.status as TpaStatus,
  };
}

export function toTpaClaimDTO(r: TpaClaimRow): TpaClaimDTO {
  return {
    id: r.id,
    tpaId: r.tpa_id,
    tpaName: r.tpa_name,
    patientId: r.patient_id,
    patientName: r.patient_name,
    billNumber: r.bill_number,
    claimAmount: Number(r.claim_amount),
    approvedAmount: Number(r.approved_amount),
    date: r.claim_date,
    status: r.status as ClaimStatus,
  };
}

export function toFinanceEntryDTO(
  r: FinanceIncomeRow | FinanceExpenseRow,
): FinanceEntryDTO {
  return {
    id: r.id,
    category: r.category,
    description: r.description,
    invoiceNumber: r.invoice_number,
    amount: Number(r.amount),
    date: r.entry_date,
  };
}

export function toInventoryItemDTO(r: InventoryItemRow): InventoryItemDTO {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    unit: r.unit,
    stock: r.stock,
    minStock: r.min_stock,
    supplier: r.supplier,
    status: r.status as InventoryStatus,
  };
}

export function toInventoryIssueDTO(r: InventoryIssueRow): InventoryIssueDTO {
  return {
    id: r.id,
    itemId: r.item_id,
    itemName: r.item_name,
    department: r.department,
    quantity: r.quantity,
    issuedTo: r.issued_to,
    date: r.issue_date,
    note: r.note,
  };
}

export function toAdminUserDTO(
  r: UserRow,
  departmentName: string | null,
): AdminUserDTO {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    department: departmentName,
    departmentId: r.department_id,
    status: r.status,
    lastLogin: r.last_login_at ?? "Never",
  };
}
