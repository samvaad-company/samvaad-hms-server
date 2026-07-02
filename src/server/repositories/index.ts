/**
 * Repository instances — one per table, wired with its DTO mapper.
 */
import { createRepository } from "@/server/repositories/base";
import { TABLES } from "@/server/db/tables";
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
  WardRow,
  StaffRow,
  DepartmentRow,
  MedicineRow,
  UserRow,
  HospitalSettingsRow,
  AuditLogRow,
} from "@/server/db/tables";
import {
  toPatientDTO,
  toAppointmentDTO,
  toOpdDTO,
  toDoctorDTO,
  toPrescriptionDTO,
  toPrescriptionItemDTO,
  toPharmacyDTO,
  toLabDTO,
  toBillDTO,
  toIpdDTO,
  toOtDTO,
  toBedDTO,
  toStaffDTO,
  toDepartmentDTO,
  toMedicineDTO,
} from "@/server/repositories/mappers";

export const patientsRepo = createRepository<PatientRow, ReturnType<typeof toPatientDTO>>(
  TABLES.patients,
  toPatientDTO,
);
export const appointmentsRepo = createRepository<AppointmentRow, ReturnType<typeof toAppointmentDTO>>(
  TABLES.appointments,
  toAppointmentDTO,
);
export const opdRepo = createRepository<OpdVisitRow, ReturnType<typeof toOpdDTO>>(
  TABLES.opdVisits,
  toOpdDTO,
);
export const doctorsRepo = createRepository<DoctorRow, ReturnType<typeof toDoctorDTO>>(
  TABLES.doctors,
  toDoctorDTO,
);
export const prescriptionsRepo = createRepository<PrescriptionRow, ReturnType<typeof toPrescriptionDTO>>(
  TABLES.prescriptions,
  (row) => toPrescriptionDTO(row),
);
export const prescriptionItemsRepo = createRepository<PrescriptionItemRow, ReturnType<typeof toPrescriptionItemDTO>>(
  TABLES.prescriptionItems,
  toPrescriptionItemDTO,
);
export const pharmacyRepo = createRepository<PharmacyItemRow, ReturnType<typeof toPharmacyDTO>>(
  TABLES.pharmacyItems,
  toPharmacyDTO,
);
export const labRepo = createRepository<LabTestRow, ReturnType<typeof toLabDTO>>(
  TABLES.labTests,
  toLabDTO,
);
export const billsRepo = createRepository<BillRow, ReturnType<typeof toBillDTO>>(
  TABLES.bills,
  toBillDTO,
);
export const ipdRepo = createRepository<IpdAdmissionRow, ReturnType<typeof toIpdDTO>>(
  TABLES.ipdAdmissions,
  toIpdDTO,
);
export const otRepo = createRepository<OtScheduleRow, ReturnType<typeof toOtDTO>>(
  TABLES.otSchedules,
  toOtDTO,
);
export const bedsRepo = createRepository<BedRow, ReturnType<typeof toBedDTO>>(
  TABLES.beds,
  toBedDTO,
);
export const staffRepo = createRepository<StaffRow, ReturnType<typeof toStaffDTO>>(
  TABLES.staff,
  toStaffDTO,
);
export const departmentsRepo = createRepository<DepartmentRow, ReturnType<typeof toDepartmentDTO>>(
  TABLES.departments,
  toDepartmentDTO,
);
export const medicinesRepo = createRepository<MedicineRow, ReturnType<typeof toMedicineDTO>>(
  TABLES.medicines,
  toMedicineDTO,
);

// Raw-only repositories (no public DTO mapping needed).
export const usersRepo = createRepository<UserRow, UserRow>(
  TABLES.users,
  (row) => row,
);
export const wardsRepo = createRepository<WardRow, WardRow>(
  TABLES.wards,
  (row) => row,
);
export const settingsRepo = createRepository<HospitalSettingsRow, HospitalSettingsRow>(
  TABLES.hospitalSettings,
  (row) => row,
);
export const auditRepo = createRepository<AuditLogRow, AuditLogRow>(
  TABLES.auditLogs,
  (row) => row,
);
