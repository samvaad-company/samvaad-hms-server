"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { StepBar } from "@/components/shared/StepBar";
import { FormRow, FormInput, FormSelect, FormTextarea } from "@/components/shared/FormRow";
import { ChevronLeft, User, Check } from "lucide-react";
import Link from "next/link";

const STEPS = ["Quick Info", "Medical History", "Address & Contact", "Insurance"];

const BLOOD_GROUPS = ["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g => ({ value: g, label: g }));
const GENDER_OPTS  = [{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }];
const RELATION_OPTS = ["Spouse","Parent","Child","Sibling","Guardian","Other"].map(r => ({ value: r.toLowerCase(), label: r }));

export default function NewPatientPage() {
  const [step, setStep] = useState(1);
  const [hmsId] = useState(() => `HMS-${String(Math.floor(Math.random() * 9000) + 1000)}`);
  const [form, setForm] = useState({
    name: "", mobile: "", dob: "", gender: "", email: "",
    bloodGroup: "", allergies: "", chronic: "", abhaId: "",
    address: "", city: "", state: "", pincode: "",
    emergencyName: "", emergencyRelation: "", emergencyPhone: "",
    insurer: "", policyNumber: "", corporate: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const isStep1Done = form.name && form.mobile && form.dob && form.gender;

  return (
    <>
      <div className={`${tw.gutterX} mb-4 pt-2 flex items-center justify-between`}>
        <Link href="/patients" className="inline-flex items-center gap-1 text-[13px] font-normal text-[#57575f] hover:text-[#11111c] transition-colors">
          <ChevronLeft size={15} /> Back to Patients
        </Link>
        <span className="text-[13px] font-normal text-[#57575f]">New Patient Registration</span>
      </div>

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
          {/* Step bar */}
          <div className="px-8 pt-7 pb-5 border-b border-[#dedee1]">
            <StepBar steps={STEPS} currentStep={step} />
          </div>

          {/* Step content */}
          <div className="px-8 py-7">
            {/* Step 1 — Quick Info */}
            {step === 1 && (
              <div className="flex flex-col gap-6">
                {/* Auto-generated ID */}
                <div className="flex items-center gap-3 p-4 bg-[#e8f7f7] rounded-[10px]">
                  <div className="w-10 h-10 bg-[#009598] rounded-full flex items-center justify-center">
                    <User size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#009598] uppercase tracking-wider">Auto-Generated HMS ID</p>
                    <p className="text-[20px] font-medium text-[#11111c]">{hmsId}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <FormRow label="Full Name *">
                    <FormInput placeholder="Patient's full name" value={form.name} onChange={v => set("name", v)} />
                  </FormRow>
                  <FormRow label="Mobile Number *">
                    <FormInput placeholder="+91 XXXXX XXXXX" type="tel" value={form.mobile} onChange={v => set("mobile", v)} />
                  </FormRow>
                  <FormRow label="Date of Birth *">
                    <FormInput type="date" value={form.dob} onChange={v => set("dob", v)} />
                  </FormRow>
                  <FormRow label="Gender *">
                    <FormSelect placeholder="Select gender" options={GENDER_OPTS} value={form.gender} onChange={v => set("gender", v)} />
                  </FormRow>
                  <FormRow label="Email Address">
                    <FormInput placeholder="patient@email.com" type="email" value={form.email} onChange={v => set("email", v)} />
                  </FormRow>
                </div>
              </div>
            )}

            {/* Step 2 — Medical History */}
            {step === 2 && (
              <div className="grid grid-cols-2 gap-5">
                <FormRow label="Blood Group">
                  <FormSelect placeholder="Select blood group" options={BLOOD_GROUPS} value={form.bloodGroup} onChange={v => set("bloodGroup", v)} />
                </FormRow>
                <FormRow label="ABHA ID">
                  <FormInput placeholder="xx-xxxx-xxxx-xxxx" value={form.abhaId} onChange={v => set("abhaId", v)} />
                </FormRow>
                <div className="col-span-2">
                  <FormRow label="Known Allergies">
                    <FormTextarea placeholder="e.g. Penicillin, Sulfa, Latex (comma separated or leave blank)" value={form.allergies} onChange={v => set("allergies", v)} />
                  </FormRow>
                </div>
                <div className="col-span-2">
                  <FormRow label="Chronic Conditions / Past Medical History">
                    <FormTextarea placeholder="e.g. Type 2 Diabetes, Hypertension, Asthma..." value={form.chronic} onChange={v => set("chronic", v)} />
                  </FormRow>
                </div>
              </div>
            )}

            {/* Step 3 — Address & Emergency Contact */}
            {step === 3 && (
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="text-[14px] font-medium text-[#11111c] mb-4">Address</h3>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="col-span-2">
                      <FormRow label="Street Address">
                        <FormInput placeholder="House / Flat No., Street, Locality" value={form.address} onChange={v => set("address", v)} />
                      </FormRow>
                    </div>
                    <FormRow label="City">
                      <FormInput placeholder="City" value={form.city} onChange={v => set("city", v)} />
                    </FormRow>
                    <FormRow label="State">
                      <FormInput placeholder="State" value={form.state} onChange={v => set("state", v)} />
                    </FormRow>
                    <FormRow label="PIN Code">
                      <FormInput placeholder="6-digit PIN" value={form.pincode} onChange={v => set("pincode", v)} />
                    </FormRow>
                  </div>
                </div>
                <div className="border-t border-[#f0f0f0] pt-5">
                  <h3 className="text-[14px] font-medium text-[#11111c] mb-4">Emergency Contact</h3>
                  <div className="grid grid-cols-3 gap-5">
                    <FormRow label="Contact Name *">
                      <FormInput placeholder="Full name" value={form.emergencyName} onChange={v => set("emergencyName", v)} />
                    </FormRow>
                    <FormRow label="Relationship">
                      <FormSelect placeholder="Select" options={RELATION_OPTS} value={form.emergencyRelation} onChange={v => set("emergencyRelation", v)} />
                    </FormRow>
                    <FormRow label="Phone *">
                      <FormInput placeholder="+91 XXXXX XXXXX" type="tel" value={form.emergencyPhone} onChange={v => set("emergencyPhone", v)} />
                    </FormRow>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4 — Insurance */}
            {step === 4 && (
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-5">
                  <FormRow label="Insurance Provider">
                    <FormSelect placeholder="Select insurer" options={["Star Health","New India Assurance","HDFC Ergo","Bajaj Allianz","ICICI Lombard","United India","None"].map(i => ({ value: i.toLowerCase().replace(/\s+/g,"-"), label: i }))} value={form.insurer} onChange={v => set("insurer", v)} />
                  </FormRow>
                  <FormRow label="Policy Number">
                    <FormInput placeholder="Policy / TPA number" value={form.policyNumber} onChange={v => set("policyNumber", v)} />
                  </FormRow>
                  <FormRow label="Corporate / Employer (optional)">
                    <FormInput placeholder="Company name if on group policy" value={form.corporate} onChange={v => set("corporate", v)} />
                  </FormRow>
                </div>

                {/* Summary */}
                <div className="mt-4 p-5 bg-[#f6f6f6] rounded-[10px]">
                  <h3 className="text-[13px] font-medium text-[#11111c] mb-3">Registration Summary</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { l: "HMS ID",    v: hmsId },
                      { l: "Name",      v: form.name || "—" },
                      { l: "Mobile",    v: form.mobile || "—" },
                      { l: "DOB",       v: form.dob || "—" },
                      { l: "Gender",    v: form.gender || "—" },
                      { l: "Blood Gp.", v: form.bloodGroup || "—" },
                    ].map(f => (
                      <div key={f.l}>
                        <p className="text-[10px] font-medium text-[#57575f] uppercase tracking-wider">{f.l}</p>
                        <p className="text-[13px] font-normal text-[#11111c]">{f.v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-8 pb-7 flex justify-between items-center border-t border-[#f0f0f0] pt-5">
            <button
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1}
              className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[9px] rounded-full hover:bg-[#f6f6f6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {step < 4 ? (
              <button
                onClick={() => setStep(s => Math.min(4, s + 1))}
                className="text-[13px] font-normal text-white bg-[#009598] px-6 py-[9px] rounded-full hover:bg-[#007f82] transition-colors"
              >
                Continue →
              </button>
            ) : (
              <Link href="/patients" className="flex items-center gap-2 text-[13px] font-normal text-white bg-[#009598] px-6 py-[9px] rounded-full hover:bg-[#007f82] transition-colors">
                <Check size={14} /> Register Patient
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
