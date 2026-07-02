"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { useItem } from "@/lib/api/hooks";
import type { PatientDTO, PrescriptionDTO, LabTestDTO } from "@/types/api";
import { TabBar } from "@/components/shared/TabBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Phone, MapPin, Droplets, Calendar, ChevronLeft,
  FileText, Upload, ShieldCheck, AlertCircle,
} from "lucide-react";
import Link from "next/link";

type PatientDetail = PatientDTO & {
  prescriptions: PrescriptionDTO[];
  labTests: LabTestDTO[];
};

// ─── Illustrative timeline / vaccination history (not yet captured in DB) ──────

const TIMELINE: Record<number, Array<{ date: string; type: string; description: string; doctor: string; status: string }>> = {
  1: [
    { date: "8 Nov 2025",  type: "OPD Visit",  description: "Dizziness or weakness — possible inner ear issue", doctor: "Dr. Olivia Turner", status: "Completed" },
    { date: "22 Oct 2025", type: "Lab Test",   description: "CBC, Thyroid Panel",                                doctor: "Dr. Olivia Turner", status: "Completed" },
    { date: "1 Oct 2025",  type: "OPD Visit",  description: "Migraine follow-up",                                doctor: "Dr. Olivia Turner", status: "Completed" },
  ],
  6: [
    { date: "13 Nov 2025", type: "OPD Visit",     description: "Diabetes management — HbA1c review",        doctor: "Dr. Daniel Reed", status: "Upcoming"  },
    { date: "28 Oct 2025", type: "Lab Test",      description: "HbA1c, Fasting Blood Sugar, Lipid Profile", doctor: "Dr. Daniel Reed", status: "Completed" },
    { date: "15 Oct 2025", type: "Prescription",  description: "Metformin 500mg, Losartan 50mg",            doctor: "Dr. Daniel Reed", status: "Completed" },
    { date: "5 Sep 2025",  type: "IPD Admission", description: "Hyperglycaemic episode — 3-day admission",   doctor: "Dr. Daniel Reed", status: "Discharged"},
  ],
};

const VACCINATIONS: Record<number, Array<{ name: string; date: string; dose: string; next?: string }>> = {
  1: [
    { name: "COVID-19 (Covishield)", date: "10 Mar 2021", dose: "Dose 1" },
    { name: "COVID-19 (Covishield)", date: "15 Apr 2021", dose: "Dose 2" },
    { name: "Influenza",             date: "2 Jan 2024",  dose: "Annual", next: "Jan 2025" },
  ],
  6: [
    { name: "COVID-19 (Covaxin)",    date: "20 Feb 2021", dose: "Dose 1" },
    { name: "COVID-19 (Covaxin)",    date: "25 Mar 2021", dose: "Dose 2" },
    { name: "Pneumococcal (PPSV23)", date: "12 Jun 2022", dose: "Dose 1" },
    { name: "Hepatitis B",           date: "1 Aug 2020",  dose: "Complete", next: "—" },
  ],
};

// ─── Sub-views ────────────────────────────────────────────────────────────────

