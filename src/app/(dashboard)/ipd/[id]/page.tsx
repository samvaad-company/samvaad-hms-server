"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { ipdRecords } from "@/data/ipd";
import { TabBar } from "@/components/shared/TabBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ChevronLeft, Bed, User, Phone, Stethoscope, MapPin, Calendar, ClipboardList } from "lucide-react";
import Link from "next/link";

// ─── Mock sub-data ────────────────────────────────────────────────────────────

const DAILY_NOTES = [
  { date: "13 Nov 2025", time: "8:00 AM",  nurse: "Maya Sharma",   note: "BP 138/88, HR 82, SpO₂ 96%. Patient comfortable. IV fluids running at 80 ml/hr." },
  { date: "12 Nov 2025", time: "8:15 AM",  nurse: "Deepika Joshi", note: "BP 142/90, HR 86, Temp 37.4°C. Mild chest pain reported. ECG done, no ST changes." },
  { date: "11 Nov 2025", time: "7:50 AM",  nurse: "Maya Sharma",   note: "BP 148/94, HR 90, SpO₂ 94%. Patient compliant with medications. Diet chart followed." },
  { date: "10 Nov 2025", time: "8:05 AM",  nurse: "Asha Kumari",   note: "Admission note. BP 158/98, HR 94. Admitted for hypertensive crisis. Amlodipine & Losartan started." },
];

const MED_CHART = [
  { medicine: "Amlodipine 5mg",       route: "Oral",  freq: "8 AM",             status: ["Given","Given","Given","Given"] },
  { medicine: "Losartan 50mg",        route: "Oral",  freq: "8 AM",             status: ["Given","Given","Given","Given"] },
  { medicine: "Furosemide 40mg",      route: "IV",    freq: "8 AM · 8 PM",      status: ["Given","Given","Given","Given"] },
  { medicine: "Aspirin 75mg",         route: "Oral",  freq: "2 PM",             status: ["Given","Given","Given","Given"] },
  { medicine: "NS 0.9% 500ml",        route: "IV",    freq: "Continuous 80ml/hr",status: ["Running","Running","Running","Running"] },
];

const DIET_CHART = [
  { meal: "Early Morning", time: "6:30 AM",  items: "Warm water + 1 soaked almond" },
  { meal: "Breakfast",     time: "8:00 AM",  items: "Oatmeal porridge + 1 boiled egg + low-fat milk" },
  { meal: "Mid-Morning",   time: "10:30 AM", items: "Fruit (apple / pear) + coconut water" },
  { meal: "Lunch",         time: "1:00 PM",  items: "2 roti + dal + sabzi + curd (low-sodium)" },
  { meal: "Evening",       time: "4:30 PM",  items: "Herbal tea + biscuits (sodium-free)" },
  { meal: "Dinner",        time: "7:30 PM",  items: "Khichdi + sabzi (low-salt)" },
];

const ROUNDS = [
  { date: "13 Nov 2025 · 10:00 AM", doctor: "Dr. Daniel Reed", note: "BP trending down. Continue current medications. Target < 140/90. Repeat renal function test tomorrow." },
  { date: "12 Nov 2025 · 9:45 AM",  doctor: "Dr. Daniel Reed", note: "Echo report reviewed — mild LVH. Intensify BP control. Referred to Cardiology for opinion." },
  { date: "11 Nov 2025 · 10:15 AM", doctor: "Dr. Sophia Adams", note: "Covering round. No acute concerns. Continue current management plan." },
  { date: "10 Nov 2025 · 11:00 AM", doctor: "Dr. Daniel Reed", note: "Initial assessment. Hypertensive crisis. ECG — no acute ischaemia. Admitted for monitoring & IV antihypertensives." },
];

const TABS = [
  { id: "notes",      label: "Daily Notes" },
  { id: "medication", label: "Medication Chart" },
  { id: "diet",       label: "Diet Chart" },
  { id: "rounds",     label: "Doctor Rounds" },
  { id: "discharge",  label: "Discharge" },
];

const STATUS_CLR: Record<string, string> = {
  Given:   "bg-[#dffff3] text-[#00955c]",
  Running: "bg-[#d6eaff] text-[#007cff]",
  Skipped: "bg-[#ffe9e9] text-[#ff0004]",
  Pending: "bg-[#fff2e0] text-[#ff9000]",
};

