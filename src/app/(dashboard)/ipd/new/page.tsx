"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { FormRow, FormInput, FormSelect, FormTextarea } from "@/components/shared/FormRow";
import { patients } from "@/data/patients";
import { doctors } from "@/data/doctors";
import { beds } from "@/data/beds";
import { ChevronLeft, Check } from "lucide-react";
import Link from "next/link";

const WARDS = [...new Set(beds.map(b => b.ward))].map(w => ({ value: w, label: w }));

export default function NewIpdAdmissionPage() {
  const [ward, setWard] = useState("");
  const [patientId, setPatientId] = useState("");

  const availableBeds = beds.filter(b => b.ward === ward && b.status === "Available");

  return (
    <>
      <div className={`${tw.gutterX} mb-4 pt-2 flex items-center justify-between`}>
        <Link href="/ipd" className="inline-flex items-center gap-1 text-[13px] font-normal text-[#57575f] hover:text-[#11111c] transition-colors">
          <ChevronLeft size={15} /> Back to IPD
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/ipd" className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-4 py-[7px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</Link>
          <Link href="/ipd" className="flex items-center gap-2 text-[13px] font-normal text-white bg-[#009598] px-5 py-[7px] rounded-full hover:bg-[#007f82] transition-colors">
            <Check size={14} /> Admit Patient
          </Link>
        </div>
      </div>

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} p-8`}>
          <h2 className="text-[18px] font-medium text-[#11111c] mb-6">New IPD Admission</h2>

          <div className="flex flex-col gap-7">
            {/* Patient */}
            <section>
              <h3 className="text-[13px] font-medium text-[#57575f] uppercase tracking-wider mb-4">Patient Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormRow label="Patient *">
                  <FormSelect placeholder="Search patient" options={patients.map(p => ({ value: String(p.id), label: `${p.name} — ${p.patientId}` }))} value={patientId} onChange={setPatientId} />
                </FormRow>
                <FormRow label="Admission Date *">
                  <FormInput type="date" />
                </FormRow>
                <FormRow label="Admission Type *">
                  <FormSelect placeholder="Select type" options={["Emergency","Planned Surgery","Medical Observation","Post-Operative","Maternity","Other"].map(t => ({ value: t.toLowerCase().replace(/\s+/g,"-"), label: t }))} />
                </FormRow>
                <FormRow label="Referred By">
                  <FormInput placeholder="Referring doctor / hospital" />
                </FormRow>
              </div>
            </section>

            <div className="border-t border-[#f0f0f0]" />

            {/* Doctor & Ward */}
            <section>
              <h3 className="text-[13px] font-medium text-[#57575f] uppercase tracking-wider mb-4">Doctor & Ward Assignment</h3>
              <div className="grid grid-cols-3 gap-4">
                <FormRow label="Attending Doctor *">
                  <FormSelect placeholder="Select doctor" options={doctors.map(d => ({ value: String(d.id), label: d.name }))} />
                </FormRow>
                <FormRow label="Ward *">
                  <FormSelect placeholder="Select ward" options={WARDS} value={ward} onChange={setWard} />
                </FormRow>
                <FormRow label="Bed *">
                  <FormSelect
                    placeholder={ward ? `${availableBeds.length} available` : "Select ward first"}
                    options={availableBeds.map(b => ({ value: String(b.id), label: b.bedNumber }))}
                  />
                </FormRow>
              </div>
            </section>

            <div className="border-t border-[#f0f0f0]" />

            {/* Clinical */}
            <section>
              <h3 className="text-[13px] font-medium text-[#57575f] uppercase tracking-wider mb-4">Clinical Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <FormRow label="Chief Complaint / Reason for Admission *">
                    <FormTextarea placeholder="Describe presenting complaint and reason for admission..." rows={3} />
                  </FormRow>
                </div>
                <div className="col-span-2">
                  <FormRow label="Provisional Diagnosis">
                    <FormInput placeholder="ICD-10 code or free text" />
                  </FormRow>
                </div>
                <div className="col-span-2">
                  <FormRow label="Admission Notes">
                    <FormTextarea placeholder="Clinical notes, vitals on admission, past medical history..." rows={3} />
                  </FormRow>
                </div>
              </div>
            </section>

            <div className="border-t border-[#f0f0f0]" />

            {/* Insurance */}
            <section>
              <h3 className="text-[13px] font-medium text-[#57575f] uppercase tracking-wider mb-4">Insurance & Billing</h3>
              <div className="grid grid-cols-3 gap-4">
                <FormRow label="Payment Mode *">
                  <FormSelect placeholder="Select mode" options={["Cash","Insurance","Corporate / TPA","Government Scheme","Other"].map(m => ({ value: m.toLowerCase().replace(/\s+\/\s+|\s+/g,"-"), label: m }))} />
                </FormRow>
                <FormRow label="Insurance Provider">
                  <FormInput placeholder="Insurance company name" />
                </FormRow>
                <FormRow label="Policy / TPA Number">
                  <FormInput placeholder="Policy number" />
                </FormRow>
                <FormRow label="Estimated Stay (days)">
                  <FormInput type="number" placeholder="e.g. 5" />
                </FormRow>
                <FormRow label="Estimated Cost (₹)">
                  <FormInput type="number" placeholder="Approximate cost" />
                </FormRow>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