function OverviewTab({ patientId }: { patientId: number }) {
  const timeline = TIMELINE[patientId] ?? TIMELINE[1];
  const TYPE_CLR: Record<string, string> = {
    "OPD Visit":     "bg-[#d6eaff] text-[#007cff]",
    "Lab Test":      "bg-[#e8f7f7] text-[#009598]",
    "Prescription":  "bg-[#dffff3] text-[#00955c]",
    "IPD Admission": "bg-[#fff2e0] text-[#ff9000]",
  };
  return (
    <div className="p-5 flex flex-col gap-4">
      <h3 className="text-[14px] font-medium text-[#11111c]">Visit Timeline</h3>
      <div className="flex flex-col gap-3">
        {timeline.map((event, i) => (
          <div key={i} className="flex gap-4 items-start">
            <div className="flex flex-col items-center shrink-0">
              <div className="w-[10px] h-[10px] rounded-full bg-[#009598] mt-1" />
              {i < timeline.length - 1 && <div className="w-[1px] flex-1 min-h-[36px] bg-[#dedee1] mt-1" />}
            </div>
            <div className="flex-1 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-[4px]">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-[8px] py-[3px] rounded-full text-[11px] font-normal ${TYPE_CLR[event.type] ?? "bg-[#f0f0f0] text-[#57575f]"}`}>{event.type}</span>
                    <StatusBadge status={event.status} />
                  </div>
                  <span className="text-[13px] font-normal text-[#11111c]">{event.description}</span>
                  <span className="text-[12px] font-light text-[#57575f]">{event.doctor}</span>
                </div>
                <span className="text-[12px] font-light text-[#57575f] whitespace-nowrap">{event.date}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrescriptionsTab({ rxList }: { rxList: PrescriptionDTO[] }) {
  return (
    <div className="p-5 flex flex-col gap-3">
      {rxList.length === 0 && (
        <p className="text-[13px] font-light text-[#57575f]">No prescriptions on record.</p>
      )}
      {rxList.map(rx => (
        <div key={rx.id} className="flex items-center justify-between p-4 border border-[#dedee1] rounded-[10px]">
          <div className="flex flex-col gap-[4px]">
            <span className="text-[14px] font-medium text-[#11111c]">{rx.rxNumber}</span>
            <span className="text-[12px] font-light text-[#57575f]">{rx.doctor} · {rx.date}</span>
            <span className="text-[12px] font-normal text-[#57575f]">{rx.medicineCount} medicines · {rx.diagnosis}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={rx.status} />
            <Link href={`/prescriptions/${rx.id}`} className="text-[12px] font-normal text-[#009598] border border-[#009598] px-3 py-[5px] rounded-full hover:bg-[#e8f7f7] transition-colors whitespace-nowrap">
              View Rx
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

function LabReportsTab({ tests }: { tests: LabTestDTO[] }) {
  return (
    <div className="p-5 flex flex-col gap-3">
      {tests.length === 0 && <p className="text-[13px] font-light text-[#57575f]">No lab tests on record.</p>}
      {tests.map(t => (
        <div key={t.id} className="flex items-center justify-between p-4 border border-[#dedee1] rounded-[10px]">
          <div className="flex flex-col gap-[4px]">
            <span className="text-[14px] font-medium text-[#11111c]">{t.testName}</span>
            <span className="text-[12px] font-light text-[#57575f]">{t.date} · ₹{t.amount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex px-[8px] py-[4px] rounded-full text-[11px] font-normal ${t.reportStatus === "Ready" ? "bg-[#dffff3] text-[#00955c]" : "bg-[#f0f0f0] text-[#57575f]"}`}>{t.reportStatus}</span>
            <StatusBadge status={t.status} />
            {t.reportStatus === "Ready" && (
              <Link href={`/lab/${t.id}`} className="text-[12px] font-normal text-[#009598] border border-[#009598] px-3 py-[5px] rounded-full hover:bg-[#e8f7f7] transition-colors whitespace-nowrap">View</Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function DocumentsTab() {
  const DOCS = [
    { name: "Aadhaar Card", type: "ID Proof", date: "Registration" },
    { name: "Insurance Card", type: "Insurance", date: "Registration" },
    { name: "Previous Records", type: "Medical History", date: "Upload" },
  ];
  return (
    <div className="p-5 flex flex-col gap-3">
      {DOCS.map(d => (
        <div key={d.name} className="flex items-center justify-between p-4 border border-[#dedee1] rounded-[10px]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#f0f0f0] rounded-[8px] flex items-center justify-center">
              <FileText size={18} className="text-[#57575f]" />
            </div>
            <div>
              <span className="text-[14px] font-medium text-[#11111c] block">{d.name}</span>
              <span className="text-[12px] font-light text-[#57575f]">{d.type}</span>
            </div>
          </div>
          <button className="text-[12px] font-normal text-[#57575f] border border-[#dedee1] px-3 py-[5px] rounded-full hover:bg-[#f6f6f6] transition-colors">View</button>
        </div>
      ))}
      <button className="flex items-center justify-center gap-2 mt-2 border-2 border-dashed border-[#dedee1] rounded-[10px] py-4 text-[13px] font-normal text-[#57575f] hover:bg-[#f6f6f6] transition-colors">
        <Upload size={15} /> Upload Document
      </button>
    </div>
  );
}

function VaccinationsTab({ patientId }: { patientId: number }) {
  const vax = VACCINATIONS[patientId] ?? VACCINATIONS[1];
  return (
    <div className="p-5 overflow-x-auto">
      <div style={{ minWidth: 700 }}>
        <div className="relative h-10 bg-[#f2f3f3] rounded-t-[8px]">
          {[{ l: "Vaccine", x: 20 }, { l: "Dose", x: 300 }, { l: "Date", x: 440 }, { l: "Next Due", x: 600 }].map(c => (
            <span key={c.l} className="absolute top-1/2 -translate-y-1/2 text-[14px] font-medium text-[#11111c]" style={{ left: c.x }}>{c.l}</span>
          ))}
        </div>
        {vax.map((v, i) => (
          <div key={i} className="relative flex items-center h-[52px] border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa] transition-colors" style={{ minWidth: 700 }}>
            <span className="absolute text-[14px] font-normal text-[#11111c] whitespace-nowrap" style={{ left: 20 }}>{v.name}</span>
            <span className="absolute text-[13px] font-normal text-[#57575f]" style={{ left: 300 }}>{v.dose}</span>
            <span className="absolute text-[14px] font-normal text-[#11111c]" style={{ left: 440 }}>{v.date}</span>
            <span className="absolute text-[13px] font-normal text-[#57575f]" style={{ left: 600 }}>{v.next ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",      label: "Overview" },
  { id: "prescriptions", label: "Prescriptions" },
  { id: "lab",           label: "Lab Reports" },
  { id: "documents",     label: "Documents" },
  { id: "vaccinations",  label: "Vaccinations" },
];

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState("overview");
  const { item: patient, loading } = useItem<PatientDetail>(`/patients/${id}`);

  if (loading) {
    return (
      <div className={`${tw.gutterX} pt-10`}>
        <p className="text-[14px] font-normal text-[#57575f]">Loading patient…</p>
      </div>
    );
  }
  if (!patient) {
    return (
      <div className={`${tw.gutterX} pt-10`}>
        <p className="text-[14px] font-normal text-[#57575f]">Patient not found.</p>
      </div>
    );
  }

  const allergies = patient.allergies ?? [];
  const chronic = patient.chronicConditions ?? [];

  return (
    <>
      <div className={`${tw.gutterX} mb-4 pt-2`}>
        <Link href="/patients" className="inline-flex items-center gap-1 text-[13px] font-normal text-[#57575f] hover:text-[#11111c] transition-colors">
          <ChevronLeft size={15} /> Back to Patients
        </Link>
      </div>

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className="flex gap-5 items-start">
          {/* ── Left: Profile card ── */}
          <div className="flex flex-col gap-4 shrink-0" style={{ width: 280 }}>
            <div className={`${tw.surface.card} ${tw.radius.card} p-5 flex flex-col items-center gap-3`}>
              <div className="w-16 h-16 rounded-full bg-[#e8f7f7] flex items-center justify-center text-[24px] font-medium text-[#009598]">
                {patient.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div className="text-center">
                <p className="text-[16px] font-medium text-[#11111c]">{patient.name}</p>
                <p className="text-[12px] font-light text-[#57575f]">{patient.patientId}</p>
              </div>
              <StatusBadge status={patient.status} />
            </div>

            <div className={`${tw.surface.card} ${tw.radius.card} p-5 flex flex-col gap-3`}>
              {[
                { icon: Calendar,  label: "Age",         value: `${patient.age} years · ${patient.gender}` },
                { icon: Droplets,  label: "Blood Group", value: patient.bloodGroup ?? "—" },
                { icon: Phone,     label: "Phone",        value: patient.phone },
                { icon: MapPin,    label: "City",         value: patient.city ?? "—" },
              ].map(row => (
                <div key={row.label} className="flex items-start gap-3">
                  <row.icon size={14} className="text-[#57575f] mt-[3px] shrink-0" strokeWidth={1.5} />
                  <div>
                    <p className="text-[11px] font-normal text-[#57575f] uppercase tracking-wider">{row.label}</p>
                    <p className="text-[13px] font-normal text-[#11111c]">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className={`${tw.surface.card} ${tw.radius.card} p-5`}>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={14} className="text-[#ff0004]" strokeWidth={1.5} />
                <p className="text-[12px] font-medium text-[#ff0004] uppercase tracking-wider">Allergies</p>
              </div>
              {allergies.length === 0 ? (
                <p className="text-[12px] font-light text-[#57575f]">No known allergies</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {allergies.map(a => (
                    <span key={a} className="inline-flex px-[8px] py-[4px] bg-[#ffe9e9] text-[#ff0004] rounded-full text-[11px] font-normal">{a}</span>
                  ))}
                </div>
              )}
            </div>

            <div className={`${tw.surface.card} ${tw.radius.card} p-5`}>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck size={14} className="text-[#009598]" strokeWidth={1.5} />
                <p className="text-[12px] font-medium text-[#009598] uppercase tracking-wider">Chronic Conditions</p>
              </div>
              {chronic.length === 0 ? (
                <p className="text-[12px] font-light text-[#57575f]">No chronic conditions</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {chronic.map(c => (
                    <span key={c} className="inline-flex px-[8px] py-[4px] bg-[#e8f7f7] text-[#009598] rounded-full text-[11px] font-normal">{c}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Tabbed content ── */}
          <div className={`flex-1 ${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 580 }}>
            <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
            {tab === "overview"      && <OverviewTab patientId={patient.id} />}
            {tab === "prescriptions" && <PrescriptionsTab rxList={patient.prescriptions} />}
            {tab === "lab"           && <LabReportsTab tests={patient.labTests} />}
            {tab === "documents"     && <DocumentsTab />}
            {tab === "vaccinations"  && <VaccinationsTab patientId={patient.id} />}
          </div>
        </div>
      </div>
    </>
  );
}
