"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { useRouter } from "next/navigation";
import { FlaskConical, Plus, Upload, Eye } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { inDateRange, type DateRangeId, formatDate, todayIso } from "@/lib/dates";
import { api } from "@/lib/api/client";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { LabTestDTO, PatientDTO, DocumentDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { TabBar } from "@/components/shared/TabBar";
import { PatientPicker } from "@/components/shared/PatientPicker";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import { Modal } from "@/components/shared/Modal";
import { DocumentsPanel } from "@/components/shared/DocumentsPanel";
import type { LabTest } from "@/types";

// ─── Tests Tab ────────────────────────────────────────────────────────────────

const COLUMNS = [
  { label: "Patient",   width: "minmax(150px,1.4fr)" },
  { label: "Age",       width: "60px" },
  { label: "Test Name", width: "minmax(160px,1.6fr)" },
  { label: "Sample",    width: "110px" },
  { label: "Report",    width: "100px" },
  { label: "Date",      width: "110px" },
  { label: "Amount",    width: "100px", align: "right" as const },
  { label: "Status",    width: "130px" },
  { label: "Action",    width: "52px", align: "right" as const },
];
const FILTERS = [
  { id: "All", label: "All" }, { id: "Pending", label: "Pending" },
  { id: "SampleCollected", label: "Sample Collected" }, { id: "ReportReady", label: "Report Ready" },
];
const MIN_WIDTH = 1180;

function LabRow({ row, actions }: { row: LabTest; actions: RowAction[] }) {
  return (
    <div className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.patientName}</span>
      <span className="text-[13px] font-normal text-[#57575f]">{row.patientAge}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.testName}</span>
      <div>
        <span className={`inline-flex items-center px-[8px] py-[3px] rounded-full text-[11px] font-normal whitespace-nowrap ${row.sampleStatus === "Collected" ? "bg-[#dffff3] text-[#00955c]" : "bg-[#fff2e0] text-[#ff9000]"}`}>
          {row.sampleStatus}
        </span>
      </div>
      <div>
        <span className={`inline-flex items-center px-[8px] py-[3px] rounded-full text-[11px] font-normal whitespace-nowrap ${row.reportStatus === "Ready" ? "bg-[#dffff3] text-[#00955c]" : "bg-[#f0f0f0] text-[#57575f]"}`}>
          {row.reportStatus}
        </span>
      </div>
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{formatDate(row.date)}</span>
      <span className="text-[13px] font-medium text-[#11111c] text-right">₹{row.amount.toLocaleString("en-IN")}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </div>
  );
}

// ─── Booking Tab ─────────────────────────────────────────────────────────────

const TEST_CATEGORIES = [
  "Haematology", "Biochemistry", "Microbiology", "Radiology", "Cardiology",
  "Urology", "Pathology", "Immunology",
];
const LAB_PRIORITY_OPTS = [
  { value: "Routine", label: "Routine" },
  { value: "Urgent",  label: "Urgent" },
  { value: "STAT",    label: "STAT (Emergency)" },
];

const PRIORITY_CLR: Record<string, string> = {
  STAT:    "bg-[#ffe9e9] text-[#ff0004]",
  Urgent:  "bg-[#fff2e0] text-[#ff9000]",
  Routine: "bg-[#f0f0f0] text-[#57575f]",
};

const COMMON_TESTS = [
  { name: "Complete Blood Count (CBC)", category: "Haematology", price: 350 },
  { name: "Lipid Profile", category: "Biochemistry", price: 600 },
  { name: "HbA1c", category: "Biochemistry", price: 450 },
  { name: "Fasting Blood Sugar", category: "Biochemistry", price: 80 },
  { name: "Thyroid Profile (T3/T4/TSH)", category: "Biochemistry", price: 950 },
  { name: "Liver Function Test (LFT)", category: "Biochemistry", price: 700 },
  { name: "Kidney Function Test (KFT)", category: "Biochemistry", price: 650 },
  { name: "Urine Routine", category: "Urology", price: 120 },
  { name: "Stool Routine", category: "Pathology", price: 200 },
  { name: "X-Ray Chest PA", category: "Radiology", price: 400 },
  { name: "ECG", category: "Cardiology", price: 250 },
  { name: "Echocardiography", category: "Cardiology", price: 1800 },
  { name: "Ultrasound Abdomen", category: "Radiology", price: 900 },
  { name: "IgE Allergy Panel", category: "Immunology", price: 2500 },
];

