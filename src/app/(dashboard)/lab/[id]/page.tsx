"use client";

import { useRef } from "react";
import { useParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { useItem, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { printElement, downloadElement, shareDocument } from "@/lib/print";
import { DocumentLetterhead, useHospital } from "@/components/shared/DocumentLetterhead";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import type { LabTestDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Printer, Share2, Download, Upload, Flag } from "lucide-react";

// ─── Mock parameter data per test ────────────────────────────────────────────

type TestParam = { test: string; result: string; unit: string; refRange: string; flag: "Normal" | "High" | "Low" | "Critical" };

const LAB_PARAMS: Record<number, { category: string; params: TestParam[] }[]> = {
  1: [{
    category: "Complete Blood Count",
    params: [
      { test: "Haemoglobin (Hb)",    result: "12.4", unit: "g/dL",     refRange: "11.5–16.5",  flag: "Normal" },
      { test: "WBC Count",           result: "9800",  unit: "/µL",      refRange: "4000–11000", flag: "Normal" },
      { test: "Platelet Count",      result: "1,82,000",unit: "/µL",  refRange: "1.5–4.0 Lac",flag: "Normal" },
      { test: "RBC Count",           result: "4.1",   unit: "Mill/µL",  refRange: "3.8–5.2",    flag: "Normal" },
      { test: "Haematocrit (PCV)",   result: "38.2",  unit: "%",        refRange: "35.0–47.0",  flag: "Normal" },
      { test: "MCV",                 result: "93",    unit: "fL",       refRange: "80–100",      flag: "Normal" },
    ]
  }],
  2: [{
    category: "Lipid Profile",
    params: [
      { test: "Total Cholesterol",   result: "218",  unit: "mg/dL", refRange: "< 200",     flag: "High"   },
      { test: "HDL Cholesterol",     result: "38",   unit: "mg/dL", refRange: "> 40",      flag: "Low"    },
      { test: "LDL Cholesterol",     result: "142",  unit: "mg/dL", refRange: "< 130",     flag: "High"   },
      { test: "VLDL Cholesterol",    result: "38",   unit: "mg/dL", refRange: "< 30",      flag: "High"   },
      { test: "Triglycerides",       result: "188",  unit: "mg/dL", refRange: "< 150",     flag: "High"   },
    ]
  }],
  3: [{
    category: "Thyroid Profile",
    params: [
      { test: "TSH",   result: "6.8",  unit: "mIU/L", refRange: "0.45–4.5",  flag: "High"   },
      { test: "Free T3",result: "3.1", unit: "pg/mL", refRange: "2.3–4.2",   flag: "Normal" },
      { test: "Free T4",result: "0.72",unit: "ng/dL", refRange: "0.73–1.95", flag: "Low"    },
    ]
  }],
};

const FLAG_CLR: Record<string, string> = {
  Normal:   "bg-[#dffff3] text-[#00955c]",
  High:     "bg-[#ffe9e9] text-[#ff0004]",
  Low:      "bg-[#fff2e0] text-[#ff9000]",
  Critical: "bg-[#ffe9e9] text-[#ff0004]",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LabReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { item: test, loading, reload } = useItem<LabTestDTO>(`/lab/${id}`);
  useBreadcrumb("/lab", "Laboratory", test?.testName ?? "Lab Report");
  const { run, loading: acting } = useMutation();
  const docRef = useRef<HTMLDivElement>(null);
  const hospital = useHospital();
  const printReport = () => printElement(docRef.current, test ? `Lab Report — ${test.testName}` : "Lab Report");

  async function markReady() {
    await run(() => api.patch(`/lab/${id}`, { sampleStatus: "Collected", reportStatus: "Ready" }));
    reload();
  }

  if (loading) {
    return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] font-normal text-[#57575f]">Loading…</p></div>;
  }
  if (!test) {
    return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] font-normal text-[#57575f]">Lab test not found.</p></div>;
  }

  const sections = LAB_PARAMS[test.id] ?? LAB_PARAMS[1];
  const isReady  = test.reportStatus === "Ready";

  return (
    <>
      {/* Actions */}
      <div className={`${tw.gutterX} mb-4 pt-2 flex items-center justify-end`}>
        <div className="flex items-center gap-2">
          {isReady ? (
            <>
              <button onClick={() => shareDocument(`Lab Report — ${test.testName}`, window.location.href)} className="flex items-center gap-2 text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-4 py-[7px] rounded-full hover:bg-[#f6f6f6] transition-colors">
                <Share2 size={14} /> Share
              </button>
              <button onClick={() => downloadElement(docRef.current, `Lab Report — ${test.testName}`)} className="flex items-center gap-2 text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-4 py-[7px] rounded-full hover:bg-[#f6f6f6] transition-colors">
                <Download size={14} /> Download
              </button>
              <button onClick={printReport} className="flex items-center gap-2 text-[13px] font-normal text-white bg-[#009598] px-4 py-[7px] rounded-full hover:bg-[#007f82] transition-colors">
                <Printer size={14} /> Print
              </button>
            </>
          ) : (
            <button onClick={markReady} disabled={acting} className="flex items-center gap-2 text-[13px] font-normal text-white bg-[#009598] px-4 py-[7px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
              <Upload size={14} /> {acting ? "Saving…" : "Mark Report Ready"}
            </button>
          )}
        </div>
      </div>

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div ref={docRef} className={`${tw.surface.card} ${tw.radius.card} overflow-hidden max-w-[860px] mx-auto`}>
          {/* Header */}
          <DocumentLetterhead
            hospital={hospital}
            compact
            right={
              <>
                <div className="text-[16px] font-medium text-[#11111c]">{test.testName}</div>
                <div className="text-[12px] font-light text-[#57575f] mt-1">Lab Report · {formatDate(test.date)}</div>
                <div className="mt-2"><StatusBadge status={test.status} /></div>
              </>
            }
          />

          {/* Patient info */}
          <div className="px-8 py-4 grid grid-cols-3 gap-4 border-b border-[#f0f0f0]">
            {[
              { label: "Patient",        value: test.patientName },
              { label: "Age",            value: `${test.patientAge} years` },
              { label: "Test Date",      value: formatDate(test.date) },
              { label: "Sample Status",  value: test.sampleStatus },
              { label: "Report Status",  value: test.reportStatus },
              { label: "Amount",         value: `₹${test.amount.toLocaleString("en-IN")}` },
            ].map(f => (
              <div key={f.label}>
                <p className="text-[10px] font-medium text-[#57575f] uppercase tracking-wider">{f.label}</p>
                <p className="text-[13px] font-normal text-[#11111c] mt-[2px]">{f.value}</p>
              </div>
            ))}
          </div>

          {/* Results */}
          {isReady ? (
            <div className="px-8 py-5">
              {sections.map(section => (
                <div key={section.category} className="mb-6 last:mb-0">
                  <h3 className="text-[13px] font-medium text-[#57575f] uppercase tracking-wider mb-3">{section.category}</h3>
                  <div className="border border-[#dedee1] rounded-[10px] overflow-hidden">
                    <div className="grid grid-cols-[2fr_1fr_1fr_1.2fr_1fr] bg-[#f2f3f3] px-4 py-2">
                      {["Parameter", "Result", "Unit", "Reference Range", "Flag"].map(h => (
                        <span key={h} className="text-[12px] font-medium text-[#11111c]">{h}</span>
                      ))}
                    </div>
                    {section.params.map((p, i) => (
                      <div key={i} className={`grid grid-cols-[2fr_1fr_1fr_1.2fr_1fr] px-4 py-3 items-center ${i < section.params.length - 1 ? "border-b border-[#f0f0f0]" : ""}`}>
                        <span className="text-[13px] font-normal text-[#11111c]">{p.test}</span>
                        <span className={`text-[13px] font-medium ${p.flag !== "Normal" ? "text-[#ff0004]" : "text-[#11111c]"}`}>{p.result}</span>
                        <span className="text-[12px] font-light text-[#57575f]">{p.unit}</span>
                        <span className="text-[12px] font-normal text-[#57575f]">{p.refRange}</span>
                        <span className={`inline-flex items-center gap-1 px-[8px] py-[3px] rounded-full text-[11px] font-normal ${FLAG_CLR[p.flag]}`}>
                          {p.flag !== "Normal" && <Flag size={10} />}
                          {p.flag}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Remarks */}
              <div className="mt-5 p-4 bg-[#f6f6f6] rounded-[10px]">
                <p className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider mb-2">Pathologist Remarks</p>
                <p className="text-[13px] font-light text-[#57575f]">Report reviewed and verified by Dr. P. Sharma (MD Pathology). Results should be correlated with clinical findings.</p>
              </div>
            </div>
          ) : (
            <div className="px-8 py-12 flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-[#f0f0f0] rounded-full flex items-center justify-center">
                <Upload size={20} className="text-[#57575f]" />
              </div>
              <p className="text-[14px] font-medium text-[#11111c]">Report not yet uploaded</p>
              <p className="text-[13px] font-light text-[#57575f]">Sample status: {test.sampleStatus}</p>
              <button className="mt-2 bg-[#009598] text-white text-[13px] font-normal px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors">
                Upload Report PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
