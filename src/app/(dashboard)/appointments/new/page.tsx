"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
const GENDER_OPTS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
];
type PatientMode = "existing" | "new";

export default function NewAppointmentPage() {
  const router = useRouter();
  const { can } = useAuth();
  useBreadcrumb("/appointments", "Appointments", "Book Appointment");
  const { run, loading, error } = useMutation();
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });

  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<PatientMode>("existing");
  const [patientId, setPatientId] = useState("");
  const [newPatient, setNewPatient] = useState({ name: "", mobile: "", dob: "", gender: "" });
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");       // "HH:mm" from the doctor's open slots
  const [slotLabel, setSlotLabel] = useState("");
  const [type, setType] = useState("Booked");
  const [slotsKey, setSlotsKey] = useState(0);
  const [reason, setReason] = useState("");

  const setNP = (k: keyof typeof newPatient, v: string) =>
    setNewPatient(prev => ({ ...prev, [k]: v }));

  /** A different doctor, day or kind of visit means different open times, so the picked one no longer applies. */
  const pickSlot = (value: string, label: string) => { setSlot(value); setSlotLabel(label); };
  const clearSlot = () => { setSlot(""); setSlotLabel(""); };
  const handleDateChange = (v: string) => { setDate(v); clearSlot(); };
  const handleDoctorChange = (v: string) => { setDoctorId(v); clearSlot(); };
  const handleTypeChange = (v: string) => { setType(v); clearSlot(); };
  const isWalkIn = type === "Walk-in";

  const patient = patients.find(p => String(p.id) === patientId);
  const doctor = doctors.find(d => String(d.id) === doctorId);

  const newPatientValid = Boolean(
    newPatient.name.trim() && newPatient.mobile.trim() && newPatient.dob && newPatient.gender,
  );
  const step1Valid = mode === "existing" ? Boolean(patientId) : newPatientValid;
  const dateValid = Boolean(date) && date >= todayIso();
  const step2Valid = Boolean(doctorId && date && (slot || isWalkIn)) && dateValid;
  const stepValid = step === 1 ? step1Valid : step === 2 ? step2Valid : true;
  const stepHint =
    step === 1 && !step1Valid
      ? mode === "existing"
        ? "Select a patient to continue."
        : "Fill name, mobile, date of birth and gender to continue."
      : step === 2 && date && !dateValid
        ? "Appointment date cannot be in the past."
        : step === 2 && !step2Valid
          ? "Select doctor, date and a time slot to continue."
          : null;

  const displayName = mode === "existing" ? (patient?.name ?? "—") : newPatient.name || "—";

  async function submit() {
    await run(async () => {
      setSlotsKey(k => k + 1); // if this fails because the time just went, the list refreshes behind the message
      let pid = Number(patientId);
      let pname = patient?.name ?? "";
      let page = patient?.age ?? 0;

      // New patient → register first, then book against the created record.
      if (mode === "new") {
        const created = await api.post<PatientDTO>("/patients", {
          name: newPatient.name,
          phone: newPatient.mobile,
          dob: newPatient.dob,
          gender: newPatient.gender,
          reason: reason || "Appointment booking",
        });
        pid = created.id;
        pname = created.name;
        page = created.age;
      }

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
        <p className="text-[14px] font-normal text-[#57575f]">
          You don&apos;t have permission to book appointments. <Link href="/appointments" className="text-[#009598] hover:underline">Back to Appointments</Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={`${tw.gutterX} pt-4 pb-3 flex flex-col gap-[2px]`}>
        <h1 className="text-[24px] font-medium text-[#11111c] leading-[28px]">Book Appointment</h1>
        <p className="text-[13px] font-light text-[#57575f] leading-[17px]">
          Choose a patient, pick a doctor and slot, then confirm.
        </p>
      </div>

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
          <div className="px-6 py-3 border-b border-[#dedee1]">
            <StepBar steps={STEPS} currentStep={step} />
          </div>

          <div className="px-8 py-6">
            {/* Step 1 — Patient (new vs existing) */}
            {step === 1 && (
              <div className="flex flex-col gap-5 max-w-[640px]">
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { id: "existing", label: "Existing Patient", desc: "Search registered patients", icon: Users },
                    { id: "new",      label: "New Patient",      desc: "Register and book together", icon: UserPlus },
                  ] as const).map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMode(opt.id)}
                      className={`flex items-start gap-3 p-4 rounded-[10px] border text-left transition-colors ${
                        mode === opt.id
                          ? "border-[#009598] bg-[#e8f7f7]"
                          : "border-[#dedee1] hover:border-[#009598]"
                      }`}
                    >
                      <opt.icon size={18} className={mode === opt.id ? "text-[#009598]" : "text-[#57575f]"} />
                      <span>
                        <span className={`block text-[14px] font-medium ${mode === opt.id ? "text-[#009598]" : "text-[#11111c]"}`}>{opt.label}</span>
                        <span className="block text-[12px] font-light text-[#57575f]">{opt.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>

                {mode === "existing" ? (
                  <>
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
                      <div className="p-4 bg-[#e8f7f7] rounded-[10px] flex items-center gap-4">
                        <div className="w-10 h-10 bg-[#009598] rounded-full flex items-center justify-center text-[14px] font-medium text-white shrink-0">
                          {patient.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="grid grid-cols-3 gap-3 flex-1">
                          {[
                            { l: "Name",    v: patient.name },
                            { l: "Age",     v: `${patient.age} yrs · ${patient.gender}` },
                            { l: "Blood Gp",v: patient.bloodGroup ?? "—" },
                            { l: "Phone",   v: patient.phone },
                            { l: "HMS ID",  v: patient.patientId ?? "—" },
                          ].map(f => (
                            <div key={f.l}>
                              <p className="text-[10px] font-medium text-[#009598] uppercase tracking-wider">{f.l}</p>
                              <p className="text-[13px] font-normal text-[#11111c]">{f.v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <FormRow label="Full Name *">
                      <FormInput placeholder="Patient's full name" value={newPatient.name} onChange={v => setNP("name", v)} />
                    </FormRow>
                    <FormRow label="Mobile *">
                      <FormInput placeholder="+91 XXXXX XXXXX" type="tel" value={newPatient.mobile} onChange={v => setNP("mobile", v)} />
                    </FormRow>
                    <FormRow label="Date of Birth *">
                      <FormInput type="date" value={newPatient.dob} onChange={v => setNP("dob", v)} />
                    </FormRow>
                    <FormRow label="Gender *">
                      <FormSelect placeholder="Select gender" options={GENDER_OPTS} value={newPatient.gender} onChange={v => setNP("gender", v)} />
                    </FormRow>
                    <div className="col-span-2">
                      <p className="text-[12px] font-light text-[#57575f]">
                        The patient will be registered automatically when you confirm the appointment. Add medical
                        history later from their profile.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2 — Doctor & Slot */}
            {step === 2 && (
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-3 gap-4">
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
                  <p className="text-[13px] font-light text-[#57575f] bg-[#f6f6f6] rounded-[8px] px-4 py-3">
                    A walk-in is seen on arrival, so it doesn&apos;t take a booked time. It still counts towards the doctor&apos;s patients for that hour.
                  </p>
                ) : (
                  <SlotPicker doctorId={doctorId} date={date} mode="in_person" value={slot} onChange={pickSlot} refreshKey={slotsKey} />
                )}
              </div>
            )}

            {/* Step 3 — Reason & Confirm */}
            {step === 3 && (
              <div className="flex flex-col gap-5 max-w-[700px]">
                <FormRow label="Reason for Visit">
                  <FormInput placeholder="Brief reason" value={reason} onChange={setReason} />
                </FormRow>

                <div className="p-5 bg-[#f6f6f6] rounded-[12px]">
                  <p className="text-[13px] font-medium text-[#11111c] mb-4">Appointment Summary</p>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { l: "Patient",   v: displayName },
                      { l: "Patient Type", v: mode === "new" ? "New (will be registered)" : (patient?.patientId ?? "Existing") },
                      { l: "Doctor",    v: doctor?.name ?? "—" },
                      { l: "Specialty", v: doctor?.specialty ?? "—" },
                      { l: "Date",      v: date || "—" },
                      { l: "Time Slot", v: isWalkIn ? "On arrival" : slotLabel || "—" },
                      { l: "Type",      v: type },
                      { l: "Reason",    v: reason || "—" },
                    ].map(f => (
                      <div key={f.l}>
                        <p className="text-[10px] font-medium text-[#57575f] uppercase tracking-wider mb-[2px]">{f.l}</p>
                        <p className="text-[13px] font-normal text-[#11111c]">{f.v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mx-8 mb-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>
          )}

          <div className="px-8 pb-6 flex justify-between items-center border-t border-[#f0f0f0] pt-4 gap-4">
            <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}
              className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[9px] rounded-full hover:bg-[#f6f6f6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Previous
            </button>
            {stepHint && (
              <span className="text-[12px] font-normal text-[#ff9000] text-right flex-1">{stepHint}</span>
            )}
            {step < 3 ? (
              <button onClick={() => setStep(s => Math.min(3, s + 1))} disabled={!stepValid}
                className="text-[13px] font-normal text-white bg-[#009598] px-6 py-[9px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Continue →
              </button>
            ) : (
              <button onClick={submit} disabled={loading || !step1Valid || !step2Valid}
                className="flex items-center gap-2 text-[13px] font-normal text-white bg-[#009598] px-6 py-[9px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
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
