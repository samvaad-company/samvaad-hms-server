"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { BarChart3, MoreVertical, TrendingUp, TrendingDown, Download } from "lucide-react";
import { useItem } from "@/lib/api/hooks";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { TabBar } from "@/components/shared/TabBar";
import type { KpiStat, ReportRow } from "@/types";

// ─── Shared sub-components ────────────────────────────────────────────────────

function KpiCard({ stat }: { stat: KpiStat }) {
  return (
    <div className={`${tw.surface.card} ${tw.radius.card} flex-1 p-5 flex flex-col gap-3 border border-[#f0f0f0]`}>
      <span className="text-[13px] font-normal text-[#57575f]">{stat.label}</span>
      <span className="text-[30px] font-medium text-[#11111c] leading-9">{stat.value}</span>
      <div className="flex items-center gap-[5px]">
        {stat.positive ? <TrendingUp size={13} className="text-[#00955c]" /> : <TrendingDown size={13} className="text-[#ff0004]" />}
        <span className={`text-[12px] font-normal leading-4 ${stat.positive ? "text-[#00955c]" : "text-[#ff0004]"}`}>{stat.change} vs last month</span>
      </div>
    </div>
  );
}

function BarChartRow({ label, value, max, color, suffix = "" }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] font-normal text-[#57575f] w-36 shrink-0 whitespace-nowrap">{label}</span>
      <div className="flex-1 h-[8px] bg-[#f0f0f0] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] font-medium text-[#11111c] w-20 text-right shrink-0">{suffix}{value.toLocaleString("en-IN")}</span>
    </div>
  );
}

// ─── Financial Tab ────────────────────────────────────────────────────────────

const FIN_KPIS: KpiStat[] = [
  { label: "Total Revenue",     value: "₹4.8L",   change: "+14%", positive: true  },
  { label: "OPD Revenue",       value: "₹1.2L",   change: "+8%",  positive: true  },
  { label: "IPD Revenue",       value: "₹2.6L",   change: "+18%", positive: true  },
  { label: "Pharmacy Revenue",  value: "₹68K",    change: "-3%",  positive: false },
];

const MONTHLY = [
  { month: "Jun", val: 340000 }, { month: "Jul", val: 395000 }, { month: "Aug", val: 362000 },
  { month: "Sep", val: 421000 }, { month: "Oct", val: 460000 }, { month: "Nov", val: 480000 },
];

const BY_DEPT = [
  { dept: "Cardiology",    val: 124000 }, { dept: "Neurology",  val: 98000 },
  { dept: "Orthopaedics",  val: 87000  }, { dept: "Gynaecology",val: 72000 },
  { dept: "General Medicine",val:65000  }, { dept: "Pharmacy",  val: 68000 },
];

