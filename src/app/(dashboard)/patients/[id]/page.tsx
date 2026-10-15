"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { useItem, useList } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { parseDisplayDate, formatDate } from "@/lib/dates";
import type { PatientDTO, PrescriptionDTO, LabTestDTO, RadiologyTestDTO, AppointmentDTO, OpdRecordDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AbhaBadge } from "@/components/shared/AbhaBadge";
import { DocumentsPanel } from "@/components/shared/DocumentsPanel";
import { PatientIdCardModal } from "@/components/shared/PatientIdCardModal";
import {
  AlertCircle, Check, ChevronDown, ChevronLeft, Loader2, Copy, IdCard, ShieldCheck, Phone,
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
function VisitsTab({ patient }: { patient: PatientDetail }) {
  const { items: appointments } = useList<AppointmentDTO>("/appointments", {
    all: true, patient_id: patient.id,
  });
  const { items: opdVisits } = useList<OpdRecordDTO>("/opd", {
    all: true, patient_id: patient.id,
  });

  const TYPE_CLR: Record<string, string> = {
    "OPD Visit":     "bg-[#d6eaff] text-[#007cff]",
    "Lab Test":      "bg-[color:var(--brand-soft)] text-[color:var(--brand)]",
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
      <h3 className="text-[14px] font-medium text-[color:var(--ink)]">Visit Timeline</h3>
      {events.length === 0 && (
        <p className="text-[13px] font-light text-[color:var(--ink-soft)]">
          No visits, prescriptions or tests recorded for this patient yet.
        </p>
      )}
      <div className="flex flex-col">
        {events.map((event, i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center shrink-0">
              <div className="w-[10px] h-[10px] rounded-full bg-[color:var(--brand)] mt-1" />
              {i < events.length - 1 && <div className="w-[1px] flex-1 bg-[color:var(--line)] mt-1" />}
            </div>
            <div className="flex-1 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-[4px]">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-[8px] py-[3px] rounded-full text-[11px] font-normal ${TYPE_CLR[event.type] ?? "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]"}`}>{event.type}</span>
                    <StatusBadge status={event.status} />
                  </div>
                  <span className="text-[13px] font-normal text-[color:var(--ink)]">{event.description}</span>
                  <span className="text-[12px] font-light text-[color:var(--ink-soft)]">{event.doctor}</span>
                </div>
                <span className="text-[12px] font-light text-[color:var(--ink-soft)] whitespace-nowrap">{event.date}</span>
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
        <p className="text-[13px] font-light text-[color:var(--ink-soft)]">No prescriptions on record.</p>
      )}
      {rxList.map(rx => (
        <div key={rx.id} className="flex items-center justify-between p-4 border border-[color:var(--line)] rounded-[10px]">
          <div className="flex flex-col gap-[4px]">
            <span className="text-[14px] font-medium text-[color:var(--ink)]">{rx.rxNumber}</span>
            <span className="text-[12px] font-light text-[color:var(--ink-soft)]">{rx.doctor} · {formatDate(rx.date)}</span>
            <span className="text-[12px] font-normal text-[color:var(--ink-soft)]">{rx.medicineCount} medicines · {rx.diagnosis}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={rx.status} />
            <Link href={`/prescriptions/${rx.id}`} className="text-[12px] font-normal text-[color:var(--brand)] border border-[color:var(--brand)] px-3 py-[5px] rounded-full hover:bg-[color:var(--brand-soft)] transition-colors whitespace-nowrap">
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
    <div className="flex items-center justify-between p-4 border border-[color:var(--line)] rounded-[10px]">
      <div className="flex flex-col gap-[4px]">
        <span className="text-[14px] font-medium text-[color:var(--ink)]">{item.testName}</span>
        <span className="text-[12px] font-light text-[color:var(--ink-soft)]">
          {formatDate(item.date)}{item.centerName && <> · {item.centerName}</>}
        </span>
        {error && <span className="text-[11px] font-normal text-[#ff0004]">{error}</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className={`inline-flex px-[8px] py-[4px] rounded-full text-[11px] font-normal ${item.reportStatus === "Ready" ? "bg-[#dffff3] text-[#00955c]" : "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]"}`}>{item.reportStatus}</span>
        <StatusBadge status={item.status} />
        {item.reportStatus === "Ready" && (
          <button
            onClick={viewReport}
            disabled={opening}
            className="text-[12px] font-normal text-[color:var(--brand)] border border-[color:var(--brand)] px-3 py-[5px] rounded-full hover:bg-[color:var(--brand-soft)] transition-colors whitespace-nowrap disabled:opacity-50"
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
      <span className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">{title} ({items.length})</span>
      <div className="flex flex-col gap-2">
        {items.map(item => <ReportRow key={item.id} item={item} />)}
      </div>
    </div>
  );
}

/** Splits into two clearly separate lists — in-house tests vs. ones routed to a third-party center. */
function ReportsSection({ items, emptyText }: { items: ReportItem[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-[13px] font-light text-[color:var(--ink-soft)]">{emptyText}</p>;
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
        <div className="relative h-10 bg-[color:var(--subtle-3)] rounded-t-[8px]">
          {[{ l: "Vaccine", x: 20 }, { l: "Dose", x: 300 }, { l: "Date", x: 440 }, { l: "Next Due", x: 600 }].map(c => (
            <span key={c.l} className="absolute top-1/2 -translate-y-1/2 text-[14px] font-medium text-[color:var(--ink)]" style={{ left: c.x }}>{c.l}</span>
          ))}
        </div>
        {vax.map((v, i) => (
          <div key={i} className="relative flex items-center h-[52px] border-b border-[color:var(--subtle-2)] last:border-0 hover:bg-[color:var(--faint)] transition-colors" style={{ minWidth: 700 }}>
            <span className="absolute text-[14px] font-normal text-[color:var(--ink)] whitespace-nowrap" style={{ left: 20 }}>{v.name}</span>
            <span className="absolute text-[13px] font-normal text-[color:var(--ink-soft)]" style={{ left: 300 }}>{v.dose}</span>
            <span className="absolute text-[14px] font-normal text-[color:var(--ink)]" style={{ left: 440 }}>{v.date}</span>
            <span className="absolute text-[13px] font-normal text-[color:var(--ink-soft)]" style={{ left: 600 }}>{v.next ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Header, tabs, overview ───────────────────────────────────────────────────

/** Registration forms often store "none" / "NKDA" when there is nothing to record — that isn't an allergy or condition. */
const NOTHING = /^(none|nil|no|na|n\/a|nkda|nka|-|—)\.?$/i;
const recorded = (items: string[] | undefined) => (items ?? []).filter(i => i.trim() && !NOTHING.test(i.trim()));

/** "45y 10mo" from a date of birth; falls back to the stored age. */
function ageLabel(dob: string | null, age: number, now: number, ageMonths?: number | null): string {
  const d = dob ? new Date(dob) : null;
  if (!d || Number.isNaN(d.getTime())) return ageMonths ? `${age}y ${ageMonths}mo` : `${age} yrs`;
  const n = new Date(now);
  let months = (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth());
  if (n.getDate() < d.getDate()) months--;
  if (months < 0) return `${age} yrs`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return y > 0 ? `${y}y${m ? ` ${m}mo` : ""}` : `${m}mo`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); } catch { /* clipboard unavailable */ }
      }}
      className="text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] transition-colors cursor-pointer"
    >
      {done ? <Check size={13} className="text-[#00955c]" /> : <Copy size={13} strokeWidth={1.5} />}
    </button>
  );
}

function Field({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div className={`flex flex-col gap-[2px] ${wide ? "col-span-2" : ""}`}>
      <span className="text-[12px] font-light text-[color:var(--ink-soft)]">{label}</span>
      <span className="text-[14px] font-normal text-[color:var(--ink)] break-words">{value && value.trim() ? value : "—"}</span>
    </div>
  );
}

const DAY = 86_400_000;
const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-[2px] min-w-[110px]">
      <span className="text-[12px] font-light text-[color:var(--ink-soft)]">{label}</span>
      <span className="text-[15px] font-medium text-[color:var(--ink)]">{value}</span>
      {sub && <span className="text-[11px] font-light text-[color:var(--ink-soft)]">{sub}</span>}
    </div>
  );
}

/** Visit counts and dates, worked out from the patient's own appointments. */
function EngagementCard({ appointments, now }: { appointments: AppointmentDTO[]; now: number }) {
  const stats = useMemo(() => {
    const today = new Date(now).toLocaleDateString("en-CA");
    const yearAgo = new Date(now - 365 * DAY).toLocaleDateString("en-CA");
    const done = appointments.filter(a => a.status === "Completed").sort((a, b) => a.date.localeCompare(b.date));
    const upcoming = appointments
      .filter(a => (a.status === "Upcoming" || a.status === "Today") && a.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    const lastYear = appointments.filter(a => a.date >= yearAgo && a.date <= today);
    const cancelled = lastYear.filter(a => a.status === "Cancelled").length;
    const last = done[done.length - 1];
    return {
      visits: done.length,
      visitsLastYear: done.filter(a => a.date >= yearAgo).length,
      last, first: done[0], upcoming, cancelled, lastYearTotal: lastYear.length,
      active: done.some(a => a.date >= yearAgo) || upcoming.length > 0,
      daysAgo: last ? Math.max(0, Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${last.date}T00:00:00`).getTime()) / DAY)) : null,
    };
  }, [appointments, now]);

  return (
    <div className="border border-[color:var(--line)] rounded-[12px] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[color:var(--subtle-2)]">
        <span className="text-[14px] font-medium text-[color:var(--ink)]">Engagement</span>
        <span className={`inline-flex px-2 py-[2px] rounded-full text-[11px] font-normal ${stats.active ? "bg-[#dffff3] text-[#00955c]" : "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]"}`}>
          {stats.active ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-4 px-4 py-4">
        <Stat label="Visits" value={String(stats.visits)} sub={`${stats.visitsLastYear} in the last 12 months`} />
        <Stat label="Last visit" value={stats.last ? formatDate(stats.last.date) : "—"} sub={stats.daysAgo != null ? (stats.daysAgo === 0 ? "today" : `${stats.daysAgo} day${stats.daysAgo === 1 ? "" : "s"} ago`) : undefined} />
        <Stat label="First visit" value={stats.first ? formatDate(stats.first.date) : "—"} />
        <Stat label="Cancelled (12 months)" value={`${stats.cancelled} of ${stats.lastYearTotal}`} />
        <Stat label="Next booking" value={stats.upcoming[0] ? formatDate(stats.upcoming[0].date) : "—"} sub={stats.upcoming[0] ? `${stats.upcoming[0].time} · ${stats.upcoming[0].doctor}` : undefined} />
      </div>
      {stats.upcoming.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-[color:var(--subtle-2)] bg-[color:var(--faint)]">
          {stats.upcoming.slice(0, 4).map(a => (
            <Link key={a.id} href={`/appointments/${a.id}`}
              className="inline-flex px-3 py-[4px] rounded-[8px] border border-[#b6e8cf] bg-[#effcf5] text-[12px] font-normal text-[#00955c] hover:bg-[#dffff3] transition-colors">
              {shortDay(a.date)} · {a.time} · {a.doctor}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[12px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">{title}</h3>
      <div className="grid grid-cols-2 gap-x-10 gap-y-5 px-1">{children}</div>
    </div>
  );
}

function OverviewTab({ patient, now }: { patient: PatientDetail; now: number }) {
  const { items: appointments } = useList<AppointmentDTO>("/appointments", { all: true, patient_id: patient.id });
  const address = [patient.address, patient.city, patient.state, patient.pincode].filter(Boolean).join(", ");
  const emergency = [patient.emergencyName, patient.emergencyRelation && `(${patient.emergencyRelation})`, patient.emergencyPhone].filter(Boolean).join(" ");
  const insurance = [patient.insurer, patient.policyNumber && `Policy ${patient.policyNumber}`].filter(Boolean).join(" · ");
  const coverage = patient.payers
    .map(p => [p.type, p.name, p.policyNumber && `Policy ${p.policyNumber}`, p.validUntil && `valid till ${formatDate(p.validUntil)}`].filter(Boolean).join(" · "))
    .join("  |  ");

  return (
    <div className="p-5 flex flex-col gap-5">
      <EngagementCard appointments={appointments} now={now} />
      <Group title="Personal">
        <Field label="Title" value={patient.title} />
        <Field label="Date of birth" value={patient.dob ? formatDate(patient.dob) : null} />
        <Field label="Gender" value={patient.gender} />
        <Field label="Blood group" value={patient.bloodGroup} />
        <Field label="Marital status" value={patient.maritalStatus} />
        <Field label="Anniversary" value={patient.anniversary ? formatDate(patient.anniversary) : null} />
        <Field label="Religion" value={patient.religion} />
        <Field label="Language" value={patient.language} />
        <Field label="Nationality" value={patient.nationality} />
        <Field label="Education" value={patient.education} />
        <Field label="Guardian" value={patient.guardianName} />
        <Field label="Care of (C/O)" value={patient.careOf} />
        <div className="flex flex-col gap-[2px]">
          <span className="text-[12px] font-light text-[color:var(--ink-soft)]">ABHA ID</span>
          <AbhaBadge abhaId={patient.abhaId} variant="inline" />
        </div>
        <Field label="How they came" value={patient.referralSource} />
        <Field label="Chronic conditions" value={recorded(patient.chronicConditions).join(", ")} />
      </Group>

      <Group title="Contact & address">
        <Field label="Mobile" value={patient.phone} />
        <Field label="Alternate mobile" value={patient.alternatePhone} />
        <Field label="Email" value={patient.email} />
        <Field label="Emergency contact" value={emergency} />
        <Field label="Address" value={address} wide />
      </Group>

      <Group title="Work & payer">
        <Field label="Occupation" value={patient.occupation} />
        <Field label="Employer" value={patient.employer} />
        <Field label="Designation" value={patient.designation} />
        <Field label="Work phone" value={patient.workPhone} />
        <Field label="Privilege card no." value={patient.privilegeCardNo} />
        <Field label="Corporate" value={patient.corporate} />
        <Field label="Coverage" wide value={coverage || insurance} />
      </Group>

      {(patient.identityDocuments.length > 0 || patient.covid || patient.notes || patient.medicoLegal || patient.temporary || patient.dataConsent) && (
        <Group title="Other">
          {patient.identityDocuments.length > 0 && <Field label="Identity documents" wide value={patient.identityDocuments.map(d => `${d.type} ••••${d.last4}`).join(" · ")} />}
          {patient.covid && <Field label="COVID" wide value={[patient.covid.vaccination, patient.covid.lastDose && `last dose ${formatDate(patient.covid.lastDose)}`, patient.covid.infectedBefore && "had COVID before"].filter(Boolean).join(" · ")} />}
          <Field label="Flags" wide value={[patient.medicoLegal && "Medico-legal case", patient.temporary && "Temporary record", patient.dataConsent && "Data-processing consent given"].filter(Boolean).join(" · ")} />
          <Field label="Notes" wide value={patient.notes} />
        </Group>
      )}
    </div>
  );
}

function MedicalHistoryTab({ patient }: { patient: PatientDetail }) {
  const allergies = recorded(patient.allergies);
  const chronic = recorded(patient.chronicConditions);
  return (
    <div className="flex flex-col">
      <div className="p-5 grid grid-cols-2 gap-5 border-b border-[color:var(--subtle-2)]">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={14} className="text-[#ff0004]" strokeWidth={1.5} />
            <p className="text-[12px] font-medium text-[#ff0004] uppercase tracking-wider">Allergies</p>
          </div>
          {allergies.length === 0 ? <p className="text-[13px] font-light text-[color:var(--ink-soft)]">No known allergies</p> : (
            <div className="flex flex-wrap gap-1">
              {allergies.map(a => <span key={a} className="inline-flex px-[8px] py-[4px] bg-[#ffe9e9] text-[#ff0004] rounded-full text-[12px]">{a}</span>)}
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={14} className="text-[color:var(--brand)]" strokeWidth={1.5} />
            <p className="text-[12px] font-medium text-[color:var(--brand)] uppercase tracking-wider">Chronic conditions</p>
          </div>
          {chronic.length === 0 ? <p className="text-[13px] font-light text-[color:var(--ink-soft)]">No chronic conditions</p> : (
            <div className="flex flex-wrap gap-1">
              {chronic.map(c => <span key={c} className="inline-flex px-[8px] py-[4px] bg-[color:var(--brand-soft)] text-[color:var(--brand)] rounded-full text-[12px]">{c}</span>)}
            </div>
          )}
        </div>
      </div>
      <div className="px-5 pt-4 text-[12px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Prescriptions</div>
      <PrescriptionsTab rxList={patient.prescriptions} />
    </div>
  );
}

function VitalsTab({ patientId }: { patientId: number }) {
  const { items: visits } = useList<OpdRecordDTO>("/opd", { all: true, patient_id: patientId });
  const withVitals = visits.filter(v => v.vitalsRecorded).sort((a, b) => b.id - a.id);
  if (withVitals.length === 0) {
    return <p className="p-5 text-[13px] font-light text-[color:var(--ink-soft)]">No vitals recorded for this patient yet.</p>;
  }
  const cell = (v: number | null, unit = "") => (v == null ? "—" : `${v}${unit}`);
  return (
    <div className="p-5 flex flex-col gap-3">
      {withVitals.map(v => (
        <div key={v.id} className="border border-[color:var(--line)] rounded-[10px] p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-medium text-[color:var(--ink)]">{v.tokenNumber} · {v.doctor}</span>
            <span className="text-[12px] font-light text-[color:var(--ink-soft)]">{v.checkInTime}</span>
          </div>
          <div className="grid grid-cols-5 gap-4">
            <Field label="Blood pressure" value={v.vitals.bpSystolic != null ? `${v.vitals.bpSystolic}/${cell(v.vitals.bpDiastolic)} mmHg` : null} />
            <Field label="Pulse" value={v.vitals.pulse != null ? `${v.vitals.pulse} bpm` : null} />
            <Field label="Temperature" value={v.vitals.temperature != null ? `${v.vitals.temperature} °F` : null} />
            <Field label="SpO₂" value={v.vitals.spo2 != null ? `${v.vitals.spo2}%` : null} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const MAIN_TABS = [
  { id: "overview", label: "Overview" },
  { id: "documents", label: "Documents" },
  { id: "history", label: "Medical history" },
  { id: "visits", label: "Visits" },
  { id: "vitals", label: "Vitals" },
];
const MORE_TABS = [
  { id: "lab", label: "Lab reports" },
  { id: "radiology", label: "Radiology reports" },
  { id: "vaccinations", label: "Vaccinations" },
];

/** Pill-style tab strip with a "More" menu for the less-used tabs. */
function PatientTabs({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const inMore = MORE_TABS.find(t => t.id === active);
  const pill = (on: boolean) =>
    `px-4 py-[7px] rounded-[8px] text-[14px] whitespace-nowrap transition-colors cursor-pointer ${on ? "bg-[color:var(--surface)] text-[color:var(--ink)] font-medium shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"}`;
  return (
    <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[color:var(--subtle-2)] rounded-[10px] relative" role="tablist">
      {MAIN_TABS.map(t => (
        <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => onChange(t.id)} className={pill(active === t.id)}>{t.label}</button>
      ))}
      <div className="relative">
        <button role="tab" aria-selected={!!inMore} onClick={() => setMoreOpen(o => !o)} className={`${pill(!!inMore)} inline-flex items-center gap-1`}>
          {inMore ? inMore.label : "More"} <ChevronDown size={14} />
        </button>
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
            <div className="absolute right-0 top-[40px] z-50 min-w-[190px] bg-[color:var(--surface)] rounded-[10px] border border-[color:var(--line)] shadow-lg py-1">
              {MORE_TABS.map(t => (
                <button key={t.id} onClick={() => { onChange(t.id); setMoreOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-[13px] hover:bg-[color:var(--subtle)] cursor-pointer ${active === t.id ? "text-[color:var(--brand)] font-medium" : "text-[color:var(--ink)]"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState("overview");
  const [showIdCard, setShowIdCard] = useState(false);
  const [now] = useState(() => Date.now());
  const { item: patient, loading } = useItem<PatientDetail>(`/patients/${id}`);

  if (loading) {
    // Only this panel loads: the tab strip stays where it is, the rest shows placeholders.
    return (
      <div className="p-5 flex flex-col gap-4" aria-busy="true">
        <div className={`${tw.surface.card} ${tw.radius.card} px-6 py-5 flex items-center gap-4 animate-pulse`}>
          <div className="w-12 h-12 rounded-full bg-[color:var(--subtle-2)] shrink-0" />
          <div className="flex-1 flex flex-col gap-3">
            <div className="h-5 w-56 rounded bg-[color:var(--subtle-2)]" />
            <div className="h-3 w-40 rounded bg-[color:var(--subtle-2)]" />
            <div className="h-3 w-32 rounded bg-[color:var(--subtle-2)]" />
          </div>
        </div>
        <PatientTabs active={tab} onChange={setTab} />
        <div className={`${tw.surface.card} ${tw.radius.card} flex items-center justify-center`} style={{ minHeight: 420 }}>
          <div className="flex flex-col items-center gap-3 text-[color:var(--ink-soft)]">
            <Loader2 size={30} strokeWidth={1.5} className="animate-spin text-[color:var(--brand)]" />
            <span className="text-[13px]">Loading patient…</span>
          </div>
        </div>
      </div>
    );
  }
  if (!patient) {
    return (
      <div className="p-6">
        <p className="text-[14px] font-normal text-[color:var(--ink-soft)]">Patient not found.</p>
      </div>
    );
  }

  const allergies = recorded(patient.allergies);
  const initials = patient.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const summary = [ageLabel(patient.dob, patient.age, now, patient.ageMonths), patient.gender, patient.bloodGroup].filter(Boolean).join(" · ");

  return (
    <>
      {showIdCard && <PatientIdCardModal patient={patient} onClose={() => setShowIdCard(false)} />}
      <div className="p-5 flex flex-col gap-4">
        <div className="md:hidden">
          <Link href="/patients" className="inline-flex items-center gap-1 text-[13px] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]">
            <ChevronLeft size={15} /> All patients
          </Link>
        </div>
        {/* ── Identity header ── */}
        <div className={`${tw.surface.card} ${tw.radius.card} px-6 py-5 flex items-start gap-4`}>
          <div className="w-12 h-12 rounded-full bg-[color:var(--brand-soft)] flex items-center justify-center text-[16px] font-medium text-[color:var(--brand)] shrink-0">{initials}</div>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[20px] font-medium text-[color:var(--ink)] leading-tight">{patient.name}</h1>
              {patient.patientId && (
                <span className="inline-flex items-center gap-2 text-[14px] font-mono text-[color:var(--ink-soft)]">
                  {patient.patientId} <CopyButton text={patient.patientId} label="Copy patient ID" />
                </span>
              )}
              <StatusBadge status={patient.status} />
            </div>
            <div className="text-[14px] font-normal text-[color:var(--ink-soft)]">{summary}</div>
            <div className="flex items-center gap-2 text-[13px] text-[color:var(--ink-soft)]">
              <Phone size={13} strokeWidth={1.5} /> {patient.phone} <CopyButton text={patient.phone} label="Copy phone number" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {allergies.length > 0 ? (
                <span className="inline-flex items-center gap-[6px] px-3 py-[4px] rounded-[8px] border border-[#ffc9c9] bg-[#fff3f3] text-[12px] text-[#ff0004]">
                  <AlertCircle size={13} strokeWidth={1.5} /> Allergies documented · {allergies.join(", ")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-[6px] px-3 py-[4px] rounded-[8px] border border-[color:var(--line)] text-[12px] text-[color:var(--ink-soft)]">No known allergies</span>
              )}
            </div>
          </div>
          <button onClick={() => setShowIdCard(true)}
            className="inline-flex items-center gap-2 text-[13px] font-normal text-[color:var(--ink)] border border-[color:var(--line)] px-4 py-[8px] rounded-[10px] hover:bg-[color:var(--subtle)] transition-colors cursor-pointer shrink-0">
            <IdCard size={15} strokeWidth={1.5} /> Patient card
          </button>
        </div>

        {/* ── Tabs + content ── */}
        <PatientTabs active={tab} onChange={setTab} />
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 420 }}>
          {tab === "overview"     && <OverviewTab patient={patient} now={now} />}
          {tab === "documents"    && <DocumentsPanel ownerType="patient" ownerId={patient.id} />}
          {tab === "history"      && <MedicalHistoryTab patient={patient} />}
          {tab === "visits"       && <VisitsTab patient={patient} />}
          {tab === "vitals"       && <VitalsTab patientId={patient.id} />}
          {tab === "lab"          && <LabReportsTab tests={patient.labTests} />}
          {tab === "radiology"    && <RadiologyReportsTab tests={patient.radiologyTests} />}
          {tab === "vaccinations" && <VaccinationsTab patientId={patient.id} />}
        </div>
      </div>
    </>
  );
}
