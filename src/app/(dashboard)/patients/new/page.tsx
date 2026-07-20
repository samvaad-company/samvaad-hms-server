"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tw } from "@/lib/design-system";
import { StepBar } from "@/components/shared/StepBar";
import { FormRow, FormInput, FormSelect, FormTextarea } from "@/components/shared/FormRow";
import { User, Check, Loader2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { useBreadcrumb } from "@/lib/breadcrumb-context";

const STEPS = ["Quick Info", "Medical History", "Address & Contact", "Insurance"];

const BLOOD_GROUPS = ["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g => ({ value: g, label: g }));
const GENDER_OPTS  = [{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }];
const RELATION_OPTS = ["Spouse","Parent","Child","Sibling","Guardian","Other"].map(r => ({ value: r.toLowerCase(), label: r }));

const GENDER_MAP: Record<string, string> = { male: "Male", female: "Female", other: "Other" };

export default function NewPatientPage() {
  const router = useRouter();
  useBreadcrumb("/patients", "Patients", "New Patient Registration");
  const { run, loading, error } = useMutation();
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

  const isStep1Done = Boolean(form.name.trim() && form.mobile.trim() && form.dob && form.gender);
  const isStep3Done = Boolean(form.emergencyName.trim() && form.emergencyPhone.trim());

  /** Whether the current step's required fields are complete. */
  const stepValid = step === 1 ? isStep1Done : step === 3 ? isStep3Done : true;
  const stepHint =
    step === 1 && !isStep1Done
      ? "Fill name, mobile, date of birth and gender to continue."
      : step === 3 && !isStep3Done
        ? "Emergency contact name and phone are required to continue."
        : null;

  async function submit() {
    try {
      await run(() =>
        api.post("/patients", {
          name: form.name,
          phone: form.mobile,
          dob: form.dob || undefined,
          gender: GENDER_MAP[form.gender] ?? "Other",
          email: form.email || undefined,
          bloodGroup: form.bloodGroup || undefined,
          allergies: form.allergies || undefined,
          chronic: form.chronic || undefined,
          abhaId: form.abhaId || undefined,
          address: form.address || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          pincode: form.pincode || undefined,
          emergencyName: form.emergencyName || undefined,
          emergencyRelation: form.emergencyRelation || undefined,
          emergencyPhone: form.emergencyPhone || undefined,
          insurer: form.insurer || undefined,
          policyNumber: form.policyNumber || undefined,
          corporate: form.corporate || undefined,
        }),
      );
      router.push("/patients");
    } catch {
      // error surfaced via `error` below
    }
  }

  return (
    <>
      <div className={`${tw.gutterX} pt-4 pb-3 flex items-end justify-between`}>
        <div className="flex flex-col gap-[2px]">
          <h1 className="text-[24px] font-medium text-[#11111c] leading-[28px]">New Patient Registration</h1>
          <p className="text-[13px] font-light text-[#57575f] leading-[17px]">
            Register a patient in four quick steps — only step 1 is mandatory.
          </p>
        </div>
        <span className="text-[12px] font-medium text-[#009598]">{hmsId}</span>
      </div>

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
          {/* Step bar */}
          <div className="px-6 py-3 border-b border-[#dedee1]">
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

          {error && (
            <div className="mx-8 mb-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">
              {error instanceof ApiClientError ? error.message : "Failed to register patient"}
            </div>
          )}

          {/* Actions */}
          <div className="px-8 pb-6 flex justify-between items-center border-t border-[#f0f0f0] pt-4 gap-4">
            <button
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1}
              className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[9px] rounded-full hover:bg-[#f6f6f6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {stepHint && (
              <span className="text-[12px] font-normal text-[#ff9000] text-right flex-1">{stepHint}</span>
            )}
            {step < 4 ? (
              <button
                onClick={() => setStep(s => Math.min(4, s + 1))}
                disabled={!stepValid}
                className="text-[13px] font-normal text-white bg-[#009598] px-6 py-[9px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={loading || !isStep1Done}
                className="flex items-center gap-2 text-[13px] font-normal text-white bg-[#009598] px-6 py-[9px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {loading ? "Registering…" : "Register Patient"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
