/**
 * Row → DTO mappers. Translate persisted snake_case rows into the camelCase
 * DTOs the API returns and the frontend consumes.
 */
import { isoDate } from "@/services/helpers";
import { patientsPerHourOf } from "@/lib/scheduling-rules";
import type {
  PatientDTO,
  AppointmentDTO,
  OpdRecordDTO,
  DoctorDTO,
  PrescriptionDTO,
  PrescriptionItemDTO,
  PrescriptionTemplateDTO,
  PrescriptionTemplateItemDTO,
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
  BloodUnitDTO,
  BloodCrossmatchDTO,
  BloodTransfusionDTO,
  MrdLocationDTO,
  MrdFileDTO,
  MrdFileMovementDTO,
  MrdFileRequestDTO,
  MrdRetentionPolicyDTO,
  MrdFolderDTO,
  MrdCodingCaseDTO,
  MrdDeficiencyDTO,
  MrdRegisterEntryDTO,
  ConsentDTO,
  BloodReactionDTO,
  BloodUnitStatus,
  BloodComponent,
  SerologyDTO,
  RadiologyTestDTO,
  IpdVitalDTO,
  OtCaseType,
  OtCategory,
  OtFitness,
  OtRoomDTO,
  OtEquipmentDTO,
  IpdAdmissionType,
  DepositMode,
  IpdIvLineDTO,
  IpdNursingTaskDTO,
  IpdHandoverDTO,
  IpdChecklistTemplateDTO,
  IpdChecklistDTO,
  AmbulanceDTO,
  AmbulanceCallDTO,
  BirthRecordDTO,
  DeathRecordDTO,
  TpaDTO,
  TpaClaimDTO,
  EnquiryDTO,
  FollowUpDTO,
  FollowUpStatus,
  EnquiryStatus,
  FinanceEntryDTO,
  InventoryItemDTO,
  InventoryIssueDTO,
  TaskDTO,
  ChatThreadDTO,
  ChatMessageDTO,
  DocumentDTO,
  IpdNoteDTO,
  StaffAttendanceDTO,
  IpdMedicationDTO,
  PurchaseOrderDTO,
  PurchaseOrderItemDTO,
  PharmacySaleDTO,
  PharmacySaleItemDTO,
  ScribeNoteDTO,
} from "@shared/types/api";
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
  RadiologyTestRow,
  IpdVitalRow,
  OtRoomRow,
  OtEquipmentRow,
  IpdIvLineRow,
  IpdDoseLogRow,
  IpdNursingTaskRow,
  IpdHandoverRow,
  IpdAlertAckRow,
  IpdChecklistTemplateRow,
  IpdChecklistRow,
  AmbulanceRow,
  AmbulanceCallRow,
  BirthRecordRow,
  DeathRecordRow,
  TpaRow,
  TpaClaimRow,
  EnquiryRow,
  FollowUpRow,
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
} from "@/db/tables";
import type {
  Gender,
  BloodGroup,
  AppointmentStatus,
  OpdStatus,
  OpdPriority,
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
} from "@shared/types";

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
    ageMonths: r.age_months ?? null,
    referralSource: r.referral_source ?? null,
    patientCategory: r.patient_category ?? null,
    incomeGroup: r.income_group ?? null,
    visitPurpose: r.visit_purpose ?? null,
    medicoLegal: !!r.medico_legal,
    temporary: !!r.is_temporary,
    dataConsent: !!r.data_consent,
    alternatePhone: r.alternate_phone ?? null,
    addressLine2: r.address_line2 ?? null,
    title: r.title ?? null,
    guardianName: r.guardian_name ?? null,
    careOf: r.care_of ?? null,
    anniversary: r.anniversary ?? null,
    maritalStatus: r.marital_status ?? null,
    religion: r.religion ?? null,
    language: r.language ?? null,
    nationality: r.nationality ?? null,
    education: r.education ?? null,
    notes: r.notes ?? null,
    occupation: r.occupation ?? null,
    employer: r.employer ?? null,
    designation: r.designation ?? null,
    workPhone: r.work_phone ?? null,
    privilegeCardNo: r.privilege_card_no ?? null,
    payers: r.payers ?? [],
    // Never the fingerprint — just enough to recognise the document.
    identityDocuments: (r.identity_documents ?? []).map((d) => ({ type: d.type, last4: d.last4 })),
    covid: r.covid_details ?? null,
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
    type: r.type as "Walk-in" | "Booked" | "Tele-consult",
    reason: r.reason,
    visitPurpose: r.visit_purpose ?? null,
    status: r.status as AppointmentStatus,
    patientId: r.patient_id,
    doctorId: r.doctor_id,
    videoUrl: r.video_url ?? null,
    videoProvider: r.video_provider ?? null,
    meetError: r.meet_error ?? null,
    meetAccess: r.meet_access ?? null,
    rescheduleCount: r.reschedule_count ?? 0,
    rescheduledFrom: r.rescheduled_from ?? null,
    meetWarning: r.meet_warning ?? null,
    consultAmount: r.consult_amount ?? null,
    paymentStatus: r.payment_status ?? null,
    paymentId: r.payment_id ?? null,
    orderId: r.order_id ?? null,
  };
}

