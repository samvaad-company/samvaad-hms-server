"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { printElement, downloadElement, shareDocument } from "@/lib/print";
import { hospitalAddress, useHospital } from "@/components/shared/DocumentLetterhead";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import { ConsultationView, hasConsultation } from "@/components/consultation/ConsultationView";
import { AiReviewCard } from "@/components/prescriptions/AiReviewCard";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import type { DoctorDTO, PrescriptionDTO, RxAiReviewDTO, RxFindingSeverity } from "@/types/api";
import { durationLabel, remarksOf, toPattern } from "@/lib/prescriptions/remarks";
import { filledFields, bmiOf } from "@/lib/consultation/templates";
import { ArrowLeft, Pill, Printer, Download, QrCode, HelpCircle, ChevronDown } from "lucide-react";
import { PatientName } from "@/components/loyalty/PatientName";

const SEVERITY_TAG: Record<RxFindingSeverity, string> = {
  critical: "bg-[#ffe3e5] text-[#b3001b] border-[#f4a3ac]",
  warning: "bg-[#fff2d6] text-[#8a5300] border-[#f3cf7d]",
  info: "bg-[color:var(--subtle)] text-[color:var(--ink-soft)] border-[color:var(--line)]",
};
const SEVERITY_RANK: Record<RxFindingSeverity, number> = { critical: 0, warning: 1, info: 2 };

function allergyList(text: string | null | undefined): string[] {
  return (text ?? "").split(/[,;/\n]+/).map((s) => s.trim()).filter((s) => s && !/^(none|nil|no|nka|nkda|n\/a|na|not assessed|unknown)$/i.test(s));
}


// ─── The sheet that is printed and shared with the patient ───────────────────

/**
 * The sheet becomes a PDF by taking a picture of it, and that cannot read modern CSS colours (color-mix, variables), so the sheet is
 * painted in plain hex colours: the hospital's brand colour is read once and its pale tint worked out here.
 */
function useSheetColors() {
  const [brand, setBrand] = useState("#009598");
  useEffect(() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--brand-base").trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) setBrand(v);
  }, []);
  const mix = (hex: string, w: number) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * w + 255 * (1 - w)).toString(16).padStart(2, "0")).join("");
  return { brand, soft: mix(brand, 0.09), line: "#e2e5ea", ink: "#11111c", inkSoft: "#6b7280" };
}

const headOf = (color: string) => ({ color, fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }) as const;

function Bullets({ items }: { items: string[] }) {
  return <>{items.map((t, i) => <p key={i} style={{ margin: "1px 0 1px 12px", fontSize: 11.5 }}>-&nbsp;&nbsp;{t}</p>)}</>;
}