function BookingView({ patients, onBooked }: { patients: PatientDTO[]; onBooked: () => void }) {
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [patientId, setPatientId] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [priority, setPriority] = useState("Routine");
  const [collectionDate, setCollectionDate] = useState("");
  const [discount, setDiscount] = useState("");
  const { run, loading, error } = useMutation();

  const filtered = COMMON_TESTS.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );
  const total = COMMON_TESTS.filter(t => selectedTests.includes(t.name)).reduce((s, t) => s + t.price, 0);

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
        requestedBy,
        priority,
        collectionDate,
        discount: Number(discount) || 0,
        tests: selectedTests.map(name => ({
          testName: name,
          amount: COMMON_TESTS.find(t => t.name === name)?.price ?? 0,
        })),
      }),
    );
    setSelectedTests([]); setPatientId(""); setRequestedBy("");
    setPriority("Routine"); setCollectionDate(""); setDiscount("");
    onBooked();
  }

  return (
    <div className="p-5 flex flex-col gap-4" style={{ height: 580 }}>
      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Patient *">
          <PatientPicker patients={patients} value={patientId} onChange={(id) => setPatientId(id)} />
        </FormRow>
        <FormRow label="Requesting Doctor">
          <FormInput placeholder="Doctor name or OPD reference" value={requestedBy} onChange={setRequestedBy} />
        </FormRow>
        <FormRow label="Sample Collection Date">
          <input
            type="date"
            value={collectionDate}
            min={todayIso()}
            onChange={(e) => setCollectionDate(e.target.value)}
            className="h-[42px] w-full bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-[14px] text-[14px] text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors"
          />
        </FormRow>
        <FormRow label="Priority">
          <FormSelect placeholder="Select priority" value={priority} onChange={setPriority}
            options={LAB_PRIORITY_OPTS} />
        </FormRow>
        <FormRow label="Discount (₹)">
          <FormInput type="number" placeholder="0" value={discount} onChange={setDiscount} />
        </FormRow>
      </div>

      {/* Test search */}
      <FormRow label="Add Tests">
        <div className="relative">
          <FlaskConical size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#57575f]" />
          <input
            placeholder="Search tests by name or category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-[42px] w-full bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] pl-[36px] pr-[14px] text-[14px] font-normal text-[#11111c] placeholder:text-[#57575f] placeholder:opacity-60 focus:outline-none focus:border-[#009598] transition-colors"
          />
        </div>
      </FormRow>

      {/* Test list */}
      <div className="flex flex-col gap-2 overflow-y-auto flex-1">
        {filtered.map(test => (
          <label key={test.name} className="flex items-center gap-3 p-3 border border-[#dedee1] rounded-[8px] cursor-pointer hover:bg-[#f6f6f6] transition-colors">
            <input
              type="checkbox"
              checked={selectedTests.includes(test.name)}
              onChange={e => setSelectedTests(prev => e.target.checked ? [...prev, test.name] : prev.filter(t => t !== test.name))}
              className="w-4 h-4 accent-[#009598]"
            />
            <div>
              <span className="text-[14px] font-normal text-[#11111c]">{test.name}</span>
              <span className="text-[11px] font-light text-[#57575f] ml-2">{test.category}</span>
            </div>
          </label>
        ))}
      </div>

      {/* Footer: selection total + submit */}
      <div className="flex items-center justify-between border-t border-[#dedee1] pt-4 shrink-0">
        <span className="text-[13px] font-normal text-[#57575f]">
          {selectedTests.length > 0
            ? `${selectedTests.length} test${selectedTests.length > 1 ? "s" : ""} selected · ₹${total.toLocaleString("en-IN")}`
            : "No tests selected"}
        </span>
        <div className="flex items-center gap-3">
          {error && <span className="text-[12px] text-[#ff0004]">{error.message}</span>}
          <button onClick={bookTests} disabled={loading || selectedTests.length === 0 || !patientId}
            className={`text-[14px] font-normal px-6 py-[10px] rounded-full transition-colors ${selectedTests.length > 0 && patientId ? "bg-[#009598] text-white hover:bg-[#007f82]" : "bg-[#f0f0f0] text-[#57575f] cursor-not-allowed"}`}>
            {loading ? "Booking…" : "Book Tests"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsView({ labTests }: { labTests: LabTestDTO[] }) {
  // Reports are stored as document attachments against the lab test.
  const [openFor, setOpenFor] = useState<LabTestDTO | null>(null);
  const { items: docs } = useList<DocumentDTO>("/documents", { all: true, owner_type: "lab" });
  const countFor = (id: number) => docs.filter(d => d.ownerId === id).length;

  return (
    <>
      <div className="p-5 grid grid-cols-2 gap-4 overflow-y-auto" style={{ height: 555 }}>
        {labTests.map(test => {
          const n = countFor(test.id);
          return (
            <div key={test.id} className="border border-[#dedee1] rounded-[10px] p-4 flex items-start justify-between gap-4 bg-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow">
              <div className="flex flex-col gap-[6px] min-w-0">
                <span className="text-[14px] font-medium text-[#11111c] truncate">{test.testName}</span>
                <span className="text-[12px] font-light text-[#57575f] truncate">
                  {test.patientName} · {test.patientAge} yrs · {formatDate(test.date)}
                </span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={test.status} />
                  {n > 0 && (
                    <span className="text-[11px] font-normal text-[#00955c]">
                      {n} file{n > 1 ? "s" : ""} attached
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => setOpenFor(test)}
                  className={`flex items-center gap-[6px] text-[12px] font-normal px-3 py-[5px] rounded-full transition-colors whitespace-nowrap ${
                    n > 0
                      ? "text-[#009598] border border-[#009598] hover:bg-[#e8f7f7]"
                      : "text-[#57575f] border border-[#dedee1] hover:bg-[#f6f6f6]"
                  }`}
                >
                  {n > 0 ? <><Eye size={13} /> View</> : <><Upload size={13} /> Upload</>}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {openFor && (
        <Modal
          open
          onClose={() => setOpenFor(null)}
          title={`${openFor.testName} — ${openFor.patientName}`}
          width={620}
          footer={
            <button onClick={() => setOpenFor(null)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">
              Close
            </button>
          }
        >
          <DocumentsPanel
            ownerType="lab"
            ownerId={openFor.id}
            categories={["Report", "Scan", "Referral", "Other"]}
          />
        </Modal>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const LAB_FILTER_MAP: Record<string, string> = { "SampleCollected": "Sample Collected", "ReportReady": "Report Ready" };

export default function LabPage() {
  const [tab, setTab] = useState("tests");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRangeId>("all");
  const router = useRouter();
  const { items: labTests, reload } = useList<LabTestDTO>("/lab", { all: true });
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { dialog, remove, mutate } = useRowActions("lab", reload);

  const TABS = [
    { id: "tests",   label: "All Tests",    count: labTests.length },
    { id: "booking", label: "New Booking" },
    { id: "reports", label: "Reports",      count: labTests.filter(t => t.reportStatus === "Ready").length },
  ];

  const visible = labTests.filter(t => {
    const matchF = filter === "All" || t.status === (LAB_FILTER_MAP[filter] ?? filter);
    const q = search.toLowerCase();
    const matchS = !q || t.patientName.toLowerCase().includes(q) || t.testName.toLowerCase().includes(q);
    return matchF && matchS && inDateRange(t.date, range);
  });

  return (
    <>
      {dialog}
      <PageHeader
        title="Laboratory"
        subtitle="Manage lab tests, sample collection, report generation, and test bookings."
        stats={[{ icon: FlaskConical, value: `${visible.filter(t => t.status !== "Report Ready").length}`, label: "Active Tests" }]}
        action={{ label: "Order Test", icon: Plus, onClick: () => setTab("booking") }}
        range={range}
        onRangeChange={setRange}
      />
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 655 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
          {tab === "tests" && (
            <>
              <FilterBar filters={FILTERS} searchPlaceholder="Search by patient name or test name..."
                activeFilter={filter} onFilterChange={setFilter} searchQuery={search} onSearchChange={setSearch} />
              <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
                {visible.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[#57575f]">No tests found.</div>
                ) : visible.map(r => (
                  <LabRow key={r.id} row={r} actions={[
                    { label: "Collect sample", disabled: r.sampleStatus === "Collected", onClick: () => mutate(() => api.patch(`/lab/${r.id}`, { sampleStatus: "Collected" })) },
                    { label: "Mark report ready", disabled: r.reportStatus === "Ready", onClick: () => mutate(() => api.patch(`/lab/${r.id}`, { reportStatus: "Ready" })) },
                    { label: "View report", disabled: r.reportStatus !== "Ready", onClick: () => router.push(`/lab/${r.id}`) },
                    { label: "Delete", danger: true, onClick: () => remove(r.id, r.testName) },
                  ]} />
                ))}
              </DataTable>
            </>
          )}
          {tab === "booking" && <BookingView patients={patients} onBooked={() => { reload(); setTab("tests"); }} />}
          {tab === "reports" && <ReportsView labTests={labTests} />}
        </div>
      </div>
    </>
  );
}
