"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { StepBar } from "@/components/shared/StepBar";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import Link from "next/link";
import type { PatientDTO, DoctorDTO } from "@/types/api";
import { Check, Loader2, UserPlus, Users } from "lucide-react";
import { SlotPicker } from "@/components/scheduling/SlotPicker";
import { todayIso } from "@/lib/validators";

const STEPS = ["Patient", "Doctor & Slot", "Confirm"];
const APPT_TYPES = [
  { value: "Booked", label: "Booked" },
  { value: "Walk-in", label: "Walk-in" },
];

export default function NewAppointmentPage() {
  // useSearchParams needs a Suspense boundary above it.
  return <Suspense fallback={null}><BookAppointment /></Suspense>;
}

/** A small label chip for facts about the patient or booking. */
function Tag({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "brand" }) {
  return (
    <span className={`inline-flex items-center h-[18px] px-[7px] rounded-full text-[10.5px] leading-none whitespace-nowrap ${
      tone === "brand"
        ? "bg-[color:var(--brand-soft)] text-[color:var(--brand)] border border-[color:var(--brand-ring)] font-medium"
        : "bg-[color:var(--surface)] text-[color:var(--ink-soft)] border border-[color:var(--line)]"
    }`}>
      {children}
    </span>
  );
}

function BookAppointment() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useAuth();
  useBreadcrumb("/appointments", "Appointments", "Book Appointment");
  const { run, loading, error } = useMutation();
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });

  const [step, setStep] = useState(1);
  // Coming back from "New patient" (…/appointments/new?patientId=123): the patient just registered is already picked.
  const [patientId, setPatientId] = useState(() => searchParams.get("patientId") ?? "");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");       // "HH:mm" from the doctor's open slots
  const [slotLabel, setSlotLabel] = useState("");
  const [type, setType] = useState("Booked");
  const [slotsKey, setSlotsKey] = useState(0);
  const [reason, setReason] = useState("");


  /** A different doctor, day or kind of visit means different open times, so the picked one no longer applies. */
  const pickSlot = (value: string, label: string) => { setSlot(value); setSlotLabel(label); };
  const clearSlot = () => { setSlot(""); setSlotLabel(""); };
  const handleDateChange = (v: string) => { setDate(v); clearSlot(); };
  const handleDoctorChange = (v: string) => { setDoctorId(v); clearSlot(); };
  const handleTypeChange = (v: string) => { setType(v); clearSlot(); };
  const isWalkIn = type === "Walk-in";

  const patient = patients.find(p => String(p.id) === patientId);
  const doctor = doctors.find(d => String(d.id) === doctorId);

  const step1Valid = Boolean(patientId);
  const dateValid = Boolean(date) && date >= todayIso();
  const step2Valid = Boolean(doctorId && date && (slot || isWalkIn)) && dateValid;
  const stepValid = step === 1 ? step1Valid : step === 2 ? step2Valid : true;
  const stepHint =
    step === 1 && !step1Valid
      ? "Select a patient to continue."
      : step === 2 && date && !dateValid
        ? "Appointment date cannot be in the past."
        : step === 2 && !step2Valid
          ? "Select doctor, date and a time slot to continue."
          : null;

  const displayName = patient?.name ?? "—";

  async function submit() {
    await run(async () => {
      setSlotsKey(k => k + 1); // if this fails because the time just went, the list refreshes behind the message
      const pid = Number(patientId);
      const pname = patient?.name ?? "";
      const page = patient?.age ?? 0;

      await api.post("/appointments", {
        patientId: pid,
        patientName: pname,
        patientAge: page,
        doctorId: Number(doctorId),
        date,
        // Walk-ins are seen on arrival, not at a booked time.
        time: isWalkIn ? new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : slotLabel,
        type,
        reason,
        status: "Upcoming",
      });
    });
    router.push("/appointments");
  }

  if (!can("appointments", "write")) {
    return (
      <div className={`${tw.gutterX} pt-10`}>
        <p className="text-[14px] font-normal text-[color:var(--ink-soft)]">
          You don&apos;t have permission to book appointments. <Link href="/appointments" className="text-[color:var(--brand)] hover:underline">Back to Appointments</Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={`${tw.gutterX} pt-3 pb-2 flex flex-col gap-[1px]`}>
        <h1 className="text-[20px] font-medium text-[color:var(--ink)] leading-[24px]">Book Appointment</h1>
        <p className="text-[12px] font-light text-[color:var(--ink-soft)] leading-[16px]">
          Choose a patient, pick a doctor and slot, then confirm.
        </p>
      </div>

      <div className={`${tw.gutterX} mb-4`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden max-w-[900px]`}>
          <div className="px-5 py-2 border-b border-[color:var(--line)] bg-[color:var(--faint)]">
            <StepBar steps={STEPS} currentStep={step} />
          </div>

          <div className="px-5 py-4">
            {/* Step 1 — Patient (new vs existing) */}
            {step === 1 && (
              <div className="flex flex-col gap-3 max-w-[620px]">
                {/* Who is it for: pick a registered patient, or register a new one (full form, then back here). */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-[6px] h-[28px] px-3 rounded-full text-[12px] font-medium bg-[color:var(--brand-soft)] text-[color:var(--brand)] border border-[color:var(--brand-ring)]">
                    <Users size={13} /> Existing patient
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push("/patients/new?from=booking")}
                    className="inline-flex items-center gap-[6px] h-[28px] px-3 rounded-full text-[12px] text-[color:var(--ink-soft)] border border-[color:var(--line)] hover:border-[color:var(--brand)] hover:text-[color:var(--brand)] transition-colors cursor-pointer"
                  >
                    <UserPlus size={13} /> New patient
                  </button>
                </div>

                <FormRow label="Patient *">
                  <SearchSelect
                    placeholder="Search patient by name, ID or phone…"
                    value={patientId}
                    onChange={setPatientId}
                    options={patients.map(p => ({
                      value: String(p.id),
                      label: p.name,
                      hint: `${p.patientId ?? ""} · ${p.phone}`,
                    }))}
                  />
                </FormRow>

                {patient && (
                  <div className="px-3 py-2 bg-[color:var(--brand-soft)] border border-[color:var(--brand-ring)] rounded-[10px] flex items-center gap-3">
                    <div className="w-8 h-8 bg-[color:var(--brand)] rounded-full flex items-center justify-center text-[12px] font-medium text-white shrink-0">
                      {patient.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[color:var(--ink)] truncate">{patient.name}</p>
                      <div className="flex flex-wrap gap-[6px] mt-[3px]">
                        {[`${patient.age}y · ${patient.gender}`, patient.bloodGroup, patient.phone, patient.patientId].filter(Boolean).map(t => (
                          <Tag key={String(t)}>{t}</Tag>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2 — Doctor & Slot */}
            {step === 2 && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-3 max-w-[760px]">
                  <FormRow label="Doctor *">
                    <SearchSelect
                      placeholder="Search doctor…"
                      value={doctorId}
                      onChange={handleDoctorChange}
                      options={doctors.map(d => ({ value: String(d.id), label: d.name, hint: `${d.specialty} · ${d.patientsPerHour}/hr` }))}
                    />
                  </FormRow>
                  <FormRow label="Date *" error={date && !dateValid ? "Cannot be in the past" : undefined}>
                    <FormInput type="date" value={date} onChange={handleDateChange} min={todayIso()} error={Boolean(date) && !dateValid} />
                  </FormRow>
                  <FormRow label="Type">
                    <FormSelect placeholder="Select type" options={APPT_TYPES} value={type} onChange={handleTypeChange} />
                  </FormRow>
                </div>

                {isWalkIn ? (
                  <p className="text-[12px] font-light text-[color:var(--ink-soft)] bg-[color:var(--subtle)] rounded-[8px] px-3 py-2">
                    A walk-in is seen on arrival, so it doesn&apos;t take a booked time. It still counts towards the doctor&apos;s patients for that hour.
                  </p>
                ) : (
                  <SlotPicker doctorId={doctorId} date={date} mode="in_person" value={slot} onChange={pickSlot} refreshKey={slotsKey} />
                )}
              </div>
            )}

            {/* Step 3 — Reason & Confirm */}
            {step === 3 && (
              <div className="flex flex-col gap-3 max-w-[620px]">
                <FormRow label="Reason for Visit">
                  <FormInput placeholder="Brief reason" value={reason} onChange={setReason} />
                </FormRow>

                <div className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--faint)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-[12px] font-medium text-[color:var(--ink)]">Appointment summary</p>
                    <div className="flex gap-[6px]">
                      <Tag tone="brand">{type}</Tag>
                      <Tag tone="brand">{isWalkIn ? "On arrival" : slotLabel || "—"}</Tag>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                    {[
                      { l: "Patient",   v: displayName },
                      { l: "Patient ID", v: patient?.patientId ?? "—" },
                      { l: "Date",      v: date || "—" },
                      { l: "Doctor",    v: doctor?.name ?? "—" },
                      { l: "Specialty", v: doctor?.specialty ?? "—" },
                      { l: "Reason",    v: reason || "—" },
                    ].map(f => (
                      <div key={f.l} className="min-w-0">
                        <p className="text-[10px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">{f.l}</p>
                        <p className="text-[12px] font-normal text-[color:var(--ink)] truncate">{f.v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mx-5 mb-2 text-[12px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-[6px]">{error.message}</div>
          )}

          <div className="px-5 py-3 flex justify-between items-center border-t border-[color:var(--line)] gap-3">
            <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}
              className="text-[12px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-4 py-[6px] rounded-full hover:bg-[color:var(--subtle)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Previous
            </button>
            {stepHint && (
              <span className="text-[11px] font-normal text-[#ff9000] text-right flex-1">{stepHint}</span>
            )}
            {step < 3 ? (
              <button onClick={() => setStep(s => Math.min(3, s + 1))} disabled={!stepValid}
                className="text-[12px] font-medium text-white bg-[color:var(--brand)] px-5 py-[6px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Continue →
              </button>
            ) : (
              <button onClick={submit} disabled={loading || !step1Valid || !step2Valid}
                className="flex items-center gap-2 text-[12px] font-medium text-white bg-[color:var(--brand)] px-5 py-[6px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {loading ? "Booking…" : "Confirm Appointment"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
