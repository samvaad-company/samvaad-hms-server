"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { formatDate, inDateRange, type DateRangeId } from "@/lib/dates";
import { FlaskConical, Plus, Upload, Eye, FileText, Loader2, Download, ScanLine, Copy, Check, Building2 } from "lucide-react";
import { useList, useMutation, useItem } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { uploadReportFile, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { canUploadReports } from "@/lib/report-upload-roles";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu } from "@/components/shared/RowMenu";
import type {
  LabTestDTO,
  LabReportFileDTO,
  LabPatientDetailDTO,
  PatientDTO,
  LabLinkDTO,
  LabCenterDTO,
  DoctorDTO,
} from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PRIORITIES } from "@/components/shared/PriorityBadge";
import { LabWorklist } from "@/components/lab/LabWorklist";
import type { TestPriority } from "@/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { usePagination } from "@/components/shared/Pagination";
import { TabBar } from "@/components/shared/TabBar";
import { Modal } from "@/components/shared/Modal";
import { PatientPicker } from "@/components/shared/PatientPicker";
import { FormRow, FormInput, FormSelect, FormTextarea } from "@/components/shared/FormRow";
import { SampleBarcodeModal } from "@/components/shared/SampleBarcodeModal";

// ─── Report viewer ────────────────────────────────────────────────────────────

/** In-app viewer for uploaded reports — avoids popup blockers entirely. */
function ReportViewerModal({
  test,
  onClose,
}: {
  test: LabTestDTO;
  onClose: () => void;
}) {
  const [file, setFile] = useState<LabReportFileDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<LabReportFileDTO>(`/lab/${test.id}/report`)
      .then(setFile)
      .catch((e: Error) => setError(e.message));
  }, [test.id]);

  const isPdf = file?.fileName.toLowerCase().endsWith(".pdf");

  return (
    <Modal
      open
      onClose={onClose}
      title={`Report — ${test.testName}`}
      width={760}
      footer={
        <>
          {file && (
            <a
              href={file.fileUrl}
              download={file.fileName}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-[13px] font-normal text-[color:var(--brand)] border border-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-soft)] transition-colors"
            >
              <Download size={14} /> Download
            </a>
          )}
          <button onClick={onClose} className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Close</button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13px] font-light text-[color:var(--ink-soft)]">
          {test.patientName} · {test.patientAge} yrs
          {file?.uploadedBy && <> · Uploaded by <span className="font-normal text-[color:var(--ink)]">{file.uploadedBy}</span></>}
          {file?.uploadedAt && <> · {file.uploadedAt}</>}
        </p>
        {file?.note && (
          <div className="text-[13px] font-normal text-[color:var(--ink)] bg-[color:var(--subtle)] rounded-[8px] px-3 py-2">
            {file.note}
          </div>
        )}
        {error && (
          <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error}</div>
        )}
        {!file && !error && (
          <div className="flex items-center justify-center py-16 text-[color:var(--ink-soft)]">
            <Loader2 size={20} className="animate-spin" />
          </div>
        )}
        {file && (
          isPdf ? (
            <iframe src={file.fileUrl} title="Report document" className="w-full rounded-[8px] border border-[color:var(--line)]" style={{ height: 480 }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={file.fileUrl} alt="Report document" className="w-full rounded-[8px] border border-[color:var(--line)] object-contain" style={{ maxHeight: 480 }} />
          )
        )}
      </div>
    </Modal>
  );
}

/**
 * The test's price is the routed-to center's call, not this hospital's — so
 * there's nothing fixed to show. Only the discount the referring doctor
 * granted is worth surfacing, as "10% off" or "₹200 off".
 */
function discountLabel(t: LabTestDTO): string | null {
  if (!t.discount) return null;
  return t.discountType === "percent" ? `${t.discount}% off` : `₹${t.discount.toLocaleString("en-IN")} off`;
}

// ─── Patient detail modal ──────────────────────────────────────────────────────

/** Labeled read-only field for the patient detail grid — skips rendering when there's nothing to show. */
function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-[2px]">
      <span className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">{label}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink)]">{value}</span>
    </div>
  );
}

/**
 * Full patient demographics plus every other test on record for them — a
 * lab-center account has no `patients` access of its own, so this is the
 * only place it can see who it's actually testing beyond a bare name.
 */
