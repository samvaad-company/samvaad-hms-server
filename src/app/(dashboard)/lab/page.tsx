"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { useRouter } from "next/navigation";
import { FlaskConical, Plus, Upload, Eye } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { LabTestDTO, PatientDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { TabBar } from "@/components/shared/TabBar";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import type { LabTest } from "@/types";

// ─── Tests Tab ────────────────────────────────────────────────────────────────

const COLUMNS = [
  { label: "Patient",       left: 20   }, { label: "Test Name",     left: 220  },
  { label: "Sample Status", left: 460  }, { label: "Report",        left: 660  },
  { label: "Date",          left: 840  }, { label: "Amount (₹)",    left: 1010 },
  { label: "Status",        left: 1170 }, { label: "Action",        left: 1380 },
];
const FILTERS = [
  { id: "All", label: "All" }, { id: "Pending", label: "Pending" },
  { id: "SampleCollected", label: "Sample Collected" }, { id: "ReportReady", label: "Report Ready" },
];
const MIN_WIDTH = 1452;

function LabRow({ row, actions }: { row: LabTest; actions: RowAction[] }) {
  return (
    <div className={tw.table.dataRow} style={{ minWidth: MIN_WIDTH }}>
      <div className="absolute left-5 flex flex-col justify-center">
        <span className="text-[14px] font-medium text-[#11111c] leading-[19px] whitespace-nowrap">{row.patientName}</span>
        <span className="text-[12px] font-light text-[#57575f] leading-4">{row.patientAge} years old</span>
      </div>
      <div className="absolute" style={{ left: 220 }}>
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">{row.testName}</span>
      </div>
      <div className="absolute" style={{ left: 460 }}>
        <span className={`inline-flex items-center px-[8px] py-[4px] rounded-full text-[12px] font-normal whitespace-nowrap ${row.sampleStatus === "Collected" ? "bg-[#dffff3] text-[#00955c]" : "bg-[#fff2e0] text-[#ff9000]"}`}>
          {row.sampleStatus}
        </span>
      </div>
      <div className="absolute" style={{ left: 660 }}>
        <span className={`inline-flex items-center px-[8px] py-[4px] rounded-full text-[12px] font-normal whitespace-nowrap ${row.reportStatus === "Ready" ? "bg-[#dffff3] text-[#00955c]" : "bg-[#f0f0f0] text-[#57575f]"}`}>
          {row.reportStatus}
        </span>
      </div>
      <div className="absolute" style={{ left: 840 }}>
        <span className="text-[14px] font-normal text-[#11111c] leading-[19px] whitespace-nowrap">{row.date}</span>
      </div>
      <div className="absolute" style={{ left: 1010 }}>
        <span className="text-[14px] font-medium text-[#11111c] leading-[19px]">₹{row.amount.toLocaleString("en-IN")}</span>
      </div>
      <div className="absolute" style={{ left: 1170 }}><StatusBadge status={row.status} /></div>
      <div className="absolute" style={{ left: 1380 }}>
        <RowMenu actions={actions} />
      </div>
    </div>
  );
}

// ─── Booking Tab ─────────────────────────────────────────────────────────────

const TEST_CATEGORIES = [
  "Haematology", "Biochemistry", "Microbiology", "Radiology", "Cardiology",
  "Urology", "Pathology", "Immunology",
];
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
  const { run, loading, error } = useMutation();

  const filtered = COMMON_TESTS.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );
  const total = COMMON_TESTS.filter(t => selectedTests.includes(t.name)).reduce((s, t) => s + t.price, 0);

  async function bookTests() {
    if (!patientId || selectedTests.length === 0) return;
    const patient = patients.find(p => String(p.id) === patientId);
    await run(async () => {
      for (const name of selectedTests) {
        const test = COMMON_TESTS.find(t => t.name === name);
        await api.post("/lab", {
          patientId: Number(patientId),
          patientName: patient?.name ?? "",
          patientAge: patient?.age ?? 0,
          testName: name,
          amount: test?.price ?? 0,
        });
      }
    });
    setSelectedTests([]);
    setPatientId("");
    onBooked();
  }

  return (
    <div className="p-5 grid grid-cols-3 gap-5" style={{ height: 580 }}>
      {/* Left: Form */}
      <div className="col-span-2 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Patient *">
            <FormSelect placeholder="Search or select patient" value={patientId} onChange={setPatientId} options={patients.map(p => ({ value: String(p.id), label: `${p.name} — ${p.patientId}` }))} />
          </FormRow>
          <FormRow label="Requesting Doctor">
            <FormInput placeholder="Doctor name or OPD reference" />
          </FormRow>
          <FormRow label="Sample Collection Date *">
            <FormInput type="date" />
          </FormRow>
          <FormRow label="Priority">
            <FormSelect placeholder="Select priority" options={[{ value: "routine", label: "Routine" }, { value: "urgent", label: "Urgent" }, { value: "stat", label: "STAT (Emergency)" }]} />
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
        <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 200 }}>
          {filtered.map(test => (
            <label key={test.name} className="flex items-center justify-between p-3 border border-[#dedee1] rounded-[8px] cursor-pointer hover:bg-[#f6f6f6] transition-colors">
              <div className="flex items-center gap-3">
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
              </div>
              <span className="text-[13px] font-medium text-[#11111c]">₹{test.price}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Right: Summary */}
      <div className="border border-[#dedee1] rounded-[10px] p-4 flex flex-col gap-3 h-fit">
        <h3 className="text-[14px] font-medium text-[#11111c]">Order Summary</h3>
        {selectedTests.length === 0 ? (
          <p className="text-[13px] font-light text-[#57575f]">No tests selected</p>
        ) : (
          <div className="flex flex-col gap-2">
            {COMMON_TESTS.filter(t => selectedTests.includes(t.name)).map(t => (
              <div key={t.name} className="flex justify-between text-[13px]">
                <span className="text-[#11111c] font-normal">{t.name}</span>
                <span className="text-[#57575f]">₹{t.price}</span>
              </div>
            ))}
            <div className="border-t border-[#dedee1] pt-2 flex justify-between">
              <span className="text-[14px] font-medium text-[#11111c]">Total</span>
              <span className="text-[14px] font-medium text-[#009598]">₹{total.toLocaleString("en-IN")}</span>
            </div>
          </div>
        )}
        <button onClick={bookTests} disabled={loading || selectedTests.length === 0 || !patientId}
          className={`w-full text-[14px] font-normal py-[10px] rounded-full transition-colors ${selectedTests.length > 0 && patientId ? "bg-[#009598] text-white hover:bg-[#007f82]" : "bg-[#f0f0f0] text-[#57575f] cursor-not-allowed"}`}>
          {loading ? "Booking…" : "Book Tests"}
        </button>
        {error && <div className="text-[12px] text-[#ff0004]">{error.message}</div>}
      </div>
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsView({ labTests }: { labTests: LabTestDTO[] }) {
  return (
    <div className="p-5 grid grid-cols-2 gap-4 overflow-y-auto" style={{ height: 555 }}>
      {labTests.map(test => (
        <div key={test.id} className="border border-[#dedee1] rounded-[10px] p-4 flex items-start justify-between gap-4 bg-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow">
          <div className="flex flex-col gap-[6px]">
            <span className="text-[14px] font-medium text-[#11111c]">{test.testName}</span>
            <span className="text-[12px] font-light text-[#57575f]">{test.patientName} · {test.patientAge} yrs · {test.date}</span>
            <div className="flex items-center gap-2">
              <StatusBadge status={test.status} />
              {test.reportStatus === "Ready" && (
                <span className="text-[11px] font-normal text-[#00955c]">PDF ready</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {test.reportStatus === "Ready" ? (
              <button className="flex items-center gap-[6px] text-[12px] font-normal text-[#009598] border border-[#009598] px-3 py-[5px] rounded-full hover:bg-[#e8f7f7] transition-colors whitespace-nowrap">
                <Eye size={13} /> View
              </button>
            ) : (
              <button className="flex items-center gap-[6px] text-[12px] font-normal text-[#57575f] border border-[#dedee1] px-3 py-[5px] rounded-full hover:bg-[#f6f6f6] transition-colors whitespace-nowrap">
                <Upload size={13} /> Upload
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const LAB_FILTER_MAP: Record<string, string> = { "SampleCollected": "Sample Collected", "ReportReady": "Report Ready" };

export default function LabPage() {
  const [tab, setTab] = useState("tests");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
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
    return matchF && matchS;
  });

  return (
    <>
      {dialog}
      <PageHeader
        title="Laboratory"
        subtitle="Manage lab tests, sample collection, report generation, and test bookings."
        stats={[{ icon: FlaskConical, value: `${visible.filter(t => t.status !== "Report Ready").length}`, label: "Active Tests" }]}
        action={{ label: "Order Test", icon: Plus, onClick: () => setTab("booking") }}
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
