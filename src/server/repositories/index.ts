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
  BedTransferRow,
  WardRow,
  StaffRow,
  DepartmentRow,
  MedicineRow,
  UserRow,
  HospitalRow,
  RadiologyCenterRow,
  HospitalRadiologyLinkRow,
  LabCenterRow,
  HospitalLabLinkRow,
  AuditLogRow,
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
  TaskRow,
  ChatThreadRow,
  ChatMessageRow,
  DocumentRow,
  IpdNoteRow,
  StaffAttendanceRow,
  IpdMedicationRow,
  PurchaseOrderRow,
  PurchaseOrderItemRow,
  PharmacySaleRow,
  PharmacySaleItemRow,
  ScribeNoteRow,
  PrescriptionTemplateRow,
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
  toBloodDonorDTO,
  toBloodStockDTO,
  toBloodIssueDTO,
  toRadiologyDTO,
  toAmbulanceDTO,
  toAmbulanceCallDTO,
  toBirthRecordDTO,
  toDeathRecordDTO,
  toTpaDTO,
  toTpaClaimDTO,
  toFinanceEntryDTO,
  toInventoryItemDTO,
  toInventoryIssueDTO,
  toTaskDTO,
  toChatThreadDTO,
  toChatMessageDTO,
  toDocumentDTO,
  toIpdNoteDTO,
  toStaffAttendanceDTO,
  toIpdMedicationDTO,
  toPurchaseOrderDTO,
  toPurchaseOrderItemDTO,
  toPharmacySaleDTO,
  toPharmacySaleItemDTO,
  toScribeNoteDTO,
  toPrescriptionTemplateDTO,
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