export function toOpdDTO(r: OpdVisitRow): OpdRecordDTO {
  return {
    id: r.id,
    tokenNumber: r.token_number,
    patientName: r.patient_name,
    patientAge: r.patient_age,
    doctor: r.doctor,
    reason: r.reason ?? "",
    priority: (r.priority ?? "Normal") as OpdPriority,
    vitalsRecorded: r.vitals_recorded,
    vitals: {
      bpSystolic: r.bp_systolic ?? null,
      bpDiastolic: r.bp_diastolic ?? null,
      pulse: r.pulse ?? null,
      temperature: r.temperature ?? null,
      spo2: r.spo2 ?? null,
    },
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
    patientsPerHour: patientsPerHourOf(r),
    slotMinutes: 60 / patientsPerHourOf(r),
    videoEnabled: !!r.video_enabled,
    videoHours: Array.isArray(r.video_hours) ? r.video_hours : [],
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

export function toPrescriptionTemplateDTO(
  r: PrescriptionTemplateRow,
): PrescriptionTemplateDTO {
  return {
    id: r.id,
    doctorId: r.doctor_id,
    name: r.name,
    items: Array.isArray(r.items) ? (r.items as PrescriptionTemplateItemDTO[]) : [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
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
    hospitalId: r.hospital_id,
    patientName: r.patient_name,
    patientAge: r.patient_age,
    testName: r.test_name,
    sampleStatus: r.sample_status as "Pending" | "Collected",
    reportStatus: r.report_status as "Pending" | "Ready",
    date: r.test_date,
    amount: Number(r.amount),
    status: r.status as LabStatus,
    patientId: r.patient_id,
    orderNumber: r.order_number ?? "",
    requestedBy: r.requested_by ?? "",
    doctorId: r.doctor_id,
    doctor: r.doctor ?? "",
    priority: (r.priority ?? "Routine") as LabPriority,
    // Joined in by the service layer, like the names below.
    patientCode: null,
    collectionDate: r.collection_date ?? "",
    discount: Number(r.discount ?? 0),
    discountType: (r.discount_type as "percent" | "amount") ?? "amount",
    labCenterId: r.lab_center_id,
    // Joined in by the service layer (a plain row->DTO mapper has no async
    // lookups); default so every LabTestDTO has the same shape.
    labCenterName: null,
    hospitalName: null,
    hasReport: Boolean(r.report_file),
    reportFileName: r.report_file_name ?? null,
    reportNote: r.report_note ?? null,
    reportUploadedBy: r.report_uploaded_by ?? null,
    reportUploadedAt: r.report_uploaded_at ?? null,
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
    ...(r.contract_id ? { contractId: r.contract_id, contractName: r.contract_name ?? "", payerShare: Number(r.payer_share ?? 0), patientShare: Number(r.patient_share ?? r.total) } : {}),
    ...(r.doctor_name ? { doctorName: r.doctor_name } : {}),
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
    // Admissions made before these fields existed read as a plain planned admission.
    admissionNo: r.admission_no || `ADM/${(r.admission_date || "").slice(0, 4) || new Date().getFullYear()}/${String(r.id).padStart(5, "0")}`,
    admissionType: (r.admission_type || "Planned") as IpdAdmissionType,
    isMlc: Boolean(r.is_mlc),
    // Joined in by the service layer, which has the patient record.
    gender: "",
    familyName: r.family_name ?? "",
    familyRelation: r.family_relation ?? "",
    familyPhone: r.family_phone ?? "",
    depositAmount: Number(r.deposit_amount ?? 0),
    depositMode: (r.deposit_mode || "") as DepositMode | "",
    primaryNurseId: r.primary_nurse_id ?? null,
    primaryNurse: r.primary_nurse ?? "",
    expectedStayDays: r.expected_stay_days ?? null,
    diet: r.diet ?? "",
  };
}

export function toIpdVitalDTO(r: IpdVitalRow): IpdVitalDTO {
  return {
    id: r.id,
    admissionId: r.admission_id,
    recordedAt: r.recorded_at,
    tempC: r.temp_c ?? null,
    pulse: r.pulse ?? null,
    bpSystolic: r.bp_systolic ?? null,
    bpDiastolic: r.bp_diastolic ?? null,
    spo2: r.spo2 ?? null,
    respRate: r.resp_rate ?? null,
    note: r.note ?? "",
    recordedBy: r.recorded_by ?? "",
  };
}

export function toIpdIvLineDTO(r: IpdIvLineRow): IpdIvLineDTO {
  const rate = Number(r.rate_ml_hr) || 0;
  const hours = rate > 0 ? Number(r.volume_ml) / rate : 0;
  return {
    id: r.id,
    admissionId: r.admission_id,
    fluid: r.fluid,
    volumeMl: Number(r.volume_ml),
    rateMlHr: rate,
    startedAt: r.started_at,
    stoppedAt: r.stopped_at ?? null,
    status: r.status as IpdIvLineDTO["status"],
    startedBy: r.started_by ?? "",
    note: r.note ?? "",
    endsAt: new Date(new Date(r.started_at).getTime() + hours * 3_600_000).toISOString(),
  };
}

export function toIpdNursingTaskDTO(r: IpdNursingTaskRow): IpdNursingTaskDTO {
  return {
    id: r.id,
    admissionId: r.admission_id ?? null,
    title: r.title,
    dueAt: r.due_at ?? null,
    status: r.status as IpdNursingTaskDTO["status"],
    createdBy: r.created_by ?? "",
    doneBy: r.done_by ?? null,
    doneAt: r.done_at ?? null,
    overdue: r.status === "To do" && Boolean(r.due_at) && new Date(r.due_at as string).getTime() < Date.now(),
  };
}

export function toIpdHandoverDTO(r: IpdHandoverRow): IpdHandoverDTO {
  return {
    id: r.id,
    admissionId: r.admission_id,
    shift: r.shift as IpdHandoverDTO["shift"],
    shiftDate: r.shift_date,
    note: r.note,
    author: r.author ?? "",
    createdAt: r.created_at,
  };
}

/** Lines you can tick: a heading with sub-lines counts its sub-lines, not itself. */
function tickKeys(items: IpdChecklistTemplateRow["items"]): string[] {
  return items.flatMap((i) => (i.children?.length ? i.children.map((c) => c.key) : [i.key]));
}

export function toIpdChecklistTemplateDTO(r: IpdChecklistTemplateRow): IpdChecklistTemplateDTO {
  const items = Array.isArray(r.items) ? r.items : [];
  return {
    id: r.id,
    name: r.name,
    scope: r.scope,
    description: r.description ?? "",
    items,
    active: r.active !== false,
    lineCount: tickKeys(items).length,
  };
}

export function toIpdChecklistDTO(r: IpdChecklistRow): IpdChecklistDTO {
  const items = Array.isArray(r.items) ? r.items : [];
  const ticks = r.ticks ?? {};
  const keys = tickKeys(items);
  const done = keys.filter((k) => ticks[k]?.done).length;
  // Counted in lines, like the progress bar: a required heading with three sub-lines owes three.
  const requiredLeft = items
    .filter((i) => i.required)
    .flatMap((i) => (i.children?.length ? i.children.map((c) => c.key) : [i.key]))
    .filter((k) => !ticks[k]?.done).length;
  return {
    id: r.id,
    templateId: r.template_id ?? null,
    name: r.name,
    scope: r.scope,
    admissionId: r.admission_id ?? null,
    patientId: r.patient_id ?? null,
    patientName: r.patient_name,
    patientCode: r.patient_code ?? "",
    items,
    ticks,
    status: r.status as IpdChecklistDTO["status"],
    startedBy: r.started_by ?? "",
    startedAt: r.created_at,
    completedBy: r.completed_by ?? null,
    completedAt: r.completed_at ?? null,
    cancelledReason: r.cancelled_reason ?? null,
    done,
    total: keys.length,
    requiredLeft,
  };
}

/** Dose log and alert acknowledgements are read back as plain rows. */
export const toIpdDoseLogDTO = (r: IpdDoseLogRow) => r;
export const toIpdAlertAckDTO = (r: IpdAlertAckRow) => r;

/** "HH:mm" or "h:mm AM/PM" → minutes after midnight; null when it can't be read. */
function clockMinutes(t: string | undefined): number | null {
  const s = (t ?? "").trim();
  const twelve = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(s);
  if (twelve) {
    let h = Number(twelve[1]) % 12;
    if (twelve[3].toUpperCase() === "PM") h += 12;
    return h * 60 + Number(twelve[2]);
  }
  const day = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s);
  return day ? Number(day[1]) * 60 + Number(day[2]) : null;
}

export function toOtDTO(r: OtScheduleRow): OtRecordDTO {
  const startMinute = clockMinutes(r.scheduled_time);
  const durationMin = Number(r.duration_min) > 0 ? Number(r.duration_min) : 60;
  const actualMin = r.started_at && r.ended_at ? Math.max(1, Math.round((Date.parse(r.ended_at) - Date.parse(r.started_at)) / 60_000)) : null;
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
    // Joined in by the service layer.
    patientCode: null,
    // Surgeries booked before these fields existed read as a plain elective, major, one-hour case.
    bookingNo: r.booking_no || `OT/${(r.scheduled_date || "").slice(0, 4) || new Date().getFullYear()}/${String(r.id).padStart(4, "0")}`,
    caseType: (r.case_type || "Elective") as OtCaseType,
    surgeryName: r.surgery_name || r.procedure,
    category: (r.category || "Major") as OtCategory,
    procedureCode: r.procedure_code ?? "",
    durationMin,
    actualMin,
    roomId: r.room_id ?? null,
    coSurgeonId: r.co_surgeon_id ?? null,
    coSurgeon: r.co_surgeon ?? "",
    anesthetistId: r.anesthetist_id ?? null,
    anaesthesiaType: r.anaesthesia_type ?? "",
    scrubNurseId: r.scrub_nurse_id ?? null,
    scrubNurse: r.scrub_nurse ?? "",
    circulatingNurseId: r.circulating_nurse_id ?? null,
    circulatingNurse: r.circulating_nurse ?? "",
    technicianIds: r.technician_ids ?? [],
    technicians: r.technicians ?? [],
    equipmentIds: r.equipment_ids ?? [],
    equipment: r.equipment ?? [],
    specialRequirements: r.special_requirements ?? "",
    allowOverlap: Boolean(r.allow_overlap),
    fitness: (r.fitness || "Pending") as OtFitness,
    startedAt: r.started_at ?? null,
    endedAt: r.ended_at ?? null,
    startMinute,
    endMinute: startMinute == null ? null : startMinute + durationMin,
  };
}

export function toOtRoomDTO(r: OtRoomRow, bookings = 0): OtRoomDTO {
  return { id: r.id, name: r.name, kind: (r.kind || "Major") as OtCategory, active: r.active !== false, bookings };
}

export function toOtEquipmentDTO(r: OtEquipmentRow): OtEquipmentDTO {
  return { id: r.id, name: r.name, status: (r.status === "Maintenance" ? "Maintenance" : "Available"), note: r.note ?? "" };
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
    // Joined in from the ward by the beds service.
    dailyRate: 0,
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
    employeeNo: r.employee_no || `EMP-${1000 + r.id}`,
    gender: r.gender ?? "",
    dob: r.dob ?? null,
    address: r.address ?? "",
    qualification: r.qualification ?? "",
    licenceNo: r.licence_no ?? "",
    licenceExpiry: r.licence_expiry ?? null,
    emergencyName: r.emergency_name ?? "",
    emergencyPhone: r.emergency_phone ?? "",
  };
}

