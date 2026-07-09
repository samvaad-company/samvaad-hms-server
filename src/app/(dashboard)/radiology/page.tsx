"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { ScanLine, Plus, Upload, Eye } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { RadiologyTestDTO, PatientDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { TabBar } from "@/components/shared/TabBar";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";

// ─── Scans Tab ────────────────────────────────────────────────────────────────

const COLUMNS = [
  { label: "Patient",   width: "minmax(150px,1.4fr)" },
  { label: "Age",       width: "60px" },
  { label: "Study",     width: "minmax(160px,1.6fr)" },
  { label: "Scan",      width: "100px" },
  { label: "Report",    width: "100px" },
  { label: "Date",      width: "110px" },
  { label: "Amount",    width: "100px", align: "right" as const },
  { label: "Status",    width: "130px" },
  { label: "Action",    width: "52px", align: "right" as const },
];
const FILTERS = [
  { id: "All", label: "All" }, { id: "Pending", label: "Pending" },
  { id: "ScanDone", label: "Scan Done" }, { id: "ReportReady", label: "Report Ready" },
];
const MIN_WIDTH = 1180;

function RadiologyRow({ row, actions }: { row: RadiologyTestDTO; actions: RowAction[] }) {
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
        <span className={`inline-flex items-center px-[8px] py-[3px] rounded-full text-[11px] font-normal whitespace-nowrap ${row.reportStatus === "Ready" ? "bg-[#dffff3] text-[#00955c]" : "bg-[#f0f0f0] text-[#57575f]"}`}>
          {row.reportStatus}
        </span>
      </div>
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{row.date}</span>
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
    await run(async () => {
      for (const name of selected) {
        const study = COMMON_STUDIES.find(t => t.name === name);
        await api.post("/radiology", {
          patientId: Number(patientId),
          patientName: patient?.name ?? "",
          patientAge: patient?.age ?? 0,
          testName: name,
          amount: study?.price ?? 0,
        });
      }
    });
    setSelected([]);
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

        <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 280 }}>
          {filtered.map(study => (
            <label key={study.name} className="flex items-center justify-between p-3 border border-[#dedee1] rounded-[8px] cursor-pointer hover:bg-[#f6f6f6] transition-colors">
              <div className="flex items-center gap-3">
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
              </div>
              <span className="text-[13px] font-medium text-[#11111c]">₹{study.price}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Right: Summary */}
      <div className="border border-[#dedee1] rounded-[10px] p-4 flex flex-col gap-3 h-fit">
        <h3 className="text-[14px] font-medium text-[#11111c]">Order Summary</h3>
        {selected.length === 0 ? (
          <p className="text-[13px] font-light text-[#57575f]">No studies selected</p>
        ) : (
          <div className="flex flex-col gap-2">
            {COMMON_STUDIES.filter(t => selected.includes(t.name)).map(t => (
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
        <button onClick={bookStudies} disabled={loading || selected.length === 0 || !patientId}
          className={`w-full text-[14px] font-normal py-[10px] rounded-full transition-colors ${selected.length > 0 && patientId ? "bg-[#009598] text-white hover:bg-[#007f82]" : "bg-[#f0f0f0] text-[#57575f] cursor-not-allowed"}`}>
          {loading ? "Booking…" : "Book Studies"}
        </button>
        {error && <div className="text-[12px] text-[#ff0004]">{error.message}</div>}
      </div>
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsView({ tests }: { tests: RadiologyTestDTO[] }) {
  return (
    <div className="p-5 grid grid-cols-2 gap-4 overflow-y-auto" style={{ height: 555 }}>
      {tests.map(test => (
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

const FILTER_MAP: Record<string, string> = { "ScanDone": "Scan Done", "ReportReady": "Report Ready" };

export default function RadiologyPage() {
  const [tab, setTab] = useState("scans");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const { items: tests, reload } = useList<RadiologyTestDTO>("/radiology", { all: true });
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { dialog, remove, mutate } = useRowActions("radiology", reload);

  const TABS = [
    { id: "scans",   label: "All Studies", count: tests.length },
    { id: "booking", label: "New Order" },
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
      <PageHeader
        title="Radiology"
        subtitle="Order imaging studies, track scans, and publish reports."
        stats={[{ icon: ScanLine, value: `${visible.filter(t => t.status !== "Report Ready").length}`, label: "Active Studies" }]}
        action={{ label: "Order Study", icon: Plus, onClick: () => setTab("booking") }}
      />
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 655 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
          {tab === "scans" && (
            <>
              <FilterBar filters={FILTERS} searchPlaceholder="Search by patient name or study..."
                activeFilter={filter} onFilterChange={setFilter} searchQuery={search} onSearchChange={setSearch} />
              <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
                {visible.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[#57575f]">No studies found.</div>
                ) : visible.map(r => (
                  <RadiologyRow key={r.id} row={r} actions={[
                    { label: "Mark scan done", disabled: r.scanStatus === "Done", onClick: () => mutate(() => api.patch(`/radiology/${r.id}`, { scanStatus: "Done" })) },
                    { label: "Mark report ready", disabled: r.reportStatus === "Ready", onClick: () => mutate(() => api.patch(`/radiology/${r.id}`, { reportStatus: "Ready" })) },
                    { label: "Cancel study", disabled: r.status === "Cancelled", onClick: () => mutate(() => api.patch(`/radiology/${r.id}`, { status: "Cancelled" })) },
                    { label: "Delete", danger: true, onClick: () => remove(r.id, r.testName) },
                  ]} />
                ))}
              </DataTable>
            </>
          )}
          {tab === "booking" && <BookingView patients={patients} onBooked={() => { reload(); setTab("scans"); }} />}
          {tab === "reports" && <ReportsView tests={tests} />}
        </div>
      </div>
    </>
  );
}