function PatientDetailModal({
  test,
  allTests,
  canWrite,
  canUpload,
  canDelete,
  onClose,
  onUpload,
  onViewReport,
  onCollectSample,
  onCancelTest,
  onDelete,
  onPrintBarcode,
}: {
  test: LabTestDTO;
  /** Every test for this same patient at this same hospital, newest first. */
  allTests: LabTestDTO[];
  canWrite: boolean;
  /** Narrower than canWrite — only lab/radiology report handlers may upload. */
  canUpload: boolean;
  canDelete: boolean;
  onClose: () => void;
  onUpload: (t: LabTestDTO) => void;
  onViewReport: (t: LabTestDTO) => void;
  onCollectSample: (t: LabTestDTO) => void;
  onCancelTest: (t: LabTestDTO) => void;
  onDelete: (t: LabTestDTO) => void;
  onPrintBarcode: (t: LabTestDTO) => void;
}) {
  const [detail, setDetail] = useState<LabPatientDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<LabPatientDetailDTO>(`/lab/${test.id}/patient`)
      .then(setDetail)
      .catch((e: Error) => setError(e.message));
  }, [test.id]);

  const address = detail && [detail.address, detail.city, detail.state, detail.pincode].filter(Boolean).join(", ");
  // Latest visit first — a repeat test on a later date is its own record, not
  // an overwrite of the earlier one, so history reads newest-to-oldest.
  const history = [...allTests].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  return (
    <Modal open onClose={onClose} title={`Patient — ${test.patientName}`} width={640}
      footer={<button onClick={onClose} className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Close</button>}
    >
      <div className="flex flex-col gap-5">
        {error && <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error}</div>}
        {!detail && !error && (
          <div className="flex items-center justify-center py-10 text-[color:var(--ink-soft)]"><Loader2 size={20} className="animate-spin" /></div>
        )}
        {detail && (
          <div className="grid grid-cols-3 gap-4">
            <DetailField label="Patient ID" value={detail.patientCode} />
            <DetailField label="Age" value={String(detail.age)} />
            <DetailField label="Gender" value={detail.gender} />
            <DetailField label="Phone" value={detail.phone} />
            <DetailField label="Email" value={detail.email} />
            <DetailField label="Blood Group" value={detail.bloodGroup} />
            <DetailField label="Date of Birth" value={detail.dob} />
            <div className="col-span-2"><DetailField label="Address" value={address || null} /></div>
            <div className="col-span-3"><DetailField label="Allergies" value={detail.allergies} /></div>
            <div className="col-span-3"><DetailField label="Chronic Conditions" value={detail.chronicConditions} /></div>
          </div>
        )}

        <div className="border-t border-[color:var(--subtle-2)] pt-4">
          <p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-2">
            All Tests ({history.length}) — latest first
          </p>
          <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto">
            {history.map(t => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 border border-[color:var(--line)] rounded-[8px]">
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-normal text-[color:var(--ink)] truncate">{t.testName}</span>
                  <span className="text-[11px] font-light text-[color:var(--ink-soft)]">{formatDate(t.date)}{t.doctor && <> · {t.doctor}</>}{discountLabel(t) && <> · {discountLabel(t)}</>}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={t.status} />
                  {t.hasReport ? (
                    <button onClick={() => onViewReport(t)} className="flex items-center gap-1 text-[12px] font-normal text-[color:var(--brand)] border border-[color:var(--brand)] px-3 py-[5px] rounded-full hover:bg-[color:var(--brand-soft)] transition-colors whitespace-nowrap">
                      <Eye size={12} /> Report
                    </button>
                  ) : canUpload ? (
                    <button onClick={() => onUpload(t)} className="flex items-center gap-1 text-[12px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-3 py-[5px] rounded-full hover:bg-[color:var(--subtle)] transition-colors whitespace-nowrap">
                      <Upload size={12} /> Upload
                    </button>
                  ) : null}
                  <button onClick={() => onPrintBarcode(t)} className="flex items-center gap-1 text-[12px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-3 py-[5px] rounded-full hover:bg-[color:var(--subtle)] transition-colors whitespace-nowrap">
                    <ScanLine size={12} /> Barcode
                  </button>
                  {canWrite && (
                    <RowMenu actions={[
                      { label: "Collect sample", disabled: t.sampleStatus === "Collected", onClick: () => onCollectSample(t) },
                      { label: "Cancel test", disabled: t.status === "Cancelled", onClick: () => onCancelTest(t) },
                      ...(canDelete ? [{ label: "Delete", danger: true, onClick: () => onDelete(t) }] : []),
                    ]} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

/** Keeps a file name safe as a Firebase Storage path segment. */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function UploadReportModal({
  test,
  onClose,
  onUploaded,
}: {
  test: LabTestDTO;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { run, loading, error } = useMutation();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "storage" | "saving">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload() {
    if (!file) return;
    setUploadError(null);

    if (!isFirebaseClientConfigured()) {
      setUploadError("Firebase Storage isn't configured yet — ask your admin to add the Firebase config.");
      return;
    }

    // Path-scoped by patient ID so reports are easy to find/audit in the
    // Firebase console: reports/lab/{patientId}/{testId}-{fileName}.
    const path = `reports/lab/${test.patientId}/${test.id}-${sanitizeFileName(file.name)}`;
    setStage("storage");
    const fileUrl = await uploadReportFile(path, file).catch((e: Error) => {
      setUploadError(e.message || "Upload to Firebase Storage failed");
      return null;
    });
    setStage("idle");
    if (!fileUrl) return;

    setStage("saving");
    try {
      await run(() =>
        api.post(`/lab/${test.id}/report`, {
          fileName: file.name,
          fileUrl,
          note,
        }),
      );
    } catch {
      setStage("idle");
      return;
    }
    setStage("idle");
    onUploaded();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Upload Report — ${test.testName}`}
      width={520}
      footer={
        <>
          <button onClick={onClose} className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
          <button
            onClick={upload}
            disabled={stage !== "idle" || loading || !file}
            className="flex items-center gap-2 text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50"
          >
            {stage !== "idle" || loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {stage === "storage" ? "Uploading…" : stage === "saving" ? "Saving…" : "Upload Report"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] font-light text-[color:var(--ink-soft)]">
          {test.patientName} · {test.patientAge} yrs · Ordered {formatDate(test.date)}
        </p>

        <FormRow label="Report file * (PDF, PNG, JPEG — max 5 MB)">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`w-full flex items-center justify-center gap-2 border-2 border-dashed rounded-[10px] py-6 text-[13px] font-normal transition-colors ${
              file
                ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--brand)]"
                : "border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]"
            }`}
          >
            <FileText size={16} />
            {file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : "Click to choose a file"}
          </button>
        </FormRow>

        <FormRow label="Findings / Note (optional)">
          <FormTextarea placeholder="Key findings, impression, or remarks for the treating doctor…" rows={3} value={note} onChange={setNote} />
        </FormRow>

        {(error || uploadError) && (
          <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">
            {uploadError ?? error?.message}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Tests Tab ────────────────────────────────────────────────────────────────

const FILTERS = [
  { id: "All", label: "All" }, { id: "Pending", label: "Pending" },
  { id: "SampleCollected", label: "Sample Collected" }, { id: "ReportReady", label: "Report Ready" },
];
const MIN_WIDTH = 1080;

/**
 * One patient booked for tests several times (or ordered several tests in
 * one visit) used to read as several unrelated rows in the worklist. Group
 * by the same (hospital, patient) pair so each patient appears once, with
 * every test they've been booked for reachable from that one row.
 */
function groupByPatient(list: LabTestDTO[]): LabTestDTO[][] {
  const order: string[] = [];
  const groups = new Map<string, LabTestDTO[]>();
  for (const t of list) {
    const key = `${t.hospitalId}:${t.patientId ?? t.patientName}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(t);
  }
  return order.map((k) => groups.get(k)!);
}

function patientColumns(showHospital: boolean) {
  return [
    ...(showHospital ? [{ label: "Hospital", width: "minmax(140px,1.2fr)" }] : []),
    { label: "Patient",   width: "minmax(140px,1.3fr)" },
    { label: "Age",       width: "60px" },
    { label: "Tests",     width: "minmax(200px,2fr)" },
    { label: "Doctor",    width: "minmax(120px,1fr)" },
    { label: "Latest Date", width: "110px" },
    { label: "Discount",  width: "110px" },
    { label: "Action",    width: "80px", align: "right" as const },
  ];
}

const STATUS_DOT: Record<string, string> = {
  "Pending": "bg-[#ff9000]",
  "Sample Collected": "bg-[color:var(--brand)]",
  "Report Ready": "bg-[#00955c]",
  "Cancelled": "bg-[#ff0004]",
};

/** Compact "3 Pending · 1 Report Ready" summary of every test's status in the group. */
function StatusSummary({ tests }: { tests: LabTestDTO[] }) {
  const counts = new Map<string, number>();
  for (const t of tests) counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {[...counts.entries()].map(([status, count]) => (
        <span key={status} className="inline-flex items-center gap-1 text-[11px] font-normal text-[color:var(--ink-soft)] whitespace-nowrap">
          <span className={`w-[6px] h-[6px] rounded-full ${STATUS_DOT[status] ?? "bg-[#57575f]"}`} />
          {count} {status}
        </span>
      ))}
    </div>
  );
}

function PatientGroupRow({
  tests,
  showHospital,
  onViewPatient,
}: {
  tests: LabTestDTO[];
  showHospital: boolean;
  onViewPatient: () => void;
}) {
  const anchor = tests[0];
  const doctors = [...new Set(tests.map(t => t.doctor).filter(Boolean))];
  const latestDate = tests.reduce((max, t) => (t.date > max ? t.date : max), tests[0].date);
  const discountedCount = tests.filter(t => t.discount > 0).length;
  // Newest visit's tests read first, matching the patient detail modal.
  const byRecency = [...tests].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  return (
    <div className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      {showHospital && <span className="text-[13px] font-normal text-[color:var(--ink)] truncate">{anchor.hospitalName ?? "—"}</span>}
      <span className="text-[13px] font-medium text-[color:var(--ink)] truncate">{anchor.patientName}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink-soft)]">{anchor.patientAge}</span>
      <div className="flex flex-col gap-[2px] min-w-0">
        <span className="text-[13px] font-normal text-[color:var(--ink)] truncate">
          {tests.length} {tests.length === 1 ? "test" : "tests"} — {byRecency.map(t => t.testName).join(", ")}
        </span>
        <StatusSummary tests={tests} />
      </div>
      <span className="text-[13px] font-normal text-[color:var(--ink-soft)] truncate">{doctors.join(", ") || "—"}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink)] whitespace-nowrap">{formatDate(latestDate)}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink-soft)] whitespace-nowrap">
        {discountedCount > 0 ? `${discountedCount} of ${tests.length} discounted` : "—"}
      </span>
      <div className="flex justify-end">
        <button
          onClick={onViewPatient}
          className="text-[12px] font-normal text-[color:var(--brand)] border border-[color:var(--brand)] px-3 py-[5px] rounded-full hover:bg-[color:var(--brand-soft)] transition-colors whitespace-nowrap"
        >
          View
        </button>
      </div>
    </div>
  );
}

