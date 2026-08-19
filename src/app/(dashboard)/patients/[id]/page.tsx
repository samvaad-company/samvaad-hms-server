"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { useItem, useList } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import { parseDisplayDate, formatDate } from "@/lib/dates";
import type { PatientDTO, PrescriptionDTO, LabTestDTO, RadiologyTestDTO, AppointmentDTO, OpdRecordDTO } from "@/types/api";
import { TabBar } from "@/components/shared/TabBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AbhaBadge } from "@/components/shared/AbhaBadge";
import { DocumentsPanel } from "@/components/shared/DocumentsPanel";
import { PatientIdCardModal } from "@/components/shared/PatientIdCardModal";
import {
  Phone, MapPin, Droplets, Calendar,
  FileText, Upload, ShieldCheck, AlertCircle, ScanLine,
} from "lucide-react";
import Link from "next/link";

type PatientDetail = PatientDTO & {
  prescriptions: PrescriptionDTO[];
  labTests: LabTestDTO[];
  radiologyTests: RadiologyTestDTO[];
};

// ─── Vaccination history (not yet captured in the database) ───────────────────

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

interface TimelineEvent {
  date: string;
  type: string;
  description: string;
  doctor: string;
  status: string;
  sort: number;
}

/**
 * Builds the visit timeline from the patient's real records — appointments,
 * OPD visits, prescriptions and lab tests — newest first.
 */
