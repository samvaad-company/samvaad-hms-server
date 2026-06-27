"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { StepBar } from "@/components/shared/StepBar";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import { patients } from "@/data/patients";
import { doctors } from "@/data/doctors";
import { ChevronLeft, Check, Calendar, Clock } from "lucide-react";
import Link from "next/link";

const STEPS = ["Select Patient", "Doctor & Slot", "Confirm"];
const APPT_TYPES = ["New Visit","Follow-up","Emergency","Walk-in"].map(t => ({ value: t.toLowerCase().replace(" ", "-"), label: t }));

export default function NewAppointmentPage() {
  const [step, setStep] = useState(1);
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [type, setType] = useState("");
  const [reason, setReason] = useState("");

  const patient = patients.find(p => String(p.id) === patientId);
  const doctor  = doctors.find(d => String(d.id) === doctorId);

  return (
    <>
      <div className={`${tw.gutterX} mb-4 pt-2 flex items-center justify-between`}>
        <Link href="/appointments" className="inline-flex items-center gap-1 text-[13px] font-normal text-[#57575f] hover:text-[#11111c] transition-colors">
          <ChevronLeft size={15} /> Back to Appointments
        </Link>
        <span className="text-[13px] font-normal text-[#57575f]">New Appointment</span>
      </div>

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
          <div className="px-8 pt-7 pb-5 border-b border-[#dedee1]">
            <StepBar steps={STEPS} currentStep={step} />
          </div>

          <div className="px-8 py-7">
            {/* Step 1 — Patient */}
            {step === 1 && (
              <div className="flex flex-col gap-5 max-w-[600px]">
                <FormRow label="Search Patient *">
                  <FormSelect
                    placeholder="Select or search patient"
                    options={patients.map(p => ({ value: String(p.id), label: `${p.name} — ${p.patientId}` }))}
                    value={patientId}
                    onChange={setPatientId}
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
                        { l: "Blood Gp",v: patient.bloodGroup },
                        { l: "Phone",   v: patient.phone },
                        { l: "HMS ID",  v: patient.patientId },
                      ].map(f => (
                        <div key={f.l}>
                          <p className="text-[10px] font-medium text-[#009598] uppercase tracking-wider">{f.l}</p>
                          <p className="text-[13px] font-normal text-[#11111c]">{f.v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2 — Doctor & Slot */}
            {step === 2 && (
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-3 gap-4">
                  <FormRow label="Department *">
                    <FormSelect placeholder="Select dept" options={["Cardiology","General Medicine","Orthopaedics","Neurology","Paediatrics","Gynaecology","ENT","Dermatology"].map(d => ({ value: d.toLowerCase(), label: d }))} />
                  </FormRow>
                  <FormRow label="Doctor *">
                    <FormSelect placeholder="Select doctor" options={doctors.map(d => ({ value: String(d.id), label: d.name }))} value={doctorId} onChange={setDoctorId} />
                  </FormRow>
                  <FormRow label="Date *">
                    <FormInput type="date" value={date} onChange={setDate} />
                  </FormRow>
                </div>

                {doctorId && date && (
                  <div>
                    <p className="text-[12px] font-medium text-[#57575f] uppercase tracking-wider mb-3">Available Slots</p>
                    <div className="flex flex-wrap gap-2">
                      {["9:00 AM","9:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","12:00 PM","4:00 PM","4:30 PM","5:00 PM","5:30 PM","6:00 PM"].map((t, i) => {
                        const avail = i % 3 !== 1;
                        const active = slot === t;
                        return (
                          <button key={t} disabled={!avail} onClick={() => setSlot(t)}
                            className={`flex items-center gap-1 px-4 py-[8px] rounded-full text-[13px] font-normal border transition-colors ${
                              !avail ? "border-[#dedee1] text-[#57575f] opacity-40 cursor-not-allowed"
                                : active ? "bg-[#009598] text-white border-[#009598]"
                                : "border-[#dedee1] text-[#57575f] hover:border-[#009598] hover:text-[#009598]"
                            }`}>
                            <Clock size={12} /> {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3 — Reason & Confirm */}
            {step === 3 && (
              <div className="flex flex-col gap-5 max-w-[700px]">
                <div className="grid grid-cols-2 gap-4">
                  <FormRow label="Appointment Type *">
                    <FormSelect placeholder="Select type" options={APPT_TYPES} value={type} onChange={setType} />
                  </FormRow>
                  <FormRow label="Reason for Visit">
                    <FormInput placeholder="Brief reason" value={reason} onChange={setReason} />
                  </FormRow>
                </div>

                {/* Summary */}
                <div className="p-5 bg-[#f6f6f6] rounded-[12px]">
                  <p className="text-[13px] font-medium text-[#11111c] mb-4">Appointment Summary</p>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { l: "Patient",     v: patient?.name ?? "—" },
                      { l: "HMS ID",      v: patient?.patientId ?? "—" },
                      { l: "Doctor",      v: doctor?.name ?? "—" },
                      { l: "Department",  v: doctor?.department ?? "—" },
                      { l: "Date",        v: date || "—" },
                      { l: "Time Slot",   v: slot || "—" },
                      { l: "Type",        v: type || "—" },
                      { l: "Reason",      v: reason || "—" },
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

          <div className="px-8 pb-7 flex justify-between items-center border-t border-[#f0f0f0] pt-5">
            <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}
              className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[9px] rounded-full hover:bg-[#f6f6f6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Previous
            </button>
            {step < 3 ? (
              <button onClick={() => setStep(s => Math.min(3, s + 1))}
                className="text-[13px] font-normal text-white bg-[#009598] px-6 py-[9px] rounded-full hover:bg-[#007f82] transition-colors">
                Continue →
              </button>
            ) : (
              <Link href="/appointments" className="flex items-center gap-2 text-[13px] font-normal text-white bg-[#009598] px-6 py-[9px] rounded-full hover:bg-[#007f82] transition-colors">
                <Check size={14} /> Confirm Appointment
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