// ─── Booking Tab ─────────────────────────────────────────────────────────────

// No price here — a test's cost is set by whoever performs it (in-house or
// the linked center it's routed to), not decided by this system.
const COMMON_TESTS = [
  { name: "Complete Blood Count (CBC)", category: "Haematology" },
  { name: "Lipid Profile", category: "Biochemistry" },
  { name: "HbA1c", category: "Biochemistry" },
  { name: "Fasting Blood Sugar", category: "Biochemistry" },
  { name: "Thyroid Profile (T3/T4/TSH)", category: "Biochemistry" },
  { name: "Liver Function Test (LFT)", category: "Biochemistry" },
  { name: "Kidney Function Test (KFT)", category: "Biochemistry" },
  { name: "Urine Routine", category: "Urology" },
  { name: "Stool Routine", category: "Pathology" },
  { name: "ECG", category: "Cardiology" },
  { name: "Echocardiography", category: "Cardiology" },
  { name: "IgE Allergy Panel", category: "Immunology" },
];

const DISCOUNT_TYPE_OPTS = [
  { value: "amount",  label: "₹" },
  { value: "percent", label: "%" },
];

/** Discount value + percent/₹ type, side by side — shared shape with the radiology booking form. */
function DiscountInput({
  value,
  onChange,
  type,
  onTypeChange,
}: {
  value: string;
  onChange: (v: string) => void;
  type: string;
  onTypeChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <input
        type="number"
        min={0}
        placeholder="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-[42px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-[14px] text-[14px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors"
      />
      <div className="w-[70px] shrink-0">
        <FormSelect value={type} onChange={onTypeChange} options={DISCOUNT_TYPE_OPTS} />
      </div>
    </div>
  );
}