function OverviewTab({ patient }: { patient: PatientDetail }) {
  const { items: appointments } = useList<AppointmentDTO>("/appointments", {
    all: true, patient_id: patient.id,
  });
  const { items: opdVisits } = useList<OpdRecordDTO>("/opd", {
    all: true, patient_id: patient.id,
  });

  const TYPE_CLR: Record<string, string> = {
    "OPD Visit":     "bg-[#d6eaff] text-[#007cff]",
    "Lab Test":      "bg-[#e8f7f7] text-[#009598]",
    "Radiology":     "bg-[#ffe9d6] text-[#ff8a00]",
    "Prescription":  "bg-[#dffff3] text-[#00955c]",
    "Appointment":   "bg-[#ede9ff] text-[#6b4eff]",
  };

  const events: TimelineEvent[] = [
    ...appointments.map(a => ({
      date: a.date, type: "Appointment",
      description: a.reason || "Consultation",
      doctor: a.doctor, status: a.status,
      sort: parseDisplayDate(a.date)?.getTime() ?? 0,
    })),
    ...opdVisits.map(o => ({
      date: o.checkInTime, type: "OPD Visit",
      description: o.reason || `Token ${o.tokenNumber}`,
      doctor: o.doctor, status: o.status,
      sort: 0,
    })),
    ...patient.prescriptions.map(rx => ({
      date: rx.date, type: "Prescription",
      description: `${rx.diagnosis} — ${rx.medicineCount} medicines`,
      doctor: rx.doctor, status: rx.status,
      sort: parseDisplayDate(rx.date)?.getTime() ?? 0,
    })),
    ...patient.labTests.map(t => ({
      date: t.date, type: "Lab Test",
      description: t.labCenterName ? `${t.testName} · ${t.labCenterName}` : t.testName,
      doctor: patient.doctor, status: t.status,
      sort: parseDisplayDate(t.date)?.getTime() ?? 0,
    })),
    ...patient.radiologyTests.map(t => ({
      date: t.date, type: "Radiology",
      description: t.radiologyCenterName ? `${t.testName} · ${t.radiologyCenterName}` : t.testName,
      doctor: patient.doctor, status: t.status,
      sort: parseDisplayDate(t.date)?.getTime() ?? 0,
    })),
  ].sort((a, b) => b.sort - a.sort);

  return (
    <div className="p-5 flex flex-col gap-4">
      <h3 className="text-[14px] font-medium text-[#11111c]">Visit Timeline</h3>
      {events.length === 0 && (
        <p className="text-[13px] font-light text-[#57575f]">
          No visits, prescriptions or tests recorded for this patient yet.
        </p>
      )}
      <div className="flex flex-col">
        {events.map((event, i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center shrink-0">
              <div className="w-[10px] h-[10px] rounded-full bg-[#009598] mt-1" />
              {i < events.length - 1 && <div className="w-[1px] flex-1 bg-[#dedee1] mt-1" />}
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
            <span className="text-[12px] font-light text-[#57575f]">{rx.doctor} · {formatDate(rx.date)}</span>
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

// ─── Lab / Radiology reports (shared shape, split in-house vs third-party) ───

interface ReportItem {
  id: number;
  testName: string;
  date: string;
  reportStatus: string;
  status: string;
  /** Null when kept in-house; the routed-to center's name once routed out. */
  centerName: string | null;
  /** e.g. /lab/{id}/report — returns { fileUrl } for the uploaded document. */
  reportEndpoint: string;
}

/** Opens the uploaded report document itself in a new tab — not an in-app page. */
function ReportRow({ item }: { item: ReportItem }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function viewReport() {
    setOpening(true);
    setError(null);
    // Open the tab synchronously, in the same tick as the click, so popup
    // blockers still treat it as user-initiated — window.open() called
    // after the await below would otherwise get silently blocked. Deliberately
    // NOT passing the "noopener" feature here: requesting it makes window.open
    // return null (no reference given back either way), which would leave
    // this blank tab with nothing to navigate. Strip the opener reference by
    // hand instead, once we actually have the window.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    try {
      const file = await api.get<{ fileUrl: string }>(item.reportEndpoint);
      if (tab) tab.location.href = file.fileUrl;
      else window.open(file.fileUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : "Could not open report");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="flex items-center justify-between p-4 border border-[#dedee1] rounded-[10px]">
      <div className="flex flex-col gap-[4px]">
        <span className="text-[14px] font-medium text-[#11111c]">{item.testName}</span>
        <span className="text-[12px] font-light text-[#57575f]">
          {formatDate(item.date)}{item.centerName && <> · {item.centerName}</>}
        </span>
        {error && <span className="text-[11px] font-normal text-[#ff0004]">{error}</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className={`inline-flex px-[8px] py-[4px] rounded-full text-[11px] font-normal ${item.reportStatus === "Ready" ? "bg-[#dffff3] text-[#00955c]" : "bg-[#f0f0f0] text-[#57575f]"}`}>{item.reportStatus}</span>
        <StatusBadge status={item.status} />
        {item.reportStatus === "Ready" && (
          <button
            onClick={viewReport}
            disabled={opening}
            className="text-[12px] font-normal text-[#009598] border border-[#009598] px-3 py-[5px] rounded-full hover:bg-[#e8f7f7] transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {opening ? "Opening…" : "View"}
          </button>
        )}
      </div>
    </div>
  );
}

function ReportGroup({ title, items }: { title: string; items: ReportItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">{title} ({items.length})</span>
      <div className="flex flex-col gap-2">
        {items.map(item => <ReportRow key={item.id} item={item} />)}
      </div>
    </div>
  );
}

/** Splits into two clearly separate lists — in-house tests vs. ones routed to a third-party center. */
function ReportsSection({ items, emptyText }: { items: ReportItem[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-[13px] font-light text-[#57575f]">{emptyText}</p>;
  }
  const inHouse = items.filter(i => !i.centerName);
  const thirdParty = items.filter(i => i.centerName);
  return (
    <div className="flex flex-col gap-5">
      <ReportGroup title="In-house" items={inHouse} />
      <ReportGroup title="Third-Party" items={thirdParty} />
    </div>
  );
}

function LabReportsTab({ tests }: { tests: LabTestDTO[] }) {
  const items: ReportItem[] = tests.map(t => ({
    id: t.id,
    testName: t.testName,
    date: t.date,
    reportStatus: t.reportStatus,
    status: t.status,
    centerName: t.labCenterName,
    reportEndpoint: `/lab/${t.id}/report`,
  }));
  return (
    <div className="p-5">
      <ReportsSection items={items} emptyText="No lab tests on record." />
    </div>
  );
}

function RadiologyReportsTab({ tests }: { tests: RadiologyTestDTO[] }) {
  const items: ReportItem[] = tests.map(t => ({
    id: t.id,
    testName: t.testName,
    date: t.date,
    reportStatus: t.reportStatus,
    status: t.status,
    centerName: t.radiologyCenterName,
    reportEndpoint: `/radiology/${t.id}/report`,
  }));
  return (
    <div className="p-5">
      <ReportsSection items={items} emptyText="No radiology studies on record." />
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
  { id: "radiology",     label: "Radiology Reports" },
  { id: "documents",     label: "Documents" },
  { id: "vaccinations",  label: "Vaccinations" },
];

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState("overview");
  const [showIdCard, setShowIdCard] = useState(false);
  const { item: patient, loading } = useItem<PatientDetail>(`/patients/${id}`);
  useBreadcrumb("/patients", "Patients", patient?.name ?? "Patient Details");

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
      {showIdCard && <PatientIdCardModal patient={patient} onClose={() => setShowIdCard(false)} />}
      <div className={`${tw.gutterX} mb-[30px] pt-4`}>
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
              <button
                onClick={() => setShowIdCard(true)}
                className="w-full flex items-center justify-center gap-2 text-[12px] font-normal text-[#009598] border border-[#009598] px-3 py-[7px] rounded-full hover:bg-[#e8f7f7] transition-colors"
              >
                <ScanLine size={13} /> Print ID Card
              </button>
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
              <div className="border-t border-[#f0f0f0] pt-3">
                <AbhaBadge abhaId={patient.abhaId} variant="card" />
              </div>
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
            {tab === "overview"      && <OverviewTab patient={patient} />}
            {tab === "prescriptions" && <PrescriptionsTab rxList={patient.prescriptions} />}
            {tab === "lab"           && <LabReportsTab tests={patient.labTests} />}
            {tab === "radiology"     && <RadiologyReportsTab tests={patient.radiologyTests} />}
            {tab === "documents"     && <DocumentsPanel ownerType="patient" ownerId={patient.id} />}
            {tab === "vaccinations"  && <VaccinationsTab patientId={patient.id} />}
          </div>
        </div>
      </div>
    </>
  );
}
