"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tw } from "@/lib/design-system";
import { FormRow, FormInput, FormSelect, FormTextarea } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import type { PatientDTO, DoctorDTO, BedDTO } from "@/types/api";
import { Check, Loader2 } from "lucide-react";
import { todayIso } from "@/lib/dates";
import Link from "next/link";

export default function NewIpdAdmissionPage() {
  const router = useRouter();
  const { can } = useAuth();
  useBreadcrumb("/ipd", "IPD", "New Admission");
  const { run, loading, error } = useMutation();
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  const { items: beds } = useList<BedDTO>("/beds", { all: true });

  const [ward, setWard] = useState("");
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [bedId, setBedId] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [admissionDate, setAdmissionDate] = useState(todayIso());

  const WARDS = [...new Set(beds.map(b => b.ward))].map(w => ({ value: w, label: w }));
  const availableBeds = beds.filter(b => b.ward === ward && b.status === "Available");
  const dateValid = Boolean(admissionDate) && admissionDate >= todayIso();
  const valid = patientId && doctorId && bedId && diagnosis.trim() && dateValid;

  async function submit() {
    await run(() =>
      api.post("/ipd", {
        patientId: Number(patientId),
        patientName: patients.find(p => String(p.id) === patientId)?.name ?? "",
        doctorId: Number(doctorId),
        bedId: Number(bedId),
        ward,
        diagnosis,
        admissionDate,
      }),
    );
    router.push("/ipd");
  }

  if (!can("ipd", "write")) {
    return (
      <div className={`${tw.gutterX} pt-10`}>
        <p className="text-[14px] font-normal text-[color:var(--ink-soft)]">
          You don&apos;t have permission to create admissions. <Link href="/ipd" className="text-[color:var(--brand)] hover:underline">Back to IPD</Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={`${tw.gutterX} mb-4 pt-3 flex items-center justify-between`}>
        <div className="flex flex-col gap-[2px]">
          <h1 className="text-[24px] font-medium text-[color:var(--ink)] leading-[28px]">New IPD Admission</h1>
          <p className="text-[13px] font-light text-[color:var(--ink-soft)] leading-[17px]">Admit a patient and assign a ward & bed.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/ipd" className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-4 py-[7px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</Link>
          <button onClick={submit} disabled={!valid || loading} className="flex items-center gap-2 text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[7px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Admit Patient
          </button>
        </div>
      </div>

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} p-8`}>
          {error && <div className="mb-4 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}

          <div className="flex flex-col gap-7">
            {/* Patient */}
            <section>
              <h3 className="text-[13px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-4">Patient Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormRow label="Patient *">
                  <SearchSelect
                    placeholder="Search patient by name, ID or phone…"
                    value={patientId}
                    onChange={setPatientId}
                    options={patients.map(p => ({ value: String(p.id), label: p.name, hint: `${p.patientId ?? ""} · ${p.phone}` }))}
                  />
                </FormRow>
                <FormRow label="Admission Date *" error={admissionDate && !dateValid ? "Cannot be in the past" : undefined}>
                  <FormInput type="date" value={admissionDate} onChange={setAdmissionDate} min={todayIso()} error={Boolean(admissionDate) && !dateValid} />
                </FormRow>
                <FormRow label="Admission Type *">
                  <FormSelect placeholder="Select type" options={["Emergency","Planned Surgery","Medical Observation","Post-Operative","Maternity","Other"].map(t => ({ value: t.toLowerCase().replace(/\s+/g,"-"), label: t }))} />
                </FormRow>
                <FormRow label="Referred By">
                  <FormInput placeholder="Referring doctor / hospital" />
                </FormRow>
              </div>
            </section>

            <div className="border-t border-[color:var(--subtle-2)]" />

            {/* Doctor & Ward */}
            <section>
              <h3 className="text-[13px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-4">Doctor & Ward Assignment</h3>
              <div className="grid grid-cols-3 gap-4">
                <FormRow label="Attending Doctor *">
                  <FormSelect placeholder="Select doctor" value={doctorId} onChange={setDoctorId} options={doctors.map(d => ({ value: String(d.id), label: d.name }))} />
                </FormRow>
                <FormRow label="Ward *">
                  <FormSelect placeholder="Select ward" options={WARDS} value={ward} onChange={v => { setWard(v); setBedId(""); }} />
                </FormRow>
                <FormRow label="Bed *">
                  <FormSelect
                    placeholder={ward ? `${availableBeds.length} available` : "Select ward first"}
                    value={bedId}
                    onChange={setBedId}
                    options={availableBeds.map(b => ({ value: String(b.id), label: b.bedNumber }))}
                  />
                </FormRow>
              </div>
            </section>

            <div className="border-t border-[color:var(--subtle-2)]" />

            {/* Clinical */}
            <section>
              <h3 className="text-[13px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-4">Clinical Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <FormRow label="Chief Complaint / Reason for Admission *">
                    <FormTextarea placeholder="Describe presenting complaint and reason for admission..." rows={3} value={diagnosis} onChange={setDiagnosis} />
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

            <div className="border-t border-[color:var(--subtle-2)]" />

            {/* Insurance */}
            <section>
              <h3 className="text-[13px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-4">Insurance & Billing</h3>
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