function FinancialView() {
  const maxMonthly = Math.max(...MONTHLY.map(m => m.val));
  const maxDept    = Math.max(...BY_DEPT.map(d => d.val));

  return (
    <div className="p-5 flex flex-col gap-6 overflow-y-auto" style={{ height: 555 }}>
      {/* KPIs */}
      <div className="flex gap-4">
        {FIN_KPIS.map((s, i) => <KpiCard key={i} stat={s} />)}
      </div>
      {/* Charts row */}
      <div className="grid grid-cols-2 gap-5">
        {/* Monthly trend */}
        <div className="border border-[#dedee1] rounded-[10px] p-5">
          <h3 className="text-[14px] font-medium text-[#11111c] mb-4">Monthly Revenue Trend</h3>
          <div className="flex flex-col gap-3">
            {MONTHLY.map(m => <BarChartRow key={m.month} label={m.month + " 2025"} value={m.val} max={maxMonthly} color="bg-[#009598]" suffix="₹" />)}
          </div>
        </div>
        {/* By dept */}
        <div className="border border-[#dedee1] rounded-[10px] p-5">
          <h3 className="text-[14px] font-medium text-[#11111c] mb-4">Revenue by Department</h3>
          <div className="flex flex-col gap-3">
            {BY_DEPT.map(d => <BarChartRow key={d.dept} label={d.dept} value={d.val} max={maxDept} color="bg-[#007cff]" suffix="₹" />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Clinical Tab ─────────────────────────────────────────────────────────────

const CLIN_KPIS: KpiStat[] = [
  { label: "Total Patients",     value: "2,148",  change: "+9%",  positive: true  },
  { label: "New Registrations",  value: "312",    change: "+22%", positive: true  },
  { label: "Avg Consult Time",   value: "14 min", change: "-2 min",positive: true },
  { label: "Readmission Rate",   value: "3.2%",   change: "-0.4%",positive: true  },
];

const TOP_DIAG = [
  { name: "Hypertension (I10)",        count: 128 },
  { name: "Type 2 Diabetes (E11)",     count: 104 },
  { name: "Acute URTI (J06.9)",        count: 89  },
  { name: "CAD (I25.9)",               count: 72  },
  { name: "Low Back Pain (M54.5)",     count: 63  },
  { name: "Hypothyroidism (E03.9)",    count: 58  },
];

const PATIENT_FLOW = [
  { dept: "General Medicine", opd: 410, ipd: 62 },
  { dept: "Cardiology",       opd: 280, ipd: 88 },
  { dept: "Orthopaedics",     opd: 220, ipd: 45 },
  { dept: "Gynaecology",      opd: 195, ipd: 71 },
  { dept: "Neurology",        opd: 150, ipd: 39 },
];

function ClinicalView() {
  const maxDiag = Math.max(...TOP_DIAG.map(d => d.count));
  return (
    <div className="p-5 flex flex-col gap-6 overflow-y-auto" style={{ height: 555 }}>
      <div className="flex gap-4">
        {CLIN_KPIS.map((s, i) => <KpiCard key={i} stat={s} />)}
      </div>
      <div className="grid grid-cols-2 gap-5">
        <div className="border border-[#dedee1] rounded-[10px] p-5">
          <h3 className="text-[14px] font-medium text-[#11111c] mb-4">Top Diagnoses — Nov 2025</h3>
          <div className="flex flex-col gap-3">
            {TOP_DIAG.map(d => <BarChartRow key={d.name} label={d.name} value={d.count} max={maxDiag} color="bg-[#009598]" />)}
          </div>
        </div>
        <div className="border border-[#dedee1] rounded-[10px] p-5">
          <h3 className="text-[14px] font-medium text-[#11111c] mb-4">Patient Flow by Department</h3>
          <div className="flex flex-col gap-4">
            {PATIENT_FLOW.map(d => (
              <div key={d.dept}>
                <div className="flex justify-between mb-1">
                  <span className="text-[12px] font-normal text-[#57575f]">{d.dept}</span>
                  <span className="text-[11px] font-normal text-[#57575f]">OPD {d.opd} · IPD {d.ipd}</span>
                </div>
                <div className="flex h-[6px] rounded-full overflow-hidden gap-[1px]">
                  <div className="bg-[#009598] rounded-full" style={{ width: `${(d.opd / (d.opd + d.ipd)) * 100}%` }} />
                  <div className="bg-[#007cff] rounded-full" style={{ width: `${(d.ipd / (d.opd + d.ipd)) * 100}%` }} />
                </div>
              </div>
            ))}
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1"><span className="w-2 h-2 bg-[#009598] rounded-full" /><span className="text-[11px] text-[#57575f]">OPD</span></div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 bg-[#007cff] rounded-full" /><span className="text-[11px] text-[#57575f]">IPD</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Operational Tab ─────────────────────────────────────────────────────────

const OP_KPIS: KpiStat[] = [
  { label: "Bed Occupancy",   value: "78%",    change: "+5%",  positive: true  },
  { label: "Avg Wait Time",   value: "18 min", change: "-4 min",positive: true },
  { label: "OT Utilisation",  value: "72%",    change: "+11%", positive: true  },
  { label: "Discharge TAT",   value: "3.2 hrs",change: "-0.5 hr",positive: true},
];

const BED_UTIL = [
  { ward: "General Ward",  pct: 82 }, { ward: "ICU",           pct: 94 },
  { ward: "Cardiology",    pct: 71 }, { ward: "Surgery Ward",  pct: 68 },
  { ward: "Maternity",     pct: 60 },
];

const WAIT_TIME = [
  { dept: "Emergency",      mins: 8  }, { dept: "General Medicine", mins: 22 },
  { dept: "Cardiology",     mins: 15 }, { dept: "Orthopaedics",     mins: 28 },
  { dept: "Gynaecology",    mins: 19 },
];

function OperationalView() {
  const maxWait = Math.max(...WAIT_TIME.map(w => w.mins));
  return (
    <div className="p-5 flex flex-col gap-6 overflow-y-auto" style={{ height: 555 }}>
      <div className="flex gap-4">
        {OP_KPIS.map((s, i) => <KpiCard key={i} stat={s} />)}
      </div>
      <div className="grid grid-cols-2 gap-5">
        <div className="border border-[#dedee1] rounded-[10px] p-5">
          <h3 className="text-[14px] font-medium text-[#11111c] mb-4">Bed Utilisation by Ward</h3>
          <div className="flex flex-col gap-4">
            {BED_UTIL.map(b => (
              <div key={b.ward}>
                <div className="flex justify-between mb-1">
                  <span className="text-[12px] font-normal text-[#57575f]">{b.ward}</span>
                  <span className={`text-[12px] font-medium ${b.pct >= 90 ? "text-[#ff0004]" : b.pct >= 75 ? "text-[#ff9000]" : "text-[#00955c]"}`}>{b.pct}%</span>
                </div>
                <div className="h-[8px] bg-[#f0f0f0] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${b.pct >= 90 ? "bg-[#ff0004]" : b.pct >= 75 ? "bg-[#ff9000]" : "bg-[#00955c]"}`} style={{ width: `${b.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-[#dedee1] rounded-[10px] p-5">
          <h3 className="text-[14px] font-medium text-[#11111c] mb-4">Average OPD Wait Time</h3>
          <div className="flex flex-col gap-3">
            {WAIT_TIME.map(w => <BarChartRow key={w.dept} label={w.dept} value={w.mins} max={maxWait} color="bg-[#ff9000]" suffix="" />)}
          </div>
          <p className="text-[11px] font-normal text-[#57575f] mt-3">Values in minutes</p>
        </div>
      </div>
    </div>
  );
}

// ─── Pharmacy Reports Tab ─────────────────────────────────────────────────────

const PH_KPIS: KpiStat[] = [
  { label: "Items in Stock",   value: "142",    change: "+4",   positive: true  },
  { label: "Low Stock Alerts", value: "8",      change: "+3",   positive: false },
  { label: "Monthly Sales",    value: "₹68K",   change: "+12%", positive: true  },
  { label: "Purchase Orders",  value: "₹1.8L",  change: "+7%",  positive: true  },
];

const TOP_MEDS = [
  { name: "Metformin 500mg",  sold: 480 }, { name: "Amlodipine 5mg", sold: 320 },
  { name: "Atorvastatin 10mg",sold: 290 }, { name: "Omeprazole 20mg",sold: 265 },
  { name: "Aspirin 75mg",     sold: 240 }, { name: "Losartan 50mg",  sold: 215 },
];

const PURCHASE_VS_SALES = [
  { month: "Aug", purchase: 185000, sales: 52000 },
  { month: "Sep", purchase: 162000, sales: 58000 },
  { month: "Oct", purchase: 190000, sales: 63000 },
  { month: "Nov", purchase: 178000, sales: 68000 },
];

function PharmacyReportView() {
  const maxSold = Math.max(...TOP_MEDS.map(m => m.sold));
  const maxPvS  = Math.max(...PURCHASE_VS_SALES.map(m => Math.max(m.purchase, m.sales)));
  return (
    <div className="p-5 flex flex-col gap-6 overflow-y-auto" style={{ height: 555 }}>
      <div className="flex gap-4">
        {PH_KPIS.map((s, i) => <KpiCard key={i} stat={s} />)}
      </div>
      <div className="grid grid-cols-2 gap-5">
        <div className="border border-[#dedee1] rounded-[10px] p-5">
          <h3 className="text-[14px] font-medium text-[#11111c] mb-4">Top Selling Medicines — Nov 2025</h3>
          <div className="flex flex-col gap-3">
            {TOP_MEDS.map(m => <BarChartRow key={m.name} label={m.name} value={m.sold} max={maxSold} color="bg-[#009598]" suffix="" />)}
          </div>
          <p className="text-[11px] font-normal text-[#57575f] mt-3">Units sold</p>
        </div>
        <div className="border border-[#dedee1] rounded-[10px] p-5">
          <h3 className="text-[14px] font-medium text-[#11111c] mb-4">Purchase vs Sales (₹)</h3>
          <div className="flex flex-col gap-5">
            {PURCHASE_VS_SALES.map(m => (
              <div key={m.month}>
                <span className="text-[12px] font-medium text-[#57575f]">{m.month} 2025</span>
                <div className="mt-1 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-14 text-[#57575f]">Purchase</span>
                    <div className="flex-1 h-[6px] bg-[#f0f0f0] rounded-full">
                      <div className="h-full bg-[#007cff] rounded-full" style={{ width: `${(m.purchase / maxPvS) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-[#11111c] w-16 text-right">₹{(m.purchase / 1000).toFixed(0)}K</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] w-14 text-[#57575f]">Sales</span>
                    <div className="flex-1 h-[6px] bg-[#f0f0f0] rounded-full">
                      <div className="h-full bg-[#00955c] rounded-full" style={{ width: `${(m.sales / maxPvS) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-[#11111c] w-16 text-right">₹{(m.sales / 1000).toFixed(0)}K</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Doctor Performance (existing logic, now under Operational sub-section) ───

const PERF_COLUMNS = [
  { label: "Doctor",           left: 20  }, { label: "Specialty",        left: 220 },
  { label: "Patients",         left: 450 }, { label: "Revenue",          left: 610 },
  { label: "Satisfaction",     left: 780 }, { label: "Avg Consult Time", left: 970 },
  { label: "Action",           left: 1180 },
];
const PERF_FILTERS = [
  { id: "All", label: "All Doctors" }, { id: "OPD", label: "OPD" },
  { id: "Surgery", label: "Surgery" }, { id: "ICU", label: "ICU" },
];
const PERF_MIN_WIDTH = 1300;

function ReportTableRow({ row }: { row: ReportRow }) {
  return (
    <div className={tw.table.dataRow} style={{ minWidth: PERF_MIN_WIDTH }}>
      <div className="absolute left-5"><span className="text-[14px] font-medium text-[#11111c] leading-[19px] whitespace-nowrap">{row.doctor}</span></div>
      <div className="absolute" style={{ left: 220 }}><span className="text-[14px] font-normal text-[#57575f] leading-[19px] whitespace-nowrap">{row.specialty}</span></div>
      <div className="absolute" style={{ left: 450 }}><span className="text-[14px] font-medium text-[#11111c] leading-[19px]">{row.patientsCount || "—"}</span></div>
      <div className="absolute" style={{ left: 610 }}><span className="text-[14px] font-medium text-[#11111c] leading-[19px]">{row.revenue > 0 ? `₹${row.revenue.toLocaleString("en-IN")}` : "—"}</span></div>
      <div className="absolute" style={{ left: 780 }}><span className="text-[14px] font-normal text-[#11111c] leading-[19px]">{row.satisfaction}</span></div>
      <div className="absolute" style={{ left: 970 }}><span className="text-[14px] font-normal text-[#11111c] leading-[19px]">{row.avgConsultTime}</span></div>
      <div className="absolute" style={{ left: 1180 }}>
        <button className="cursor-pointer text-[#57575f] hover:text-[#11111c] transition-colors"><MoreVertical size={24} strokeWidth={1.5} /></button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "financial",   label: "Financial" },
  { id: "clinical",    label: "Clinical" },
  { id: "operational", label: "Operational" },
  { id: "pharmacy",    label: "Pharmacy" },
];

export default function ReportsPage() {
  const [tab, setTab] = useState("financial");
  const { item: report } = useItem<{ kpis: KpiStat[]; rows: ReportRow[] }>("/reports");
  const reportRows = report?.rows ?? [];
  const revenueKpi = report?.kpis?.find(k => k.label === "Total Revenue")?.value ?? "—";

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Analyse hospital performance — revenue, patient volume, doctor productivity, and pharmacy."
        stats={[{ icon: BarChart3, value: revenueKpi, label: "Total Revenue" }]}
        action={{ label: "Export Report", icon: Download, onClick: () => window.print() }}
      />
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 655 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
          {tab === "financial"   && <FinancialView />}
          {tab === "clinical"    && <ClinicalView />}
          {tab === "operational" && <OperationalView />}
          {tab === "pharmacy"    && <PharmacyReportView />}
        </div>
      </div>

      {/* Doctor Performance Table (always visible below) */}
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ height: 540 }}>
          <div className="px-5 pt-5 pb-0">
            <h2 className="text-[16px] font-medium text-[#11111c] leading-5">Doctor Performance — November 2025</h2>
          </div>
          <FilterBar filters={PERF_FILTERS} searchPlaceholder="Search by doctor or specialty..." />
          <DataTable columns={PERF_COLUMNS} minWidth={PERF_MIN_WIDTH}>
            {reportRows.map(r => <ReportTableRow key={r.id} row={r} />)}
          </DataTable>
        </div>
      </div>
    </>
  );
}