function BookingView({
  patients,
  onBooked,
  initialPatientId,
  initialDoctorId,
  initialLabCenterId,
  initialPriority,
}: {
  patients: PatientDTO[];
  onBooked: () => void;
  /** Hand-off from OPD/Appointments — pre-selects the patient (and referring doctor) so the doctor doesn't re-pick them. */
  initialPatientId?: string;
  initialDoctorId?: string;
  /** Destination chosen on the OPD/Appointments hand-off — defaults to In-house when absent. */
  initialLabCenterId?: string;
  /** Priority carried over from the hand-off, if any. */
  initialPriority?: TestPriority;
}) {
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [patientId, setPatientId] = useState(initialPatientId ?? "");
  const [doctorId, setDoctorId] = useState(initialDoctorId ?? "");
  const [labCenterId, setLabCenterId] = useState(initialLabCenterId ?? "");
  const [requestedBy, setRequestedBy] = useState("");
  // Set by the ordering doctor; applies to every test in this order.
  const [priority, setPriority] = useState<TestPriority>(initialPriority ?? "Routine");
  const [collectionDate, setCollectionDate] = useState("");
  const [discount, setDiscount] = useState("");
  const [discountType, setDiscountType] = useState("amount");
  const { run, loading, error } = useMutation();
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  const { items: centers } = useList<{ id: number; name: string }>("/lab/routable-centers");

  const filtered = COMMON_TESTS.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );

  async function bookTests() {
    if (!patientId || selectedTests.length === 0) return;
    const patient = patients.find(p => String(p.id) === patientId);
    // One order for the whole booking, so several tests don't read as
    // several separate patient entries.
    await run(() =>
      api.post("/lab/orders", {
        patientId: Number(patientId),
        patientName: patient?.name ?? "",
        patientAge: patient?.age ?? 0,
        doctorId: doctorId ? Number(doctorId) : undefined,
        labCenterId: labCenterId ? Number(labCenterId) : undefined,
        requestedBy,
        priority,
        collectionDate,
        discount: Number(discount) || 0,
        discountType,
        tests: selectedTests.map(name => ({ testName: name })),
      }),
    );
    setSelectedTests([]); setPatientId(""); setRequestedBy("");
    setPriority("Routine"); setCollectionDate(""); setDiscount(""); setDiscountType("amount");
    onBooked();
  }

  return (
    <div className="p-5 flex flex-col gap-4" style={{ height: 580 }}>
      <div className="grid grid-cols-3 gap-4">
        <FormRow label="Patient *">
          <PatientPicker patients={patients} value={patientId} onChange={(id) => setPatientId(id)} />
        </FormRow>
        <FormRow label="Referring Doctor">
          <FormSelect placeholder="Select doctor" value={doctorId} onChange={setDoctorId}
            options={doctors.map(d => ({ value: String(d.id), label: d.name }))} />
        </FormRow>
        <FormRow label="Send To">
          <FormSelect placeholder="In-house" value={labCenterId} onChange={setLabCenterId}
            options={[
              { value: "", label: "In-house" },
              ...centers.map(c => ({ value: String(c.id), label: c.name })),
            ]} />
        </FormRow>
        <FormRow label="Requested By / Notes">
          <FormInput placeholder="OPD reference or referring notes" value={requestedBy} onChange={setRequestedBy} />
        </FormRow>
        <FormRow label="Sample Collection Date">
          <input
            type="date"
            value={collectionDate}
            onChange={(e) => setCollectionDate(e.target.value)}
            className="h-[42px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-[14px] text-[14px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors"
          />
        </FormRow>
        <FormRow label="Priority">
          <div className="flex gap-2" role="radiogroup" aria-label="Order priority">
            {PRIORITIES.map(p => (
              <button key={p} type="button" role="radio" aria-checked={priority === p} onClick={() => setPriority(p)}
                className={`h-[42px] flex-1 rounded-[8px] border text-[13px] font-normal cursor-pointer transition-colors ${
                  priority === p
                    ? p === "STAT" ? "bg-[#ffe9b8] border-[#f3cf7d] text-[#8a5300] font-semibold" : "bg-[color:var(--brand)] border-[color:var(--brand)] text-white"
                    : "bg-[color:var(--surface)] border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"
                }`}>
                {p}
              </button>
            ))}
          </div>
        </FormRow>
        <FormRow label="Discount">
          <DiscountInput value={discount} onChange={setDiscount} type={discountType} onTypeChange={setDiscountType} />
        </FormRow>
      </div>

      <FormRow label="Add Tests">
        <div className="relative">
          <FlaskConical size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
          <input
            placeholder="Search tests by name or category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-[42px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] pl-[36px] pr-[14px] text-[14px] font-normal text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] placeholder:opacity-60 focus:outline-none focus:border-[color:var(--brand)] transition-colors"
          />
        </div>
      </FormRow>

      <div className="flex flex-col gap-2 overflow-y-auto flex-1">
        {filtered.map(t => (
          <label key={t.name} className="flex items-center gap-3 p-3 border border-[color:var(--line)] rounded-[8px] cursor-pointer hover:bg-[color:var(--subtle)] transition-colors">
            <input
              type="checkbox"
              checked={selectedTests.includes(t.name)}
              onChange={e => setSelectedTests(prev => e.target.checked ? [...prev, t.name] : prev.filter(x => x !== t.name))}
              className="w-4 h-4 accent-[color:var(--brand)]"
            />
            <div>
              <span className="text-[14px] font-normal text-[color:var(--ink)]">{t.name}</span>
              <span className="text-[11px] font-light text-[color:var(--ink-soft)] ml-2">{t.category}</span>
            </div>
          </label>
        ))}
      </div>

      {/* Footer: selection count + submit */}
      <div className="flex items-center justify-between border-t border-[color:var(--line)] pt-4 shrink-0">
        <span className="text-[13px] font-normal text-[color:var(--ink-soft)]">
          {selectedTests.length > 0
            ? `${selectedTests.length} test${selectedTests.length > 1 ? "s" : ""} selected`
            : "No tests selected"}
        </span>
        <div className="flex items-center gap-3">
          {error && <span className="text-[12px] text-[#ff0004]">{error.message}</span>}
          <button onClick={bookTests} disabled={loading || selectedTests.length === 0 || !patientId}
            className={`text-[14px] font-normal px-6 py-[10px] rounded-full transition-colors ${selectedTests.length > 0 && patientId ? "bg-[color:var(--brand)] text-white hover:bg-[color:var(--brand-hover)]" : "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)] cursor-not-allowed"}`}>
            {loading ? "Booking…" : "Book Tests"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsView({
  tests,
  onUpload,
  onView,
  canUpload,
}: {
  tests: LabTestDTO[];
  onUpload: (test: LabTestDTO) => void;
  onView: (test: LabTestDTO) => void;
  /** Narrower than lab "write" — only lab/radiology report handlers may upload. */
  canUpload: boolean;
}) {
  if (tests.length === 0) {
    return (
      <div className="p-10 text-center text-[14px] text-[color:var(--ink-soft)]">No tests yet.</div>
    );
  }
  return (
    <div className="p-5 grid grid-cols-2 gap-4 overflow-y-auto" style={{ minHeight: 300 }}>
      {tests.map(test => (
        <div key={test.id} className="border border-[color:var(--line)] rounded-[10px] p-4 flex items-start justify-between gap-4 bg-[color:var(--surface)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow">
          <div className="flex flex-col gap-[6px] min-w-0">
            <span className="text-[14px] font-medium text-[color:var(--ink)] truncate">{test.testName}</span>
            <span className="text-[12px] font-light text-[color:var(--ink-soft)]">
              {test.patientName} · {test.patientAge} yrs · {formatDate(test.date)}
              {test.doctor && <> · {test.doctor}</>}
              {test.hospitalName && <> · {test.hospitalName}</>}
            </span>
            <div className="flex items-center gap-2">
              <StatusBadge status={test.status} />
              {test.hasReport && (
                <span className="text-[11px] font-normal text-[#00955c] truncate">
                  {test.reportFileName} · by {test.reportUploadedBy}
                </span>
              )}
            </div>
            {test.reportNote && (
              <p className="text-[12px] font-light text-[color:var(--ink-soft)] line-clamp-2">“{test.reportNote}”</p>
            )}
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {test.hasReport ? (
              <button onClick={() => onView(test)} className="flex items-center gap-[6px] text-[12px] font-normal text-[color:var(--brand)] border border-[color:var(--brand)] px-3 py-[5px] rounded-full hover:bg-[color:var(--brand-soft)] transition-colors whitespace-nowrap">
                <Eye size={13} /> View
              </button>
            ) : canUpload ? (
              <button onClick={() => onUpload(test)} className="flex items-center gap-[6px] text-[12px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-3 py-[5px] rounded-full hover:bg-[color:var(--subtle)] transition-colors whitespace-nowrap">
                <Upload size={13} /> Upload
              </button>
            ) : (
              <span className="text-[12px] font-light text-[#c8c8cc] whitespace-nowrap">No report yet</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── About Tab (lab center accounts only) ──────────────────────────────────

/**
 * A center's own profile — most importantly its code, the one thing a
 * hospital admin needs from them to send a link request. There was
 * previously no page a center could see that on at all.
 */
function CenterAboutView() {
  const { item: center, loading, reload } = useItem<LabCenterDTO>("/lab-centers/me");
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    if (!center) return;
    await navigator.clipboard.writeText(center.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading || !center) {
    return <div className="p-10 text-center text-[14px] text-[color:var(--ink-soft)]">Loading…</div>;
  }

  return (
    <div className="p-5 flex flex-col gap-5 overflow-y-auto" style={{ height: 580 }}>
      <div className="rounded-[14px] bg-[color:var(--brand)] p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-[10px] bg-white/15 flex items-center justify-center shrink-0">
            <Building2 size={22} className="text-white" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-light text-white/80 uppercase tracking-wider">Your Lab Code</p>
            <p className="text-[22px] font-medium text-white tracking-wider truncate">{center.code}</p>
            <p className="text-[12px] font-light text-white/80">Share this with a hospital so they can request a link with you.</p>
          </div>
        </div>
        <button onClick={copyCode} className="flex items-center gap-2 text-[13px] font-normal text-[color:var(--brand)] bg-[color:var(--surface)] px-4 py-[8px] rounded-full hover:bg-[color:var(--brand-soft)] transition-colors shrink-0">
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy Code</>}
        </button>
      </div>

      <CenterDetailsForm center={center} onSaved={reload} />
    </div>
  );
}

/**
 * Initializes its editable fields straight from `center` at mount — no
 * effect needed, since the parent only renders this once `center` has
 * loaded (and remounts it via `key` if the identity ever changes).
 */
function CenterDetailsForm({ center, onSaved }: { center: LabCenterDTO; onSaved: () => void }) {
  const { run, loading: saving, error } = useMutation();
  const [form, setForm] = useState({
    name: center.name, phone: center.phone, contactEmail: center.contactEmail,
    address: center.address, city: center.city, state: center.state,
  });

  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  async function save() {
    await run(() => api.patch("/lab-centers/me", form));
    onSaved();
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[14px] font-medium text-[color:var(--ink)]">Lab Details</h3>
        <StatusBadge status={center.status} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Lab Name"><FormInput value={form.name} onChange={v => set("name", v)} /></FormRow>
        <FormRow label="Phone"><FormInput value={form.phone} onChange={v => set("phone", v)} /></FormRow>
        <FormRow label="Contact Email"><FormInput type="email" value={form.contactEmail} onChange={v => set("contactEmail", v)} /></FormRow>
        <FormRow label="City"><FormInput value={form.city} onChange={v => set("city", v)} /></FormRow>
        <FormRow label="State"><FormInput value={form.state} onChange={v => set("state", v)} /></FormRow>
        <div className="col-span-2"><FormRow label="Address"><FormInput value={form.address} onChange={v => set("address", v)} /></FormRow></div>
      </div>
      {error && <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2 mt-3">{error.message}</div>}
      <button onClick={save} disabled={saving}
        className="mt-4 text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[9px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </section>
  );
}

// ─── Linked Hospitals Tab (lab center accounts only) ───────────────────────

function LinkedHospitalsView() {
  const { items: links, reload, loading } = useList<LabLinkDTO>("/lab-links");
  const { run, loading: saving } = useMutation();

  const pending = links.filter(l => l.status === "Pending");
  const other = links.filter(l => l.status !== "Pending");

  async function respond(id: number, decision: "accept" | "reject") {
    await run(() => api.post(`/lab-links/${id}/respond`, { decision }));
    reload();
  }
  async function revoke(id: number) {
    await run(() => api.post(`/lab-links/${id}/revoke`, {}));
    reload();
  }

  return (
    <div className="p-5 flex flex-col gap-6 overflow-y-auto" style={{ height: 580 }}>
      {loading && <p className="text-[13px] text-[color:var(--ink-soft)]">Loading…</p>}

      {pending.length > 0 && (
        <section>
          <h3 className="text-[14px] font-medium text-[color:var(--ink)] mb-3">Pending Requests</h3>
          <div className="flex flex-col gap-2">
            {pending.map(link => (
              <div key={link.id} className="flex items-center justify-between p-3 border border-[#ffe0a3] bg-[#fff8ea] rounded-[8px]">
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium text-[color:var(--ink)]">{link.hospitalName}</span>
                  <span className="text-[11px] font-light text-[color:var(--ink-soft)]">Requested by {link.requestedBy} · {link.requestedAt}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => respond(link.id, "reject")} disabled={saving}
                    className="text-[12px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-3 py-[6px] rounded-full hover:bg-[color:var(--surface)] transition-colors disabled:opacity-50">
                    Reject
                  </button>
                  <button onClick={() => respond(link.id, "accept")} disabled={saving}
                    className="text-[12px] font-normal text-white bg-[color:var(--brand)] px-3 py-[6px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-[14px] font-medium text-[color:var(--ink)] mb-3">Hospitals</h3>
        {!loading && other.length === 0 && (
          <p className="text-[13px] text-[color:var(--ink-soft)]">No hospitals linked yet — ask a hospital admin to request a link using this lab&apos;s code.</p>
        )}
        <div className="flex flex-col gap-2">
          {other.map(link => (
            <div key={link.id} className="flex items-center justify-between p-3 border border-[color:var(--line)] rounded-[8px] bg-[color:var(--surface)]">
              <div className="flex flex-col">
                <span className="text-[13px] font-medium text-[color:var(--ink)]">{link.hospitalName}</span>
                <span className="text-[11px] font-light text-[color:var(--ink-soft)]">
                  {link.respondedAt ? `Responded ${link.respondedAt}` : ""}
                  {link.revokedAt ? ` · Revoked ${link.revokedAt}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={link.status} />
                {link.status === "Active" && (
                  <button onClick={() => revoke(link.id)} disabled={saving}
                    className="text-[12px] font-normal text-[#ff0004] border border-[#ffd0d1] px-3 py-[6px] rounded-full hover:bg-[#ffe9e9] transition-colors disabled:opacity-50">
                    Revoke
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const FILTER_MAP: Record<string, string> = { "SampleCollected": "Sample Collected", "ReportReady": "Report Ready" };

function LabPageInner() {
  const { can, user } = useAuth();
  const isPartner = user?.role === "Lab Partner";
  // Independent lab-center accounts (vs. a legacy in-house partner login tied
  // to one hospital) get a "linked hospitals" worklist instead.
  const isCenter = user?.labCenterId != null;
  const canWrite = can("lab", "write");
  const canBook = canWrite && can("patients"); // ordering tests needs the patient registry too
  const canUploadReport = canUploadReports(user?.role);

  // A hand-off from OPD/Appointments arrives as ?patientId=&doctorId= and
  // should land straight on the booking form with the patient pre-picked,
  // not on the default worklist tab.
  const searchParams = useSearchParams();
  const handoffPatientId = searchParams.get("patientId") ?? undefined;
  const handoffDoctorId = searchParams.get("doctorId") ?? undefined;
  const handoffLabCenterId = searchParams.get("labCenterId") ?? undefined;
  const handoffPriority = PRIORITIES.find(p => p === searchParams.get("priority"));

  const [tab, setTab] = useState(handoffPatientId ? "booking" : "worklist");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRangeId>("all");
  const [uploadFor, setUploadFor] = useState<LabTestDTO | null>(null);
  const [viewing, setViewing] = useState<LabTestDTO | null>(null);
  const [viewingPatient, setViewingPatient] = useState<LabTestDTO | null>(null);
  const [barcodeFor, setBarcodeFor] = useState<LabTestDTO | null>(null);
  const { items: tests, reload } = useList<LabTestDTO>("/lab", { all: true });
  // Always fetch the real shape here — switching the endpoint by canBook (which
  // itself resolves asynchronously right after login) could hand PatientPicker
  // leftover LabTestDTO rows from the other endpoint, which have no `.name`
  // field and crash it. Roles without patients:read simply never render
  // BookingView, so the unused background 403 for them is harmless.
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { dialog, remove, mutate } = useRowActions("lab", reload);

  const TABS = [
    { id: "worklist", label: "Worklist", count: tests.filter(t => t.status === "Pending" || t.status === "Sample Collected").length },
    { id: "tests",   label: "By Patient", count: tests.length },
    ...(canBook ? [{ id: "booking", label: "New Booking" }] : []),
    { id: "reports", label: "Reports",    count: tests.filter(t => t.reportStatus === "Ready").length },
    ...(isCenter ? [{ id: "links", label: "Linked Hospitals" }, { id: "about", label: "About" }] : []),
  ];

  const visible = tests.filter(t => {
    const matchF = filter === "All" || t.status === (FILTER_MAP[filter] ?? filter);
    const q = search.toLowerCase();
    const matchS = !q || t.patientName.toLowerCase().includes(q) || t.testName.toLowerCase().includes(q);
    return matchF && matchS && inDateRange(t.date, range);
  });
  // Page over patients (each row is one patient with all their tests).
  const patientGroups = groupByPatient(visible);
  const { rows: pagedGroups, bar: barGroups } = usePagination(patientGroups, "patients", g => `${g[0].hospitalId}:${g[0].patientId ?? g[0].patientName}`);

  return (
    <>
      {dialog}
      {viewingPatient && (
        <PatientDetailModal
          test={viewingPatient}
          allTests={tests.filter(t => t.patientId === viewingPatient.patientId && t.hospitalId === viewingPatient.hospitalId)}
          canWrite={canWrite}
          canUpload={canUploadReport}
          canDelete={canWrite && !isPartner}
          onClose={() => setViewingPatient(null)}
          onUpload={setUploadFor}
          onViewReport={setViewing}
          onCollectSample={(t) => mutate(() => api.patch(`/lab/${t.id}`, { sampleStatus: "Collected" }))}
          onCancelTest={(t) => mutate(() => api.patch(`/lab/${t.id}`, { status: "Cancelled" }))}
          onDelete={(t) => remove(t.id, t.testName)}
          onPrintBarcode={setBarcodeFor}
        />
      )}
      {/* Rendered after the patient modal so they stack on top of it when opened from within. */}
      {uploadFor && (
        <UploadReportModal
          test={uploadFor}
          onClose={() => setUploadFor(null)}
          onUploaded={reload}
        />
      )}
      {viewing && <ReportViewerModal test={viewing} onClose={() => setViewing(null)} />}
      {barcodeFor && <SampleBarcodeModal test={barcodeFor} onClose={() => setBarcodeFor(null)} />}
      <PageHeader
        title="Laboratory"
        subtitle={
          isPartner
            ? `Worklist for ${user?.name} — upload reports for the tests below.`
            : "Manage lab tests, sample collection, report generation, and test bookings."
        }
        stats={[{ icon: FlaskConical, value: `${visible.filter(t => t.status !== "Report Ready").length}`, label: "Active Tests" }]}
        action={
          canBook
            ? { label: "Order Test", icon: Plus, onClick: () => setTab("booking") }
            : { label: "Refresh Worklist", icon: FlaskConical, onClick: reload }
        }
        range={range}
        onRangeChange={setRange}
      />
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 400 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
          {tab === "worklist" && (
            <LabWorklist
              tests={tests.filter(t => inDateRange(t.date, range))}
              canWrite={canWrite}
              canUpload={canUploadReport}
              canDelete={canWrite && !isPartner}
              showHospital={isCenter}
              showDateRange={false}
              onViewPatient={setViewingPatient}
              onViewReport={setViewing}
              onUpload={setUploadFor}
              onCollectSample={(t) => mutate(() => api.patch(`/lab/${t.id}`, { sampleStatus: "Collected" }))}
              onPrintBarcode={setBarcodeFor}
              onSetPriority={(t, priority) => mutate(() => api.patch(`/lab/${t.id}`, { priority }))}
              onCancel={(t) => mutate(() => api.patch(`/lab/${t.id}`, { status: "Cancelled" }))}
              onDelete={(t) => remove(t.id, t.testName)}
            />
          )}
          {tab === "tests" && (
            <>
              <FilterBar filters={FILTERS} searchPlaceholder="Search by patient name or test name..."
                activeFilter={filter} onFilterChange={setFilter} searchQuery={search} onSearchChange={setSearch} />
              <DataTable columns={patientColumns(isCenter)} minWidth={MIN_WIDTH}>
                {visible.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">No tests found.</div>
                ) : pagedGroups.map(group => (
                  <PatientGroupRow
                    key={`${group[0].hospitalId}:${group[0].patientId ?? group[0].patientName}`}
                    tests={group}
                    showHospital={isCenter}
                    onViewPatient={() => setViewingPatient(group[0])}
                  />
                ))}
              </DataTable>
              {barGroups}
            </>
          )}
          {tab === "booking" && canBook && (
            <BookingView patients={patients} onBooked={() => { reload(); setTab("worklist"); }}
              initialPatientId={handoffPatientId} initialDoctorId={handoffDoctorId}
              initialLabCenterId={handoffLabCenterId} initialPriority={handoffPriority} />
          )}
          {tab === "reports" && <ReportsView tests={tests} onUpload={setUploadFor} onView={setViewing} canUpload={canUploadReport} />}
          {tab === "links" && isCenter && <LinkedHospitalsView />}
          {tab === "about" && isCenter && <CenterAboutView />}
        </div>
      </div>
    </>
  );
}

export default function LabPage() {
  return (
    <Suspense fallback={null}>
      <LabPageInner />
    </Suspense>
  );
}