export default function IpdDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState("notes");

  const record = ipdRecords.find(r => r.id === Number(id));
  if (!record) {
    return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] font-normal text-[#57575f]">IPD record not found.</p></div>;
  }

  const days = 4;

  return (
    <>
      <div className={`${tw.gutterX} mb-4 pt-2`}>
        <Link href="/ipd" className="inline-flex items-center gap-1 text-[13px] font-normal text-[#57575f] hover:text-[#11111c] transition-colors">
          <ChevronLeft size={15} /> Back to IPD
        </Link>
      </div>

      {/* Admission banner */}
      <div className={`${tw.gutterX} mb-5`}>
        <div className={`${tw.surface.card} ${tw.radius.card} p-5`}>
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#e8f7f7] rounded-full flex items-center justify-center text-[18px] font-medium text-[#009598]">
                  {record.patientName.split(" ").map((n:string) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="text-[18px] font-medium text-[#11111c]">{record.patientName}</p>
                  <p className="text-[13px] font-light text-[#57575f]">{record.patientId} · {record.patientAge} yrs</p>
                </div>
                <StatusBadge status={record.status} />
              </div>
              <div className="flex items-center gap-6 flex-wrap">
                {[
                  { icon: Stethoscope, label: "Doctor",       value: record.doctor },
                  { icon: Bed,         label: "Ward / Bed",   value: `${record.ward} · ${record.bed}` },
                  { icon: Calendar,    label: "Admission",    value: record.admissionDate },
                  { icon: ClipboardList,label:"Diagnosis",     value: record.diagnosis },
                ].map(f => (
                  <div key={f.label} className="flex items-center gap-2">
                    <f.icon size={14} className="text-[#57575f]" strokeWidth={1.5} />
                    <span className="text-[12px] font-normal text-[#57575f]">{f.label}:</span>
                    <span className="text-[13px] font-medium text-[#11111c]">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className="text-[12px] font-normal text-[#57575f]">Day {days} of admission</span>
              <button className="text-[12px] font-normal text-[#ff9000] border border-[#ff9000] px-4 py-[6px] rounded-full hover:bg-[#fff2e0] transition-colors">
                Initiate Discharge
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 500 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />

          {tab === "notes" && (
            <div className="p-5 flex flex-col gap-4">
              {DAILY_NOTES.map((n, i) => (
                <div key={i} className="p-4 border border-[#dedee1] rounded-[10px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-medium text-[#11111c]">{n.date} · {n.time}</span>
                    <span className="text-[12px] font-light text-[#57575f]">By: {n.nurse}</span>
                  </div>
                  <p className="text-[13px] font-normal text-[#57575f] leading-relaxed">{n.note}</p>
                </div>
              ))}
            </div>
          )}

          {tab === "medication" && (
            <div className="p-5 overflow-x-auto">
              <div style={{ minWidth: 800 }}>
                <div className="grid gap-0 border border-[#dedee1] rounded-[10px] overflow-hidden">
                  <div className="grid grid-cols-[2fr_80px_150px_repeat(4,80px)] bg-[#f2f3f3] px-4 py-2">
                    {["Medicine", "Route", "Frequency", ...DAILY_NOTES.map(d => d.date.slice(0, 6))].map(h => (
                      <span key={h} className="text-[12px] font-medium text-[#11111c]">{h}</span>
                    ))}
                  </div>
                  {MED_CHART.map((row, i) => (
                    <div key={i} className={`grid grid-cols-[2fr_80px_150px_repeat(4,80px)] px-4 py-3 items-center ${i < MED_CHART.length - 1 ? "border-b border-[#f0f0f0]" : ""}`}>
                      <span className="text-[13px] font-medium text-[#11111c]">{row.medicine}</span>
                      <span className="text-[12px] font-normal text-[#57575f]">{row.route}</span>
                      <span className="text-[12px] font-light text-[#57575f]">{row.freq}</span>
                      {row.status.map((s, si) => (
                        <span key={si} className={`inline-flex items-center justify-center px-[6px] py-[3px] rounded-full text-[10px] font-normal ${STATUS_CLR[s] ?? "bg-[#f0f0f0] text-[#57575f]"}`}>{s}</span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "diet" && (
            <div className="p-5 grid grid-cols-2 gap-4">
              {DIET_CHART.map(d => (
                <div key={d.meal} className="p-4 border border-[#dedee1] rounded-[10px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-medium text-[#11111c]">{d.meal}</span>
                    <span className="text-[11px] font-light text-[#57575f]">{d.time}</span>
                  </div>
                  <p className="text-[12px] font-normal text-[#57575f]">{d.items}</p>
                </div>
              ))}
            </div>
          )}

          {tab === "rounds" && (
            <div className="p-5 flex flex-col gap-4">
              {ROUNDS.map((r, i) => (
                <div key={i} className="p-4 border border-[#dedee1] rounded-[10px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-medium text-[#009598]">{r.doctor}</span>
                    <span className="text-[12px] font-light text-[#57575f]">{r.date}</span>
                  </div>
                  <p className="text-[13px] font-normal text-[#57575f] leading-relaxed">{r.note}</p>
                </div>
              ))}
            </div>
          )}

          {tab === "discharge" && (
            <div className="p-5 flex flex-col gap-4 max-w-[600px]">
              <p className="text-[13px] font-light text-[#57575f]">Complete this form to initiate patient discharge.</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { l: "Discharge Date",    t: "date" },
                  { l: "Discharge Time",    t: "time" },
                  { l: "Condition at Discharge", t: "text" },
                  { l: "Follow-up Date",    t: "date" },
                ].map(f => (
                  <div key={f.l} className="flex flex-col gap-1">
                    <label className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">{f.l}</label>
                    <input type={f.t} placeholder={f.t === "text" ? "e.g. Stable" : ""}
                      className="h-[40px] bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-3 text-[13px] font-normal text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors" />
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">Discharge Summary</label>
                <textarea rows={4} placeholder="Brief clinical summary at discharge..."
                  className="bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-3 py-2 text-[13px] font-normal text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors resize-none" />
              </div>
              <div className="flex gap-2 mt-2">
                <button className="bg-[#009598] text-white text-[13px] font-normal px-5 py-[9px] rounded-full hover:bg-[#007f82] transition-colors">Confirm Discharge</button>
                <button className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[9px] rounded-full hover:bg-[#f6f6f6] transition-colors">Save Draft</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