export const bloodDonorsRepo = createRepository<BloodDonorRow, ReturnType<typeof toBloodDonorDTO>>(
  TABLES.bloodDonors,
  toBloodDonorDTO,
);
export const bloodStockRepo = createRepository<BloodStockRow, ReturnType<typeof toBloodStockDTO>>(
  TABLES.bloodStock,
  toBloodStockDTO,
);
export const bloodIssuesRepo = createRepository<BloodIssueRow, ReturnType<typeof toBloodIssueDTO>>(
  TABLES.bloodIssues,
  toBloodIssueDTO,
);
export const radiologyRepo = createRepository<RadiologyTestRow, ReturnType<typeof toRadiologyDTO>>(
  TABLES.radiologyTests,
  toRadiologyDTO,
);
export const ambulancesRepo = createRepository<AmbulanceRow, ReturnType<typeof toAmbulanceDTO>>(
  TABLES.ambulances,
  toAmbulanceDTO,
);
export const ambulanceCallsRepo = createRepository<AmbulanceCallRow, ReturnType<typeof toAmbulanceCallDTO>>(
  TABLES.ambulanceCalls,
  toAmbulanceCallDTO,
);
export const birthRecordsRepo = createRepository<BirthRecordRow, ReturnType<typeof toBirthRecordDTO>>(
  TABLES.birthRecords,
  toBirthRecordDTO,
);
export const deathRecordsRepo = createRepository<DeathRecordRow, ReturnType<typeof toDeathRecordDTO>>(
  TABLES.deathRecords,
  toDeathRecordDTO,
);
export const tpasRepo = createRepository<TpaRow, ReturnType<typeof toTpaDTO>>(
  TABLES.tpas,
  toTpaDTO,
);
export const tpaClaimsRepo = createRepository<TpaClaimRow, ReturnType<typeof toTpaClaimDTO>>(
  TABLES.tpaClaims,
  toTpaClaimDTO,
);
export const financeIncomesRepo = createRepository<FinanceIncomeRow, ReturnType<typeof toFinanceEntryDTO>>(
  TABLES.financeIncomes,
  toFinanceEntryDTO,
);
export const financeExpensesRepo = createRepository<FinanceExpenseRow, ReturnType<typeof toFinanceEntryDTO>>(
  TABLES.financeExpenses,
  toFinanceEntryDTO,
);
export const inventoryItemsRepo = createRepository<InventoryItemRow, ReturnType<typeof toInventoryItemDTO>>(
  TABLES.inventoryItems,
  toInventoryItemDTO,
);
export const inventoryIssuesRepo = createRepository<InventoryIssueRow, ReturnType<typeof toInventoryIssueDTO>>(
  TABLES.inventoryIssues,
  toInventoryIssueDTO,
);
export const purchaseOrdersRepo = createRepository<PurchaseOrderRow, ReturnType<typeof toPurchaseOrderDTO>>(
  TABLES.purchaseOrders,
  (row) => toPurchaseOrderDTO(row),
);
export const purchaseOrderItemsRepo = createRepository<PurchaseOrderItemRow, ReturnType<typeof toPurchaseOrderItemDTO>>(
  TABLES.purchaseOrderItems,
  toPurchaseOrderItemDTO,
);
export const pharmacySalesRepo = createRepository<PharmacySaleRow, ReturnType<typeof toPharmacySaleDTO>>(
  TABLES.pharmacySales,
  (row) => toPharmacySaleDTO(row),
);
export const pharmacySaleItemsRepo = createRepository<PharmacySaleItemRow, ReturnType<typeof toPharmacySaleItemDTO>>(
  TABLES.pharmacySaleItems,
  toPharmacySaleItemDTO,
);
export const staffAttendanceRepo = createRepository<StaffAttendanceRow, ReturnType<typeof toStaffAttendanceDTO>>(
  TABLES.staffAttendance,
  toStaffAttendanceDTO,
);
export const ipdNotesRepo = createRepository<IpdNoteRow, ReturnType<typeof toIpdNoteDTO>>(
  TABLES.ipdNotes,
  toIpdNoteDTO,
);
export const ipdMedicationsRepo = createRepository<IpdMedicationRow, ReturnType<typeof toIpdMedicationDTO>>(
  TABLES.ipdMedications,
  toIpdMedicationDTO,
);
export const documentsRepo = createRepository<DocumentRow, ReturnType<typeof toDocumentDTO>>(
  TABLES.documents,
  toDocumentDTO,
);
export const tasksRepo = createRepository<TaskRow, ReturnType<typeof toTaskDTO>>(
  TABLES.tasks,
  toTaskDTO,
);
export const chatThreadsRepo = createRepository<ChatThreadRow, ReturnType<typeof toChatThreadDTO>>(
  TABLES.chatThreads,
  toChatThreadDTO,
);
export const chatMessagesRepo = createRepository<ChatMessageRow, ReturnType<typeof toChatMessageDTO>>(
  TABLES.chatMessages,
  toChatMessageDTO,
);
export const scribeNotesRepo = createRepository<ScribeNoteRow, ReturnType<typeof toScribeNoteDTO>>(
  TABLES.scribeNotes,
  toScribeNoteDTO,
);
export const prescriptionTemplatesRepo = createRepository<
  PrescriptionTemplateRow,
  ReturnType<typeof toPrescriptionTemplateDTO>
>(TABLES.prescriptionTemplates, toPrescriptionTemplateDTO);

// Raw-only repositories (no public DTO mapping needed).
export const usersRepo = createRepository<UserRow, UserRow>(
  TABLES.users,
  (row) => row,
);
export const wardsRepo = createRepository<WardRow, WardRow>(
  TABLES.wards,
  (row) => row,
);
export const bedTransfersRepo = createRepository<BedTransferRow, BedTransferRow>(
  TABLES.bedTransfers,
  (row) => row,
);
export const hospitalsRepo = createRepository<HospitalRow, HospitalRow>(
  TABLES.hospitals,
  (row) => row,
);
export const radiologyCentersRepo = createRepository<RadiologyCenterRow, RadiologyCenterRow>(
  TABLES.radiologyCenters,
  (row) => row,
);
export const hospitalRadiologyLinksRepo = createRepository<
  HospitalRadiologyLinkRow,
  HospitalRadiologyLinkRow
>(TABLES.hospitalRadiologyLinks, (row) => row);
export const labCentersRepo = createRepository<LabCenterRow, LabCenterRow>(
  TABLES.labCenters,
  (row) => row,
);
export const hospitalLabLinksRepo = createRepository<
  HospitalLabLinkRow,
  HospitalLabLinkRow
>(TABLES.hospitalLabLinks, (row) => row);
export const auditRepo = createRepository<AuditLogRow, AuditLogRow>(
  TABLES.auditLogs,
  (row) => row,
);
