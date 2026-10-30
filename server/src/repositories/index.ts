/**
 * Repository instances — one per table, wired with its DTO mapper.
 */
import { createRepository } from "@/repositories/base";
import { TABLES } from "@/db/tables";
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
  PlatformBillRow,
  AuditLogRow,
  BloodDonorRow,
  BloodUnitRow,
  BloodCrossmatchRow,
  BloodTransfusionRow,
  MrdLocationRow,
  MrdFileRow,
  MrdFileMovementRow,
  MrdFileRequestRow,
  MrdRetentionPolicyRow,
  MrdFolderRow,
  MrdCodingCaseRow,
  MrdDeficiencyRow,
  MrdRegisterEntryRow,
  SignatureRequestRow,
  ConsentTemplateRow,
  CssdSterilizerRow,
  CssdSetRow,
  CssdCycleRow,
  CssdIssueRow,
  CssdSettingsRow,
  HrLeaveTypeRow,
  HrLeaveRequestRow,
  HrShiftRow,
  SetupRecordRow,
  PharmacyBatchRow,
  BillItemRow,
  BillPayoutRow,
  WhatsappAccountRow,
  WhatsappMessageRow,
  HkTaskRow,
  DietTypeRow,
  WasteCollectionRow,
  WasteDisposalRow,
  IcEventRow,
  HandHygieneAuditRow,
  DietOrderRow,
  DietSheetRow,
  DietSheetLineRow,
  CanteenItemRow,
  CanteenSaleRow,
  HkLinenCategoryRow,
  HkLinenMoveRow,
  PharmacyDispenseRow,
  PharmacyDispenseLineRow,
  PharmacyReturnRow,
  HrRosterRow,
  HrSalaryRow,
  HrPayrollRunRow,
  HrPayslipRow,
  RadiologyTestRow,
  AmbulanceRow,
  AmbulanceCallRow,
  BirthRecordRow,
  DeathRecordRow,
  TpaRow,
  TpaClaimRow,
  EnquiryRow,
  FollowUpRow,
  OtRoomRow,
  OtEquipmentRow,
  IpdVitalRow,
  IpdIvLineRow,
  IpdDoseLogRow,
  IpdNursingTaskRow,
  IpdHandoverRow,
  IpdAlertAckRow,
  IpdChecklistTemplateRow,
  IpdChecklistRow,
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
  TeleconsultBookingRow,
  GoogleConnectionRow,
  TeleconsultPaymentRow,
} from "@/db/tables";
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
  toMrdLocationDTO,
  toMrdFileDTO,
  toMrdFileMovementDTO,
  toMrdFileRequestDTO,
  toMrdRetentionPolicyDTO,
  toMrdFolderDTO,
  toMrdCodingCaseDTO,
  toMrdDeficiencyDTO,
  toMrdRegisterEntryDTO,
  toConsentDTO,
  toBloodUnitDTO,
  toBloodCrossmatchDTO,
  toBloodTransfusionDTO,
  toRadiologyDTO,
  toAmbulanceDTO,
  toAmbulanceCallDTO,
  toBirthRecordDTO,
  toDeathRecordDTO,
  toTpaDTO,
  toTpaClaimDTO,
  toEnquiryDTO,
  toFollowUpDTO,
  toOtRoomDTO,
  toOtEquipmentDTO,
  toIpdVitalDTO,
  toIpdIvLineDTO,
  toIpdDoseLogDTO,
  toIpdNursingTaskDTO,
  toIpdHandoverDTO,
  toIpdAlertAckDTO,
  toIpdChecklistTemplateDTO,
  toIpdChecklistDTO,
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
} from "@/repositories/mappers";

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
  (r) => toBloodDonorDTO(r),
);
export const bloodUnitsRepo = createRepository<BloodUnitRow, ReturnType<typeof toBloodUnitDTO>>(
  TABLES.bloodUnits,
  (r) => toBloodUnitDTO(r),
);
export const bloodCrossmatchesRepo = createRepository<BloodCrossmatchRow, ReturnType<typeof toBloodCrossmatchDTO>>(
  TABLES.bloodCrossmatches,
  toBloodCrossmatchDTO,
);
export const bloodTransfusionsRepo = createRepository<BloodTransfusionRow, ReturnType<typeof toBloodTransfusionDTO>>(
  TABLES.bloodTransfusions,
  toBloodTransfusionDTO,
);
export const mrdLocationsRepo = createRepository<MrdLocationRow, ReturnType<typeof toMrdLocationDTO>>(TABLES.mrdLocations, (r) => toMrdLocationDTO(r));
export const mrdFilesRepo = createRepository<MrdFileRow, ReturnType<typeof toMrdFileDTO>>(TABLES.mrdFiles, (r) => toMrdFileDTO(r));
export const mrdFileRequestsRepo = createRepository<MrdFileRequestRow, ReturnType<typeof toMrdFileRequestDTO>>(TABLES.mrdFileRequests, toMrdFileRequestDTO);
export const mrdFileMovementsRepo = createRepository<MrdFileMovementRow, ReturnType<typeof toMrdFileMovementDTO>>(TABLES.mrdFileMovements, toMrdFileMovementDTO);
export const mrdRetentionPoliciesRepo = createRepository<MrdRetentionPolicyRow, ReturnType<typeof toMrdRetentionPolicyDTO>>(TABLES.mrdRetentionPolicies, toMrdRetentionPolicyDTO);
export const mrdFoldersRepo = createRepository<MrdFolderRow, ReturnType<typeof toMrdFolderDTO>>(TABLES.mrdFolders, (r) => toMrdFolderDTO(r));
export const mrdCodingCasesRepo = createRepository<MrdCodingCaseRow, ReturnType<typeof toMrdCodingCaseDTO>>(TABLES.mrdCodingCases, (r) => toMrdCodingCaseDTO(r));
export const mrdDeficienciesRepo = createRepository<MrdDeficiencyRow, ReturnType<typeof toMrdDeficiencyDTO>>(TABLES.mrdDeficiencies, toMrdDeficiencyDTO);
export const mrdRegisterEntriesRepo = createRepository<MrdRegisterEntryRow, ReturnType<typeof toMrdRegisterEntryDTO>>(TABLES.mrdRegisterEntries, toMrdRegisterEntryDTO);
export const signatureRequestsRepo = createRepository<SignatureRequestRow, ReturnType<typeof toConsentDTO>>(TABLES.signatureRequests, toConsentDTO);
export const consentTemplatesRepo = createRepository<ConsentTemplateRow, ConsentTemplateRow>(TABLES.consentTemplates, (r) => r);
export const cssdSterilizersRepo = createRepository<CssdSterilizerRow, CssdSterilizerRow>(TABLES.cssdSterilizers, (r) => r);
export const cssdSetsRepo = createRepository<CssdSetRow, CssdSetRow>(TABLES.cssdSets, (r) => r);
export const cssdCyclesRepo = createRepository<CssdCycleRow, CssdCycleRow>(TABLES.cssdCycles, (r) => r);
export const cssdIssuesRepo = createRepository<CssdIssueRow, CssdIssueRow>(TABLES.cssdIssues, (r) => r);
export const cssdSettingsRepo = createRepository<CssdSettingsRow, CssdSettingsRow>(TABLES.cssdSettings, (r) => r);
export const hrLeaveTypesRepo = createRepository<HrLeaveTypeRow, HrLeaveTypeRow>(TABLES.hrLeaveTypes, (r) => r);
export const hrLeaveRequestsRepo = createRepository<HrLeaveRequestRow, HrLeaveRequestRow>(TABLES.hrLeaveRequests, (r) => r);
export const billItemsRepo = createRepository<BillItemRow, BillItemRow>(TABLES.billItems, (r) => r);
export const whatsappAccountsRepo = createRepository<WhatsappAccountRow, WhatsappAccountRow>(TABLES.whatsappAccounts, (r) => r);
export const whatsappMessagesRepo = createRepository<WhatsappMessageRow, WhatsappMessageRow>(TABLES.whatsappMessages, (r) => r);
export const billPayoutsRepo = createRepository<BillPayoutRow, BillPayoutRow>(TABLES.billPayouts, (r) => r);
export const pharmacyBatchesRepo = createRepository<PharmacyBatchRow, PharmacyBatchRow>(TABLES.pharmacyBatches, (r) => r);
export const pharmacyDispensesRepo = createRepository<PharmacyDispenseRow, PharmacyDispenseRow>(TABLES.pharmacyDispenses, (r) => r);
export const pharmacyDispenseLinesRepo = createRepository<PharmacyDispenseLineRow, PharmacyDispenseLineRow>(TABLES.pharmacyDispenseLines, (r) => r);
export const pharmacyReturnsRepo = createRepository<PharmacyReturnRow, PharmacyReturnRow>(TABLES.pharmacyReturns, (r) => r);
export const setupRecordsRepo = createRepository<SetupRecordRow, SetupRecordRow>(TABLES.setupRecords, (r) => r);
export const hrShiftsRepo = createRepository<HrShiftRow, HrShiftRow>(TABLES.hrShifts, (r) => r);
export const hrRosterRepo = createRepository<HrRosterRow, HrRosterRow>(TABLES.hrRoster, (r) => r);
export const hrSalariesRepo = createRepository<HrSalaryRow, HrSalaryRow>(TABLES.hrSalaries, (r) => r);
export const hrPayrollRunsRepo = createRepository<HrPayrollRunRow, HrPayrollRunRow>(TABLES.hrPayrollRuns, (r) => r);
export const hrPayslipsRepo = createRepository<HrPayslipRow, HrPayslipRow>(TABLES.hrPayslips, (r) => r);
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
export const followupsRepo = createRepository<FollowUpRow, ReturnType<typeof toFollowUpDTO>>(
  TABLES.followups,
  toFollowUpDTO,
);
export const enquiriesRepo = createRepository<EnquiryRow, ReturnType<typeof toEnquiryDTO>>(
  TABLES.enquiries,
  toEnquiryDTO,
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
export const ipdVitalsRepo = createRepository<IpdVitalRow, ReturnType<typeof toIpdVitalDTO>>(TABLES.ipdVitals, toIpdVitalDTO);
export const ipdIvLinesRepo = createRepository<IpdIvLineRow, ReturnType<typeof toIpdIvLineDTO>>(TABLES.ipdIvLines, toIpdIvLineDTO);
export const ipdDoseLogRepo = createRepository<IpdDoseLogRow, ReturnType<typeof toIpdDoseLogDTO>>(TABLES.ipdDoseLog, toIpdDoseLogDTO);
export const ipdNursingTasksRepo = createRepository<IpdNursingTaskRow, ReturnType<typeof toIpdNursingTaskDTO>>(TABLES.ipdNursingTasks, toIpdNursingTaskDTO);
export const ipdHandoversRepo = createRepository<IpdHandoverRow, ReturnType<typeof toIpdHandoverDTO>>(TABLES.ipdHandovers, toIpdHandoverDTO);
export const ipdAlertAcksRepo = createRepository<IpdAlertAckRow, ReturnType<typeof toIpdAlertAckDTO>>(TABLES.ipdAlertAcks, toIpdAlertAckDTO);
export const ipdChecklistTemplatesRepo = createRepository<IpdChecklistTemplateRow, ReturnType<typeof toIpdChecklistTemplateDTO>>(TABLES.ipdChecklistTemplates, toIpdChecklistTemplateDTO);
export const ipdChecklistsRepo = createRepository<IpdChecklistRow, ReturnType<typeof toIpdChecklistDTO>>(TABLES.ipdChecklists, toIpdChecklistDTO);
export const otRoomsRepo = createRepository<OtRoomRow, ReturnType<typeof toOtRoomDTO>>(TABLES.otRooms, (r) => toOtRoomDTO(r));
export const otEquipmentRepo = createRepository<OtEquipmentRow, ReturnType<typeof toOtEquipmentDTO>>(TABLES.otEquipment, toOtEquipmentDTO);
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
export const platformBillsRepo = createRepository<PlatformBillRow, PlatformBillRow>(
  TABLES.platformBills,
  (row) => row,
);
export const auditRepo = createRepository<AuditLogRow, AuditLogRow>(
  TABLES.auditLogs,
  (row) => row,
);

/** Raw rows — tele-consult bookings and Google connections are only ever read through their service. */
export const teleconsultBookingsRepo = createRepository<TeleconsultBookingRow, TeleconsultBookingRow>(
  TABLES.teleconsultBookings,
  (row) => row,
);
export const googleConnectionsRepo = createRepository<GoogleConnectionRow, GoogleConnectionRow>(
  TABLES.googleConnections,
  (row) => row,
);
export const teleconsultPaymentsRepo = createRepository<TeleconsultPaymentRow, TeleconsultPaymentRow>(
  TABLES.teleconsultPayments,
  (row) => row,
);

export const hkTasksRepo = createRepository<HkTaskRow, HkTaskRow>(TABLES.hkTasks, (r) => r);
export const hkLinenCategoriesRepo = createRepository<HkLinenCategoryRow, HkLinenCategoryRow>(TABLES.hkLinenCategories, (r) => r);
export const hkLinenMovesRepo = createRepository<HkLinenMoveRow, HkLinenMoveRow>(TABLES.hkLinenMoves, (r) => r);

export const dietTypesRepo = createRepository<DietTypeRow, DietTypeRow>(TABLES.dietTypes, (r) => r);
export const dietOrdersRepo = createRepository<DietOrderRow, DietOrderRow>(TABLES.dietOrders, (r) => r);
export const dietSheetsRepo = createRepository<DietSheetRow, DietSheetRow>(TABLES.dietSheets, (r) => r);
export const dietSheetLinesRepo = createRepository<DietSheetLineRow, DietSheetLineRow>(TABLES.dietSheetLines, (r) => r);
export const canteenItemsRepo = createRepository<CanteenItemRow, CanteenItemRow>(TABLES.canteenItems, (r) => r);
export const canteenSalesRepo = createRepository<CanteenSaleRow, CanteenSaleRow>(TABLES.canteenSales, (r) => r);

export const wasteCollectionsRepo = createRepository<WasteCollectionRow, WasteCollectionRow>(TABLES.wasteCollections, (r) => r);
export const wasteDisposalsRepo = createRepository<WasteDisposalRow, WasteDisposalRow>(TABLES.wasteDisposals, (r) => r);
export const icEventsRepo = createRepository<IcEventRow, IcEventRow>(TABLES.icEvents, (r) => r);
export const handHygieneAuditsRepo = createRepository<HandHygieneAuditRow, HandHygieneAuditRow>(TABLES.handHygieneAudits, (r) => r);