export function toDepartmentDTO(r: DepartmentRow): DepartmentDTO {
  return {
    id: r.id,
    name: r.name,
    head: r.head,
    ext: r.extension,
    code: r.code ?? "",
    specialty: r.specialty ?? "",
    clinical: r.clinical !== false,
    active: r.active !== false,
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

const addDaysIso = (iso: string, n: number): string => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const daysBetweenIso = (from: string, to: string): number => {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
};
/** Gap between whole blood donations: three months for men, four for women (NBTC). */
export const DONATION_GAP_DAYS = { male: 90, female: 120 } as const;

export function toBloodDonorDTO(r: BloodDonorRow, today: string = isoDate()): BloodDonorDTO {
  const idLast4 = r.id_proof_last4 || (r.aadhaar_number ? String(r.aadhaar_number).slice(-4) : "");
  const idType = r.id_proof_type || (r.aadhaar_number ? "aadhaar" : "");
  const age = r.dob
    ? Math.max(0, Math.floor(daysBetweenIso(String(r.dob), today) / 365.25))
    : Number(r.age ?? 0);
  // A temporary deferral ends by itself on its date; an open-ended one stays until it is lifted.
  const deferred = r.status === "Deferred" && (!r.deferred_until || r.deferred_until >= today);
  const gap = String(r.gender).toLowerCase() === "female" ? DONATION_GAP_DAYS.female : DONATION_GAP_DAYS.male;
  const last = r.last_donation_date && /^\d{4}-\d{2}-\d{2}$/.test(r.last_donation_date) ? r.last_donation_date : null;
  return {
    id: r.id,
    donorNo: r.donor_no || `BD/${String(r.created_at || today).slice(2, 4)}/${String(r.id).padStart(5, "0")}`,
    name: r.name,
    gender: r.gender,
    bloodGroup: r.blood_group as BloodGroup,
    phone: r.phone,
    dob: r.dob ?? null,
    age,
    idProofType: idType,
    idProofLast4: idLast4,
    totalDonations: Number(r.total_donations ?? 0),
    lastDonationDate: r.last_donation_date ?? "",
    status: (deferred ? "Deferred" : "Eligible") as DonorStatus,
    deferralReason: deferred ? (r.deferral_reason ?? "") : "",
    deferredUntil: deferred ? (r.deferred_until ?? null) : null,
    nextEligibleOn: last ? addDaysIso(last, gap) : null,
  };
}

export function toBloodUnitDTO(r: BloodUnitRow, today: string = isoDate()): BloodUnitDTO {
  const sg: Partial<SerologyDTO> = (r.serology ?? {}) as Partial<SerologyDTO>;
  const serology: SerologyDTO = { hiv: sg.hiv ?? "", hbsag: sg.hbsag ?? "", hcv: sg.hcv ?? "", malaria: sg.malaria ?? "", syphilis: sg.syphilis ?? "" };
  const days = daysBetweenIso(today, r.expiry_on);
  return {
    id: r.id,
    unitNo: r.unit_no,
    source: (r.source || "Donation") as BloodUnitDTO["source"],
    donorId: r.donor_id ?? null,
    donorNo: r.donor_no ?? "",
    supplier: r.supplier ?? "",
    bagNo: r.bag_no ?? "",
    bloodGroup: r.blood_group as BloodGroup,
    component: r.component as BloodComponent,
    volumeMl: Number(r.volume_ml),
    collectedOn: r.collected_on,
    expiryOn: r.expiry_on,
    expired: days < 0,
    daysToExpiry: days,
    serology,
    serologyDone: Object.values(serology).every((v) => v === "Negative" || v === "Reactive"),
    status: r.status as BloodUnitStatus,
    rootUnitId: r.root_unit_id ?? null,
    parentUnitId: r.parent_unit_id ?? null,
    discardReason: r.discard_reason ?? "",
  };
}

export function toBloodCrossmatchDTO(r: BloodCrossmatchRow): BloodCrossmatchDTO {
  return {
    id: r.id,
    xmNo: r.xm_no,
    patientId: r.patient_id ?? null,
    patientName: r.patient_name,
    patientCode: r.patient_code ?? "",
    unitId: r.unit_id,
    unitNo: r.unit_no,
    unitGroup: r.unit_group as BloodGroup,
    unitComponent: r.unit_component ?? "",
    requestedAt: r.requested_at,
    requestedBy: r.requested_by ?? "",
    result: (r.result || "pending") as BloodCrossmatchDTO["result"],
    resultBy: r.result_by ?? null,
    resultAt: r.result_at ?? null,
    status: r.status as BloodCrossmatchDTO["status"],
  };
}

export function toBloodTransfusionDTO(r: BloodTransfusionRow): BloodTransfusionDTO {
  return {
    id: r.id,
    issueNo: r.issue_no,
    crossmatchId: r.crossmatch_id,
    patientId: r.patient_id ?? null,
    patientName: r.patient_name,
    patientCode: r.patient_code ?? "",
    unitId: r.unit_id,
    unitNo: r.unit_no,
    unitGroup: r.unit_group as BloodGroup,
    unitComponent: r.unit_component ?? "",
    issuedAt: r.issued_at,
    issuedBy: r.issued_by ?? "",
    transfusedAt: r.transfused_at ?? null,
    transfusedBy: r.transfused_by ?? null,
    disposition: r.disposition ?? "",
    returnedAt: r.returned_at ?? null,
    reactions: (r.reactions ?? []) as BloodReactionDTO[],
  };
}

export function toRadiologyDTO(r: RadiologyTestRow): RadiologyTestDTO {
  return {
    id: r.id,
    orderNumber: r.order_number ?? "",
    hospitalId: r.hospital_id,
    patientId: r.patient_id,
    patientName: r.patient_name,
    patientAge: r.patient_age,
    testName: r.test_name,
    scanStatus: r.scan_status as "Pending" | "Done",
    reportStatus: r.report_status as "Pending" | "Ready",
    date: r.test_date,
    amount: Number(r.amount),
    discount: Number(r.discount ?? 0),
    discountType: (r.discount_type as "percent" | "amount") ?? "amount",
    status: r.status as RadiologyStatus,
    priority: (r.priority as RadiologyPriority) ?? "Routine",
    // Joined in by the service layer, like the names below.
    patientCode: null,
    doctorId: r.doctor_id,
    doctor: r.doctor,
    radiologyCenterId: r.radiology_center_id,
    // Joined in by the service layer (a plain row->DTO mapper has no async
    // lookups); default so every RadiologyTestDTO has the same shape.
    radiologyCenterName: null,
    hospitalName: null,
    // The file body itself is only served via GET /radiology/[id]/report.
    hasReport: Boolean(r.report_file),
    reportFileName: r.report_file_name ?? null,
    reportNote: r.report_note ?? null,
    reportUploadedBy: r.report_uploaded_by ?? null,
    reportUploadedAt: r.report_uploaded_at ?? null,
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
    code: r.code || `AMB-${String(r.id).padStart(2, "0")}`,
    vehicleType: r.vehicle_type ?? "",
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
    callNo: r.call_no ?? "",
    callType: r.call_type || "Emergency pickup",
    patientId: r.patient_id ?? null,
    openedAt: r.created_at,
    dispatchedAt: r.dispatched_at ?? null,
    atSceneAt: r.at_scene_at ?? null,
    closedAt: r.closed_at ?? null,
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

export function toFollowUpDTO(r: FollowUpRow): FollowUpDTO {
  return {
    id: r.id,
    patientId: r.patient_id ?? null,
    patientName: r.patient_name,
    patientCode: r.patient_code ?? "",
    doctorId: r.doctor_id ?? null,
    doctor: r.doctor ?? "",
    reason: r.reason ?? "",
    dueOn: r.due_on,
    status: r.status as FollowUpStatus,
    createdBy: r.created_by ?? "",
    createdByRole: r.created_by_role ?? "",
    resolvedBy: r.resolved_by ?? null,
    resolvedByRole: r.resolved_by_role ?? null,
    resolvedOn: r.resolved_on ?? null,
    reschedules: Number(r.reschedules ?? 0),
    note: r.note ?? "",
    createdAt: r.created_at,
  };
}

export function toEnquiryDTO(r: EnquiryRow): EnquiryDTO {
  return {
    id: r.id,
    name: r.name,
    mobile: r.mobile ?? "",
    department: r.department ?? "",
    interestedIn: r.interested_in ?? "",
    source: r.source ?? "",
    estimatedValue: Number(r.estimated_value ?? 0),
    callBackOn: r.follow_up_on || null,
    notes: r.notes ?? "",
    // "Follow-up" was this status's old name; a row not yet renamed in storage still reads correctly.
    status: (r.status === "Follow-up" ? "Contacted" : r.status) as EnquiryStatus,
    contacts: Number(r.contacts ?? 1),
    convertedPatientId: r.converted_patient_id ?? null,
    history: Array.isArray(r.history) ? r.history : [],
    createdAt: r.created_at,
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

export function toPurchaseOrderItemDTO(r: PurchaseOrderItemRow): PurchaseOrderItemDTO {
  return {
    id: r.id,
    medicineName: r.medicine_name,
    quantity: r.quantity,
    unitCost: Number(r.unit_cost),
  };
}

export function toPurchaseOrderDTO(
  r: PurchaseOrderRow,
  items: PurchaseOrderItemRow[] = [],
): PurchaseOrderDTO {
  return {
    id: r.id,
    poNumber: r.po_number,
    supplier: r.supplier,
    orderDate: r.order_date,
    expectedDate: r.expected_date,
    itemCount: r.item_count,
    total: Number(r.total),
    status: r.status,
    notes: r.notes,
    items: items.map(toPurchaseOrderItemDTO),
  };
}

export function toPharmacySaleItemDTO(r: PharmacySaleItemRow): PharmacySaleItemDTO {
  return {
    id: r.id,
    medicineName: r.medicine_name,
    quantity: r.quantity,
    unitPrice: Number(r.unit_price),
    lineTotal: Number(r.line_total),
  };
}

export function toPharmacySaleDTO(
  r: PharmacySaleRow,
  items: PharmacySaleItemRow[] = [],
): PharmacySaleDTO {
  return {
    id: r.id,
    saleNumber: r.sale_number,
    patientId: r.patient_id,
    patientName: r.patient_name,
    rxNumber: r.rx_number,
    itemCount: r.item_count,
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    total: Number(r.total),
    paymentMode: r.payment_mode,
    date: r.sale_date,
    billId: r.bill_id,
    items: items.map(toPharmacySaleItemDTO),
  };
}

export function toStaffAttendanceDTO(r: StaffAttendanceRow): StaffAttendanceDTO {
  return {
    id: r.id,
    staffId: r.staff_id,
    staffName: r.staff_name,
    date: r.work_date,
    punchIn: r.punch_in,
    punchOut: r.punch_out,
    minutes: r.minutes,
    status: r.status,
    note: r.note,
    method: r.method ?? "manual",
    inDistanceM: r.in_distance_m ?? null,
    outDistanceM: r.out_distance_m ?? null,
  };
}

export function toIpdNoteDTO(r: IpdNoteRow): IpdNoteDTO {
  return {
    id: r.id,
    admissionId: r.admission_id,
    noteType: r.note_type,
    date: r.note_date,
    time: r.note_time,
    author: r.author,
    content: r.content,
  };
}

export function toIpdMedicationDTO(r: IpdMedicationRow): IpdMedicationDTO {
  return {
    id: r.id,
    admissionId: r.admission_id,
    medicineName: r.medicine_name,
    dosage: r.dosage,
    frequency: r.frequency,
    route: r.route,
    startDate: r.start_date,
    endDate: r.end_date,
    status: r.status,
    lastGivenAt: r.last_given_at,
    notes: r.notes,
  };
}

export function toDocumentDTO(r: DocumentRow): DocumentDTO {
  return {
    id: r.id,
    ownerType: r.owner_type,
    ownerId: r.owner_id,
    category: r.category,
    title: r.title || r.file_name,
    folderId: r.folder_id ?? null,
    folderName: "",
    referenceNo: r.reference_no ?? "",
    fileName: r.file_name,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
    url: `/api/documents/${r.id}/download`,
  };
}

export function toTaskDTO(r: TaskRow): TaskDTO {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    goal: r.goal,
    assigneeId: r.assignee_id,
    assigneeName: r.assignee_name,
    assignedBy: r.assigned_by,
    priority: r.priority as TaskPriority,
    status: r.status as TaskStatus,
    dueDate: r.due_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function toChatThreadDTO(r: ChatThreadRow): ChatThreadDTO {
  return {
    id: r.id,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function toChatMessageDTO(r: ChatMessageRow): ChatMessageDTO {
  return {
    id: r.id,
    threadId: r.thread_id,
    role: r.role as "user" | "assistant",
    content: r.content,
    sources: r.sources,
    patientId: r.patient_id ?? null,
    createdAt: r.created_at,
  };
}

export function toScribeNoteDTO(r: ScribeNoteRow): ScribeNoteDTO {
  return {
    id: r.id,
    appointmentId: r.appointment_id,
    patientId: r.patient_id,
    patientName: r.patient_name,
    doctorId: r.doctor_id,
    doctorName: r.doctor_name,
    transcript: r.transcript,
    brief: r.brief,
    language: r.language,
    durationSec: r.duration_sec,
    status: r.status as ScribeStatus,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
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
    staffId: r.staff_id ?? null,
    doctorId: r.doctor_id ?? null,
    status: r.status,
    lastLogin: r.last_login_at ?? "Never",
  };
}

// ── MRD ──────────────────────────────────────────────────────────────────────

export function toMrdLocationDTO(r: MrdLocationRow, fileCount = 0): MrdLocationDTO {
  return { id: r.id, name: r.name, kind: r.kind as MrdLocationDTO["kind"], code: r.code ?? "", active: r.active !== false, fileCount };
}

export function toMrdFileDTO(r: MrdFileRow, today: string = isoDate()): MrdFileDTO {
  const out = r.status === "Checked out" || r.status === "In transit";
  return {
    id: r.id,
    fileNo: r.file_no,
    patientId: r.patient_id,
    patientName: r.patient_name,
    patientCode: r.patient_code ?? "",
    fileType: r.file_type as MrdFileDTO["fileType"],
    status: r.status as MrdFileDTO["status"],
    locationId: r.location_id ?? null,
    locationName: r.location_name ?? "",
    homeLocationId: r.home_location_id ?? null,
    holderName: r.holder_name ?? null,
    dueOn: r.due_on ?? null,
    overdue: out && !!r.due_on && r.due_on < today,
    updatedAt: r.updated_at,
  };
}

export function toMrdFileMovementDTO(r: MrdFileMovementRow): MrdFileMovementDTO {
  return {
    id: r.id,
    fileId: r.file_id,
    fileNo: r.file_no,
    action: r.action as MrdFileMovementDTO["action"],
    fromLocation: r.from_location ?? "",
    toLocation: r.to_location ?? "",
    holderName: r.holder_name ?? null,
    dueOn: r.due_on ?? null,
    note: r.note ?? "",
    byName: r.by_name ?? "",
    at: r.at,
  };
}

export function toMrdFileRequestDTO(r: MrdFileRequestRow): MrdFileRequestDTO {
  return {
    id: r.id,
    fileId: r.file_id,
    fileNo: r.file_no,
    patientId: r.patient_id,
    patientName: r.patient_name,
    urgency: r.urgency as MrdFileRequestDTO["urgency"],
    status: r.status as MrdFileRequestDTO["status"],
    requestedOn: r.requested_on,
    requestedBy: r.requested_by ?? "",
    requestedFor: r.requested_for ?? "",
    destinationId: r.destination_id ?? null,
    destinationName: r.destination_name ?? "",
    note: r.note ?? "",
    dispatchedAt: r.dispatched_at ?? null,
    returnedAt: r.returned_at ?? null,
  };
}

export function toMrdRetentionPolicyDTO(r: MrdRetentionPolicyRow): MrdRetentionPolicyDTO {
  return {
    id: r.id,
    name: r.name,
    class: r.class as MrdRetentionPolicyDTO["class"],
    retentionYears: Number(r.retention_years),
    categories: r.categories ?? [],
    actionAfter: (r.action_after as MrdRetentionPolicyDTO["actionAfter"]) || "Review",
    active: r.active !== false,
  };
}

export function toMrdFolderDTO(r: MrdFolderRow, documentCount = 0): MrdFolderDTO {
  return { id: r.id, name: r.name, class: r.class as MrdFolderDTO["class"], description: r.description ?? "", documentCount };
}

export function toMrdCodingCaseDTO(r: MrdCodingCaseRow, openDeficiencies = 0): MrdCodingCaseDTO {
  return {
    id: r.id,
    admissionId: r.admission_id,
    admissionNo: r.admission_no,
    patientId: r.patient_id ?? null,
    patientName: r.patient_name,
    patientCode: r.patient_code ?? "",
    doctor: r.doctor ?? "",
    admittedOn: r.admitted_on,
    status: r.status as MrdCodingCaseDTO["status"],
    principalDxCode: r.principal_dx_code ?? "",
    principalDxText: r.principal_dx_text ?? "",
    secondaryDx: r.secondary_dx ?? [],
    procedures: r.procedures ?? [],
    coderName: r.coder_name ?? null,
    codedAt: r.coded_at ?? null,
    signedOffBy: r.signed_off_by ?? null,
    signedOffAt: r.signed_off_at ?? null,
    queuedAt: r.queued_at,
    openDeficiencies,
  };
}

export function toMrdDeficiencyDTO(r: MrdDeficiencyRow): MrdDeficiencyDTO {
  return {
    id: r.id,
    caseId: r.case_id,
    kind: r.kind,
    note: r.note ?? "",
    status: r.status as MrdDeficiencyDTO["status"],
    raisedBy: r.raised_by ?? "",
    raisedAt: r.raised_at,
    resolvedBy: r.resolved_by ?? null,
    resolvedAt: r.resolved_at ?? null,
  };
}

export function toMrdRegisterEntryDTO(r: MrdRegisterEntryRow): MrdRegisterEntryDTO {
  return {
    id: r.id,
    register: r.register as MrdRegisterEntryDTO["register"],
    entryNo: r.entry_no,
    entryDate: r.entry_date,
    data: r.data ?? {},
    reportTo: r.report_to ?? "",
    filedBy: r.filed_by ?? "",
    filedAt: r.filed_at,
    amendsId: r.amends_id ?? null,
    supersededBy: r.superseded_by ?? null,
  };
}

/** A Waiting link past its expiry reads as Expired; the stored status only changes when someone acts on it. */
export function signatureStatusOf(r: Pick<SignatureRequestRow, "status" | "expires_at">, now: number = Date.now()): ConsentDTO["status"] {
  if (r.status === "Waiting" && r.expires_at && new Date(r.expires_at).getTime() < now) return "Expired";
  return r.status as ConsentDTO["status"];
}

function stageOf(r: SignatureRequestRow, status: ConsentDTO["status"]): ConsentDTO["stage"] {
  switch (status) {
    case "Signed": return r.signed_via === "paper" ? "Signed on paper" : "Signed on phone";
    case "Refused": return "Declined";
    case "Cancelled": return "Link cancelled";
    case "Expired": return "Link expired";
    case "Waiting": return r.opened_at ? "Opened on phone" : "Sent to phone";
    default: return "Not signed yet";
  }
}

export function toConsentDTO(r: SignatureRequestRow): ConsentDTO {
  const status = signatureStatusOf(r);
  return {
    id: r.id,
    patientId: r.patient_id ?? null,
    patientName: r.patient_name,
    patientCode: r.patient_code ?? "",
    templateKey: r.template_key ?? "",
    formTitle: r.form_title,
    formBody: r.form_body,
    language: r.language,
    includeEnglish: !!r.include_english,
    status,
    stage: stageOf(r, status),
    madeBy: r.sent_by ?? "",
    madeAt: r.sent_at,
    signerName: r.signer_name ?? null,
    signerRelation: r.signer_relation ?? null,
    delivery: (r.delivery as ConsentDTO["delivery"]) ?? null,
    linkSentAt: r.link_sent_at ?? null,
    expiresAt: r.expires_at ?? null,
    openedAt: r.opened_at ?? null,
    signedAt: r.signed_at ?? null,
    signedVia: (r.signed_via as ConsentDTO["signedVia"]) ?? null,
    witnessName: r.witness_name ?? null,
    refusedReason: r.refused_reason ?? null,
    signedDocumentId: r.signed_document_id ?? null,
    link: status === "Waiting" && r.token ? `/sign/${r.token}` : null,
  };
}
