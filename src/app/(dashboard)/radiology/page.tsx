"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { ScanLine, Plus, Upload, Eye, FileText, Loader2, Download } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { RadiologyTestDTO, RadiologyReportFileDTO, PatientDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { TabBar } from "@/components/shared/TabBar";
import { Modal } from "@/components/shared/Modal";
import { PatientPicker } from "@/components/shared/PatientPicker";
import { FormRow, FormInput, FormSelect, FormTextarea } from "@/components/shared/FormRow";

// ─── Report viewer ────────────────────────────────────────────────────────────

/** In-app viewer for uploaded reports — avoids popup blockers entirely. */
function ReportViewerModal({
  test,
  onClose,
}: {
  test: RadiologyTestDTO;
  onClose: () => void;
}) {
  const [file, setFile] = useState<RadiologyReportFileDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<RadiologyReportFileDTO>(`/radiology/${test.id}/report`)
      .then(setFile)
      .catch((e: Error) => setError(e.message));
  }, [test.id]);

  // Blob URL renders more reliably in an <iframe> than a raw data: URL (PDFs).
  const blobUrl = useMemo(() => {
    if (!file) return null;
    const [meta, b64] = file.dataUrl.split(",");
    const mime = meta.slice(5).replace(";base64", "");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  }, [file]);
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  const isPdf = file?.dataUrl.startsWith("data:application/pdf");

  return (
    <Modal
      open
      onClose={onClose}
      title={`Report — ${test.testName}`}
      width={760}
      footer={
        <>
          {blobUrl && file && (
            <a
              href={blobUrl}
              download={file.fileName}
              className="flex items-center gap-2 text-[13px] font-normal text-[#009598] border border-[#009598] px-5 py-[8px] rounded-full hover:bg-[#e8f7f7] transition-colors"
            >
              <Download size={14} /> Download
            </a>
          )}
          <button onClick={onClose} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Close</button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13px] font-light text-[#57575f]">
          {test.patientName} · {test.patientAge} yrs
          {file?.uploadedBy && <> · Uploaded by <span className="font-normal text-[#11111c]">{file.uploadedBy}</span></>}
          {file?.uploadedAt && <> · {file.uploadedAt}</>}
        </p>
        {file?.note && (
          <div className="text-[13px] font-normal text-[#11111c] bg-[#f6f6f6] rounded-[8px] px-3 py-2">
            {file.note}
          </div>
        )}
        {error && (
          <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error}</div>
        )}
        {!file && !error && (
          <div className="flex items-center justify-center py-16 text-[#57575f]">
            <Loader2 size={20} className="animate-spin" />
          </div>
        )}
        {blobUrl && (
          isPdf ? (
            <iframe src={blobUrl} title="Report document" className="w-full rounded-[8px] border border-[#dedee1]" style={{ height: 480 }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={blobUrl} alt="Report document" className="w-full rounded-[8px] border border-[#dedee1] object-contain" style={{ maxHeight: 480 }} />
          )
        )}
      </div>
    </Modal>
  );
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

function UploadReportModal({
  test,
  onClose,
  onUploaded,
}: {
  test: RadiologyTestDTO;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { run, loading, error } = useMutation();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [readError, setReadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload() {
    if (!file) return;
    setReadError(null);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    }).catch((e: Error) => {
      setReadError(e.message);
      return null;
    });
    if (!dataUrl) return;

    await run(() =>
      api.post(`/radiology/${test.id}/report`, {
        fileName: file.name,
        dataUrl,
        note,
      }),
    );
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
          <button onClick={onClose} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
          <button
            onClick={upload}
            disabled={loading || !file}
            className="flex items-center gap-2 text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {loading ? "Uploading…" : "Upload Report"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] font-light text-[#57575f]">
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
                ? "border-[#009598] bg-[#e8f7f7] text-[#009598]"
                : "border-[#dedee1] text-[#57575f] hover:bg-[#f6f6f6]"
            }`}
          >
            <FileText size={16} />
            {file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : "Click to choose a file"}
          </button>
        </FormRow>

        <FormRow label="Findings / Note (optional)">
          <FormTextarea placeholder="Key findings, impression, or remarks for the treating doctor…" rows={3} value={note} onChange={setNote} />
        </FormRow>

        {(error || readError) && (
          <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">
            {readError ?? error?.message}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Scans Tab ────────────────────────────────────────────────────────────────

const COLUMNS = [
  { label: "Patient",   width: "minmax(140px,1.3fr)" },
  { label: "Age",       width: "60px" },
  { label: "Study",     width: "minmax(150px,1.5fr)" },
  { label: "Scan",      width: "90px" },
  { label: "Report",    width: "100px" },
  { label: "Uploaded By", width: "minmax(130px,1.1fr)" },
  { label: "Date",      width: "110px" },
  { label: "Amount",    width: "95px", align: "right" as const },
  { label: "Status",    width: "125px" },
  { label: "Action",    width: "52px", align: "right" as const },
];
const FILTERS = [
  { id: "All", label: "All" }, { id: "Pending", label: "Pending" },
  { id: "ScanDone", label: "Scan Done" }, { id: "ReportReady", label: "Report Ready" },
];
const MIN_WIDTH = 1220;

function RadiologyRow({ row, actions, onView }: { row: RadiologyTestDTO; actions: RowAction[]; onView: (t: RadiologyTestDTO) => void }) {
  return (
    <div className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.patientName}</span>
      <span className="text-[13px] font-normal text-[#57575f]">{row.patientAge}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.testName}</span>
      <div>
        <span className={`inline-flex items-center px-[8px] py-[3px] rounded-full text-[11px] font-normal whitespace-nowrap ${row.scanStatus === "Done" ? "bg-[#dffff3] text-[#00955c]" : "bg-[#fff2e0] text-[#ff9000]"}`}>
          {row.scanStatus}
        </span>
      </div>
      <div>
        {row.hasReport ? (
          <button
            onClick={() => onView(row)}
            className="inline-flex items-center gap-1 px-[8px] py-[3px] rounded-full text-[11px] font-normal whitespace-nowrap bg-[#dffff3] text-[#00955c] hover:bg-[#c4f5e2] transition-colors"
          >
            <Eye size={11} /> View
          </button>
        ) : (
          <span className={`inline-flex items-center px-[8px] py-[3px] rounded-full text-[11px] font-normal whitespace-nowrap ${row.reportStatus === "Ready" ? "bg-[#dffff3] text-[#00955c]" : "bg-[#f0f0f0] text-[#57575f]"}`}>
            {row.reportStatus}
          </span>
        )}
      </div>
      <span className="text-[12px] font-normal text-[#57575f] truncate">{row.reportUploadedBy ?? "—"}</span>
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{formatDate(row.date)}</span>
      <span className="text-[13px] font-medium text-[#11111c] text-right">₹{row.amount.toLocaleString("en-IN")}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </div>
  );
}

// ─── Booking Tab ─────────────────────────────────────────────────────────────

const COMMON_STUDIES = [
  { name: "X-Ray Chest PA", category: "X-Ray", price: 400 },
  { name: "X-Ray Left Femur", category: "X-Ray", price: 450 },
  { name: "X-Ray Cervical Spine", category: "X-Ray", price: 500 },
  { name: "Ultrasound Abdomen", category: "Ultrasound", price: 900 },
  { name: "Ultrasound Pelvis", category: "Ultrasound", price: 950 },
  { name: "Doppler Study — Lower Limb", category: "Ultrasound", price: 1600 },
  { name: "CT Scan Brain", category: "CT", price: 3500 },
  { name: "CT Scan Chest (HRCT)", category: "CT", price: 4200 },
  { name: "MRI Brain", category: "MRI", price: 6500 },
  { name: "MRI Knee", category: "MRI", price: 6000 },
  { name: "MRI Lumbar Spine", category: "MRI", price: 7000 },
  { name: "Mammography (Bilateral)", category: "Mammography", price: 2200 },
];

function BookingView({ patients, onBooked }: { patients: PatientDTO[]; onBooked: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [patientId, setPatientId] = useState("");
  const { run, loading, error } = useMutation();

  const filtered = COMMON_STUDIES.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );
  const total = COMMON_STUDIES.filter(t => selected.includes(t.name)).reduce((s, t) => s + t.price, 0);

  async function bookStudies() {
    if (!patientId || selected.length === 0) return;
    const patient = patients.find(p => String(p.id) === patientId);
    // One order for the whole booking, so several studies don't read as
    // several separate patient entries.
    await run(() =>
      api.post("/radiology/orders", {
        patientId: Number(patientId),
        patientName: patient?.name ?? "",
        patientAge: patient?.age ?? 0,
        tests: selected.map(name => ({
          testName: name,
          amount: COMMON_STUDIES.find(t => t.name === name)?.price ?? 0,
        })),
      }),
    );
    setSelected([]);
    setPatientId("");
    onBooked();
  }

  return (
    <div className="p-5 flex flex-col gap-4" style={{ height: 580 }}>
      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Patient *">
          <PatientPicker patients={patients} value={patientId} onChange={(id) => setPatientId(id)} />
        </FormRow>
        <FormRow label="Referring Doctor">
          <FormInput placeholder="Doctor name or OPD reference" />
        </FormRow>
      </div>

      <FormRow label="Add Studies">
        <div className="relative">
          <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#57575f]" />
          <input
            placeholder="Search studies by name or modality..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-[42px] w-full bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] pl-[36px] pr-[14px] text-[14px] font-normal text-[#11111c] placeholder:text-[#57575f] placeholder:opacity-60 focus:outline-none focus:border-[#009598] transition-colors"
          />
        </div>
      </FormRow>

      <div className="flex flex-col gap-2 overflow-y-auto flex-1">
        {filtered.map(study => (
          <label key={study.name} className="flex items-center gap-3 p-3 border border-[#dedee1] rounded-[8px] cursor-pointer hover:bg-[#f6f6f6] transition-colors">
            <input
              type="checkbox"
              checked={selected.includes(study.name)}
              onChange={e => setSelected(prev => e.target.checked ? [...prev, study.name] : prev.filter(t => t !== study.name))}
              className="w-4 h-4 accent-[#009598]"
            />
            <div>
              <span className="text-[14px] font-normal text-[#11111c]">{study.name}</span>
              <span className="text-[11px] font-light text-[#57575f] ml-2">{study.category}</span>
            </div>
          </label>
        ))}
      </div>

      {/* Footer: selection total + submit */}
      <div className="flex items-center justify-between border-t border-[#dedee1] pt-4 shrink-0">
        <span className="text-[13px] font-normal text-[#57575f]">
          {selected.length > 0
            ? `${selected.length} stud${selected.length > 1 ? "ies" : "y"} selected · ₹${total.toLocaleString("en-IN")}`
            : "No studies selected"}
        </span>
        <div className="flex items-center gap-3">
          {error && <span className="text-[12px] text-[#ff0004]">{error.message}</span>}
          <button onClick={bookStudies} disabled={loading || selected.length === 0 || !patientId}
            className={`text-[14px] font-normal px-6 py-[10px] rounded-full transition-colors ${selected.length > 0 && patientId ? "bg-[#009598] text-white hover:bg-[#007f82]" : "bg-[#f0f0f0] text-[#57575f] cursor-not-allowed"}`}>
            {loading ? "Booking…" : "Book Studies"}
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
  canWrite,
}: {
  tests: RadiologyTestDTO[];
  onUpload: (test: RadiologyTestDTO) => void;
  onView: (test: RadiologyTestDTO) => void;
  canWrite: boolean;
}) {
  if (tests.length === 0) {
    return (
      <div className="p-10 text-center text-[14px] text-[#57575f]">No studies yet.</div>
    );
  }
  return (
    <div className="p-5 grid grid-cols-2 gap-4 overflow-y-auto" style={{ minHeight: 300 }}>
      {tests.map(test => (
        <div key={test.id} className="border border-[#dedee1] rounded-[10px] p-4 flex items-start justify-between gap-4 bg-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow">
          <div className="flex flex-col gap-[6px] min-w-0">
            <span className="text-[14px] font-medium text-[#11111c] truncate">{test.testName}</span>
            <span className="text-[12px] font-light text-[#57575f]">{test.patientName} · {test.patientAge} yrs · {formatDate(test.date)}</span>
            <div className="flex items-center gap-2">
              <StatusBadge status={test.status} />
              {test.hasReport && (
                <span className="text-[11px] font-normal text-[#00955c] truncate">
                  {test.reportFileName} · by {test.reportUploadedBy}
                </span>
              )}
            </div>
            {test.reportNote && (
              <p className="text-[12px] font-light text-[#57575f] line-clamp-2">“{test.reportNote}”</p>
            )}
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {test.hasReport ? (
              <button onClick={() => onView(test)} className="flex items-center gap-[6px] text-[12px] font-normal text-[#009598] border border-[#009598] px-3 py-[5px] rounded-full hover:bg-[#e8f7f7] transition-colors whitespace-nowrap">
                <Eye size={13} /> View
              </button>
            ) : canWrite ? (
              <button onClick={() => onUpload(test)} className="flex items-center gap-[6px] text-[12px] font-normal text-[#57575f] border border-[#dedee1] px-3 py-[5px] rounded-full hover:bg-[#f6f6f6] transition-colors whitespace-nowrap">
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

// ─── Page ─────────────────────────────────────────────────────────────────────

const FILTER_MAP: Record<string, string> = { "ScanDone": "Scan Done", "ReportReady": "Report Ready" };

export default function RadiologyPage() {
  const { can, user } = useAuth();
  const isPartner = user?.role === "Radiology Partner";
  const canWrite = can("radiology", "write");
  const canBook = canWrite && can("patients"); // ordering studies needs the patient registry too

  const [tab, setTab] = useState("scans");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [uploadFor, setUploadFor] = useState<RadiologyTestDTO | null>(null);
  const [viewing, setViewing] = useState<RadiologyTestDTO | null>(null);
  const { items: tests, reload } = useList<RadiologyTestDTO>("/radiology", { all: true });
  const { items: patients } = useList<PatientDTO>(canBook ? "/patients" : "/radiology", { all: true });
  const { dialog, remove, mutate } = useRowActions("radiology", reload);

  const TABS = [
    { id: "scans",   label: "All Studies", count: tests.length },
    ...(canBook ? [{ id: "booking", label: "New Order" }] : []),
    { id: "reports", label: "Reports",     count: tests.filter(t => t.reportStatus === "Ready").length },
  ];

  const visible = tests.filter(t => {
    const matchF = filter === "All" || t.status === (FILTER_MAP[filter] ?? filter);
    const q = search.toLowerCase();
    const matchS = !q || t.patientName.toLowerCase().includes(q) || t.testName.toLowerCase().includes(q);
    return matchF && matchS;
  });

  return (
    <>
      {dialog}
      {uploadFor && (
        <UploadReportModal
          test={uploadFor}
          onClose={() => setUploadFor(null)}
          onUploaded={reload}
        />
      )}
      {viewing && <ReportViewerModal test={viewing} onClose={() => setViewing(null)} />}
      <PageHeader
        title="Radiology"
        subtitle={
          isPartner
            ? `Worklist for ${user?.name} — upload reports for the studies below.`
            : "Order imaging studies, track scans, and publish reports."
        }
        stats={[{ icon: ScanLine, value: `${visible.filter(t => t.status !== "Report Ready").length}`, label: "Active Studies" }]}
        action={
          canBook
            ? { label: "Order Study", icon: Plus, onClick: () => setTab("booking") }
            : { label: "Refresh Worklist", icon: ScanLine, onClick: reload }
        }
      />
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 400 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
          {tab === "scans" && (
            <>
              <FilterBar filters={FILTERS} searchPlaceholder="Search by patient name or study..."
                activeFilter={filter} onFilterChange={setFilter} searchQuery={search} onSearchChange={setSearch} />
              <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
                {visible.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[#57575f]">No studies found.</div>
                ) : visible.map(r => (
                  <RadiologyRow key={r.id} row={r} onView={setViewing} actions={[
                    ...(canWrite ? [{ label: r.hasReport ? "Replace report" : "Upload report", onClick: () => setUploadFor(r) }] : []),
                    { label: "View report", disabled: !r.hasReport, onClick: () => setViewing(r) },
                    ...(canWrite ? [
                      { label: "Mark scan done", disabled: r.scanStatus === "Done", onClick: () => mutate(() => api.patch(`/radiology/${r.id}`, { scanStatus: "Done" })) },
                      { label: "Cancel study", disabled: r.status === "Cancelled", onClick: () => mutate(() => api.patch(`/radiology/${r.id}`, { status: "Cancelled" })) },
                    ] : []),
                    ...(canWrite && !isPartner ? [{ label: "Delete", danger: true, onClick: () => remove(r.id, r.testName) }] : []),
                  ]} />
                ))}
              </DataTable>
            </>
          )}
          {tab === "booking" && canBook && (
            <BookingView patients={patients} onBooked={() => { reload(); setTab("scans"); }} />
          )}
          {tab === "reports" && <ReportsView tests={tests} onUpload={setUploadFor} onView={setViewing} canWrite={canWrite} />}
        </div>
      </div>
    </>
  );
}