const PrescriptionSheet = forwardRef<HTMLDivElement, { rx: PrescriptionDTO; hospital: ReturnType<typeof useHospital>; doctor: DoctorDTO | null; allergies: string[] }>(function PrescriptionSheet({ rx, hospital, doctor, allergies }, ref) {
  const k = useSheetColors();
  const head = headOf(k.brand);
  const c = rx.consultation && rx.consultation.vitals ? rx.consultation : null;
  const v = c?.vitals;
  const vitals = v ? [
    v.pulse && `PULSE RATE - ${v.pulse}/min`, v.spo2 && `PERIPHERAL OXYGEN SATURATION - ${v.spo2}%`,
    v.bp && `BLOOD PRESSURE - ${v.bp}mmHg`, v.temp && `TEMPERATURE - ${v.temp}°F`,
    v.weight && `WEIGHT - ${v.weight}kg`, v.height && `HEIGHT - ${v.height}cm`, bmiOf(v.weight, v.height) && `BMI - ${bmiOf(v.weight, v.height)}`,
  ].filter(Boolean) as string[] : [];
  const history = c ? ([["Past", c.history.past], ["Family", c.history.family], ["Personal", c.history.personal], ["Medical", c.history.medical]] as const).filter(([, t]) => t.trim()).map(([k, t]) => `${k}: ${t}`) : [];
  const exam = c ? [
    ...filledFields(c.general ?? []).map((f) => `${f.label}: ${f.value}`),
    ...(c.systemic ?? []).flatMap((s2) => { const f = filledFields(s2.fields); return f.length ? [`${s2.title}: ${f.map((x) => `${x.label} ${x.value}`).join(", ")}`] : []; }),
  ] : [];
  const findings = [...(c?.chiefComplaint.trim() ? c.chiefComplaint.split("\n").filter(Boolean) : []), ...exam];
  const diagnoses = [...rx.diagnosis.split(";").map((x) => x.trim()).filter(Boolean), ...(c?.secondaryDiagnosis.trim() ? c.secondaryDiagnosis.split(";").map((x) => x.trim()).filter(Boolean).map((x) => `${x} (secondary)`) : [])];
  const advice = c ? [c.advice.diet && `Diet: ${c.advice.diet}`, c.advice.exercise && `Exercise: ${c.advice.exercise}`, c.advice.other].filter(Boolean) as string[] : [];
  const when = rx.createdAt ? new Date(rx.createdAt) : null;
  const dateText = when ? `${String(when.getDate()).padStart(2, "0")}/${String(when.getMonth() + 1).padStart(2, "0")}/${when.getFullYear()}, ${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}` : formatDate(rx.date);
  const doctorName = rx.doctor || doctor?.name || "";
  const address = hospitalAddress(hospital);
  const th = { border: `1px solid ${k.brand}`, height: 32, lineHeight: "32px", padding: "0 8px", fontSize: 12, fontWeight: 700, textAlign: "center", verticalAlign: "middle", background: k.soft, color: k.brand } as const;
  const td = { border: `1px solid ${k.line}`, padding: "8px 10px", fontSize: 11.5, verticalAlign: "top" } as const;

  return (
    <div ref={ref} style={{ background: "#fff", color: "#11111c", width: "100%", maxWidth: 980, aspectRatio: "210 / 297", margin: "0 auto", display: "flex", flexDirection: "column", boxShadow: `0 0 0 1px ${k.line}`, fontFamily: "Arial, Helvetica, sans-serif" }}>
      {/* Letterhead: the hospital on the left, the doctor on the right */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "18px 28px 12px", borderBottom: `2px solid ${k.brand}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          {hospital.logoUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={hospital.logoUrl} alt="" style={{ width: 54, height: 54, objectFit: "contain" }} />}
          <div>
            <p style={{ fontSize: 22, fontWeight: 700, color: k.brand, margin: 0 }}>{hospital.name || "Hospital"}</p>
            {address && <p style={{ fontSize: 10.5, margin: "2px 0 0", color: "#333" }}>{address}</p>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: k.brand, margin: 0 }}>{doctorName}</p>
          {doctor?.specialty && <p style={{ fontSize: 10.5, margin: "2px 0 0" }}>{doctor.specialty}</p>}
          {doctor?.phone && <p style={{ fontSize: 10.5, margin: 0 }}>{doctor.phone}</p>}
        </div>
      </div>
      <div style={{ background: k.soft, height: 30, lineHeight: "30px", padding: "0 28px", fontSize: 11, textAlign: "center", color: k.ink, borderBottom: `1px solid ${k.line}` }}>
        {[hospital.phone && `Contact: ${hospital.phone}`, hospital.email].filter(Boolean).join("   |   ")}
      </div>

      <div style={{ padding: "16px 28px 0", flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <p style={{ margin: 0 }}><b><i>{rx.patientName}</i></b>,&nbsp; <i>{rx.patient?.gender ?? ""}</i>,&nbsp; <i>{rx.patientAge} year(s)</i>{rx.patient?.phone ? <>,&nbsp; <i>{rx.patient.phone}</i></> : null}</p>
          <p style={{ margin: 0 }}><b><i>{dateText}</i></b></p>
        </div>
        {rx.patient?.code && <p style={{ margin: "2px 0 8px", fontSize: 11 }}><b>UHID</b> &nbsp;:&nbsp; {rx.patient.code}</p>}
        {allergies.length > 0 && <p style={{ margin: "0 0 6px", fontSize: 11, color: "#b3001b" }}><b>ALLERGIES :</b> {allergies.join(", ")}</p>}

        {vitals.length > 0 && <p style={{ margin: "6px 0", fontSize: 11 }}><span style={head}>Vitals :</span>&nbsp;&nbsp;{vitals.join("   |   ")}</p>}
        {history.length > 0 && <><p style={{ ...head, margin: "8px 0 2px" }}>Past and family history :</p><Bullets items={history} /></>}
        {(findings.length > 0 || diagnoses.length > 0) && <><p style={{ ...head, margin: "8px 0 2px" }}>Significant history, examination, reports, diagnosis :</p><Bullets items={[...findings, ...diagnoses.map((d) => `DIAGNOSIS - ${d}`)]} /></>}
        {c && c.investigations.length > 0 && <><p style={{ ...head, margin: "8px 0 2px" }}>Investigations :</p><Bullets items={c.investigations} /></>}
        {advice.length > 0 && <><p style={{ ...head, margin: "8px 0 2px" }}>Advice :</p><Bullets items={advice} /></>}

        <p style={{ textAlign: "center", color: k.brand, fontWeight: 700, letterSpacing: 1, fontSize: 13, margin: "18px 0 8px" }}>PRESCRIPTION</p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={{ ...th, width: "36%" }}>Medications</th><th style={{ ...th, width: "14%" }}>Frequency</th><th style={{ ...th, width: "11%" }}>Duration</th><th style={th}>Remarks</th>
          </tr></thead>
          <tbody>
            {rx.items.map((m, i) => {
              const r = remarksOf(m);
              return (
                <tr key={m.id}>
                  <td style={td}>
                    <b>{i + 1}&nbsp; {m.medicineName}</b>
                    {m.generic && <div style={{ fontSize: 10.5 }}>{m.generic}{m.dosage && !m.medicineName.toLowerCase().includes(m.dosage.toLowerCase()) ? ` (${m.dosage})` : ""}</div>}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}><b>{toPattern(m.frequency) || "-"}</b>{m.timing && <div style={{ fontSize: 10.5 }}>{m.timing}</div>}</td>
                  <td style={{ ...td, textAlign: "center" }}>{durationLabel(m.duration)}</td>
                  <td style={td}>{r.line}{r.special && <div style={{ marginTop: 2 }}>{r.special}</div>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {c?.followUp && <p style={{ margin: "10px 0 0", fontSize: 11 }}><span style={head}>Followup :</span>&nbsp; Visit on <b>{formatDate(c.followUp)}</b></p>}
      </div>

      <div style={{ padding: "26px 28px 10px", fontSize: 10.5 }}>
        <p style={{ margin: 0 }}>Not valid for Medico Legal Purpose</p>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <b>{rx.rxNumber}</b><b>{doctorName}</b>
        </div>
        <p style={{ margin: "4px 0 0", fontSize: 9, color: "#444" }}>PRESCRIPTION AUTHORIZED BY {doctorName.toUpperCase()} ON {dateText}   (THIS IS A COMPUTER GENERATED REPORT. SIGNATURE IS NOT REQUIRED.)</p>
      </div>
      <div style={{ borderTop: `1px solid ${k.line}`, padding: "8px 28px", fontSize: 9.5, color: k.inkSoft }}>
        • Inform about any allergies.  • Take prescribed medicines only for prescribed duration.  • Bring this paper in every visit.  • Inform about all past and family history &amp; habits.
      </div>
      <div style={{ background: k.brand, color: "#fff", textAlign: "center", height: 30, lineHeight: "30px", padding: "0 28px", fontSize: 10.5 }}>
        <b>{hospital.name}</b>{address ? ` · ${address}` : ""}{hospital.phone ? ` · Call for appointment: ${hospital.phone}` : ""}
      </div>
    </div>
  );
});

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrescriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { item: rx, loading, reload } = useItem<PrescriptionDTO>(`/prescriptions/${id}`);
  const { item: doctor } = useItem<DoctorDTO>(rx?.doctorId ? `/doctors/${rx.doctorId}` : null);
  useBreadcrumb("/prescriptions", "Prescriptions", rx?.rxNumber ?? "Prescription");
  const docRef = useRef<HTMLDivElement>(null);
  const hospital = useHospital();
  const { run } = useMutation();
  const [review, setReview] = useState<RxAiReviewDTO | null>(null);
  const [showPrintCopy, setShowPrintCopy] = useState(false);

  // The most serious finding per medicine, so each medicine line can carry its own flag.
  const flags = useMemo(() => {
    const byMedicine = new Map<string, { category: string; severity: RxFindingSeverity }>();
    for (const f of review?.findings ?? []) {
      for (const m of f.medicines) {
        const seen = byMedicine.get(m);
        if (!seen || SEVERITY_RANK[f.severity] < SEVERITY_RANK[seen.severity]) byMedicine.set(m, { category: f.category, severity: f.severity });
      }
    }
    return byMedicine;
  }, [review]);

  if (loading) {
    return (
      <div className={`${tw.gutterX} pt-10`}>
        <p className="text-[14px] font-normal text-[color:var(--ink-soft)]">Loading…</p>
      </div>
    );
  }
  if (!rx) {
    return (
      <div className={`${tw.gutterX} pt-10`}>
        <p className="text-[14px] font-normal text-[color:var(--ink-soft)]">Prescription not found.</p>
      </div>
    );
  }

  const title = `Prescription ${rx.rxNumber}`;
  const allergies = allergyList(rx.patient?.allergies);
  const conditions = allergyList(rx.patient?.chronicConditions);
  const canWrite = can("prescriptions", "write");

  const menu: RowAction[] = [
    { label: "Share link", onClick: () => void shareDocument(title, window.location.href) },
    { label: "Preview print copy", onClick: () => setShowPrintCopy((v) => !v) },
    ...(canWrite && rx.status !== "Dispensed"
      ? [{ label: "Mark dispensed", onClick: () => void run(() => api.post(`/prescriptions/${rx.id}/dispense`)).then(reload) }]
      : []),
  ];

  return (
    <>
      {/* Header */}
      <div className={`${tw.gutterX} pt-5 pb-3 flex items-center gap-3 flex-wrap`}>
        <Link href="/prescriptions" aria-label="Back to prescriptions" className="flex items-center justify-center w-8 h-8 rounded-full text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <Pill size={18} className="text-[color:var(--ink-soft)] shrink-0" />
        <div className="min-w-0">
          <p className="text-[15px] leading-[20px] text-[color:var(--ink)] truncate">
            <span className="font-semibold"><PatientName id={rx.patientId} name={rx.patientName} /></span>
            {rx.patient?.code && <span className="ml-2 font-mono text-[12px] text-[color:var(--ink-soft)]">{rx.patient.code}</span>}
            <span className="ml-2 text-[12px] text-[color:var(--ink-soft)]">
              {rx.patientAge} yrs{rx.patient?.gender ? ` · ${rx.patient.gender}` : ""}
            </span>
          </p>
          <p className="text-[12px] leading-[16px] text-[color:var(--ink-soft)] truncate">
            {formatDate(rx.date)} · {rx.rxNumber} · {rx.doctor}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <StatusBadge status={rx.status} />
          <button onClick={() => downloadElement(docRef.current, title, { margin: 0 })} className="inline-flex items-center gap-2 h-[34px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px] text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer transition-colors">
            <Download size={14} /> Download Rx
          </button>
          <button onClick={() => printElement(docRef.current, title, { margin: 0 })} className="inline-flex items-center gap-2 h-[34px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px] text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer transition-colors">
            <Printer size={14} /> Print full details
          </button>
          <RowMenu actions={menu} />
        </div>
      </div>

      <div className={`${tw.gutterX} mb-[30px] grid gap-5 items-start`} style={{ gridTemplateColumns: "minmax(0,1fr) 320px" }}>
        {/* Main column */}
        <div className="flex flex-col gap-4 min-w-0">
          <div className="flex flex-wrap gap-2">
            {allergies.length > 0 ? (
              <span className="inline-flex items-center gap-[6px] rounded-full border border-[#f4a3ac] bg-[#ffe3e5] px-3 py-[3px] text-[12px] font-medium text-[#b3001b]">
                Allergies: {allergies.join(", ")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-[6px] rounded-full border border-[#f3cf7d] bg-[#fff6dd] px-3 py-[3px] text-[12px] text-[#8a5300]">
                <HelpCircle size={13} /> Allergies not assessed
              </span>
            )}
            {conditions.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-[color:var(--line)] bg-[color:var(--subtle)] px-3 py-[3px] text-[12px] text-[color:var(--ink)]">
                Conditions: {conditions.join(", ")}
              </span>
            )}
          </div>

          <AiReviewCard rxId={rx.id} medicineCount={rx.items.length} onReview={setReview} />

          {/* Medicines */}
          <section aria-label="Medicines" className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
            {rx.items.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-[color:var(--ink-soft)]">No medicines on this prescription.</p>
            ) : rx.items.map((m, i) => {
              const flag = flags.get(m.medicineName);
              return (
                <div key={m.id} className={`flex gap-3 px-4 py-3 ${i > 0 ? "border-t border-[color:var(--line)]" : ""}`}>
                  <span className="w-4 shrink-0 pt-[1px] text-[13px] text-[color:var(--ink-soft)]">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] leading-[20px] font-semibold text-[color:var(--ink)]">
                      {m.medicineName}
                      {m.dosage && !m.medicineName.replace(/\s+/g, "").toLowerCase().includes(m.dosage.replace(/\s+/g, "").toLowerCase()) && <span className="ml-2 text-[13px] font-medium text-[color:var(--ink-soft)]">{m.dosage}</span>}
                    </p>
                    {m.generic && <p className="text-[12px] leading-[16px] text-[color:var(--ink-soft)]">{m.generic}</p>}
                    <p className="mt-1 text-[14px] leading-[19px] font-medium text-[color:var(--ink)]">
                      {[toPattern(m.frequency), m.timing, durationLabel(m.duration)].filter(Boolean).join(" · ") || "No directions given"}
                    </p>
                    {(() => { const r = remarksOf(m); return (<>{r.line && <p className="mt-1 text-[13px] leading-[19px] text-[color:var(--ink-soft)]">{r.line}</p>}{r.special && <p className="text-[13px] leading-[19px] text-[color:var(--ink)]">{r.special}</p>}</>); })()}
                  </div>
                  {flag && (
                    <span title="Flagged by the AI review" className={`self-start shrink-0 rounded-full border px-[10px] py-[2px] text-[11px] font-medium ${SEVERITY_TAG[flag.severity]}`}>
                      {flag.category}
                    </span>
                  )}
                </div>
              );
            })}
          </section>

          <section aria-label="Diagnosis">
            <p className="text-[12px] font-semibold text-[color:var(--ink)]">Diagnosis</p>
            <p className="mt-1 text-[15px] leading-[21px] text-[color:var(--ink)]">{rx.diagnosis}</p>
          </section>

          {hasConsultation(rx.consultation) && (
            <section aria-label="Consultation" className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-4">
              <p className="mb-3 text-[12px] font-semibold text-[color:var(--ink)]">Consultation</p>
              <ConsultationView c={rx.consultation} />
            </section>
          )}

          {showPrintCopy && (
            <button onClick={() => setShowPrintCopy(false)} className="self-start inline-flex items-center gap-1 text-[12px] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] cursor-pointer">
              <ChevronDown size={14} /> Hide print copy
            </button>
          )}
        </div>

        {/* Side column */}
        <aside className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3 flex flex-col gap-3">
          <div>
            <p className="text-[12px] font-semibold text-[color:var(--ink)]">Patient</p>
            <p className="mt-1 text-[13px] text-[color:var(--ink-soft)]">
              <PatientName id={rx.patientId} name={rx.patientName} /> · {rx.patientAge} yrs{rx.patient?.gender ? ` · ${rx.patient.gender}` : ""}
            </p>
            {rx.patient?.code && <p className="font-mono text-[12px] text-[color:var(--ink-soft)]">{rx.patient.code}</p>}
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[color:var(--ink)]">Prescribed by</p>
            <p className="mt-1 text-[13px] text-[color:var(--ink-soft)]">{rx.doctor || "—"}</p>
          </div>
          {rx.patientId && (
            <Link href={`/patients/${rx.patientId}`} className="text-[12px] font-medium text-[color:var(--brand)] hover:underline">
              Open patient record
            </Link>
          )}
        </aside>
      </div>

      {/* Printable copy — always mounted so Download / Print can use it; shown on screen only when asked for. */}
      <div
        aria-hidden={!showPrintCopy}
        style={showPrintCopy ? undefined : { position: "absolute", left: -99999, top: 0, width: 860 }}
        className={showPrintCopy ? `${tw.gutterX} mb-[30px]` : undefined}
      >
        <PrescriptionSheet ref={docRef} rx={rx} hospital={hospital} doctor={doctor} allergies={allergies} />
      </div>
    </>
  );
}
