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
import type { PatientDTO, DoctorDTO } from "@/types/api";
import { Check, Loader2 } from "lucide-react";
import Link from "next/link";

const OT_ROOMS = ["OT-1 (General Surgery)","OT-2 (Cardiac)","OT-3 (Orthopaedics)","OT-4 (Neurosurgery)","OT-5 (Gynaecology)","OT-6 (Ophthalmology)"].map(r => ({ value: r, label: r }));
const PRIORITY = ["Elective","Urgent","Emergency"].map(p => ({ value: p.toLowerCase(), label: p }));
const ANAESTHESIA = ["General (GA)","Spinal","Epidural","Local","Sedation (MAC)"].map(a => ({ value: a.toLowerCase().replace(/[^a-z]/g,"-"), label: a }));

export default function NewOTPage() {
  const router = useRouter();
  const { can } = useAuth();
  useBreadcrumb("/ot", "OT", "Schedule OT");
  const { run, loading, error } = useMutation();
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });

  const [form, setForm] = useState({
    patientId: "", procedure: "", otRoom: "", surgeonId: "",
    anesthetistId: "", scheduledDate: "", scheduledTime: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const valid = form.patientId && form.procedure && form.otRoom && form.surgeonId && form.scheduledDate && form.scheduledTime;

  async function submit() {
    const anesthetist = doctors.find(d => String(d.id) === form.anesthetistId)?.name ?? "";
    await run(() =>
      api.post("/ot", {
        patientId: Number(form.patientId),
        procedure: form.procedure,
        otRoom: form.otRoom,
        surgeonId: Number(form.surgeonId),
        anesthetist,
        scheduledDate: form.scheduledDate,
        scheduledTime: form.scheduledTime,
      }),
    );
    router.push("/ot");
  }

  if (!can("ot", "write")) {
    return (
      <div className={`${tw.gutterX} pt-10`}>
        <p className="text-[14px] font-normal text-[color:var(--ink-soft)]">
          You don&apos;t have permission to schedule OT procedures. <Link href="/ot" className="text-[color:var(--brand)] hover:underline">Back to OT</Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={`${tw.gutterX} mb-4 pt-3 flex items-center justify-between`}>
        <div className="flex flex-col gap-[2px]">
          <h1 className="text-[24px] font-medium text-[color:var(--ink)] leading-[28px]">Schedule Operating Theatre</h1>
          <p className="text-[13px] font-light text-[color:var(--ink-soft)] leading-[17px]">Plan the procedure, team, and OT slot.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/ot" className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-4 py-[7px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</Link>
          <button onClick={submit} disabled={!valid || loading} className="flex items-center gap-2 text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[7px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Schedule OT
          </button>
        </div>
      </div>

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} p-8`}>
          {error && <div className="mb-4 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}

          <div className="flex flex-col gap-7">
            <section>
              <h3 className="text-[13px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-4">Patient & Procedure</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormRow label="Patient *">
                  <SearchSelect
                    placeholder="Search patient by name, ID or phone…"
                    value={form.patientId}
                    onChange={v => set("patientId", v)}
                    options={patients.map(p => ({ value: String(p.id), label: p.name, hint: `${p.patientId ?? ""} · ${p.phone}` }))}
                  />
                </FormRow>
                <FormRow label="Procedure / Surgery Name *">
                  <FormInput placeholder="e.g. Appendectomy, CABG, TKR..." value={form.procedure} onChange={v => set("procedure", v)} />
                </FormRow>
                <FormRow label="ICD-10 / ICD-9-CM Code">
                  <FormInput placeholder="Procedure code" />
                </FormRow>
                <FormRow label="Priority *">
                  <FormSelect placeholder="Select priority" options={PRIORITY} />
                </FormRow>
              </div>
            </section>

            <div className="border-t border-[color:var(--subtle-2)]" />

            <section>
              <h3 className="text-[13px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-4">OT Scheduling</h3>
              <div className="grid grid-cols-3 gap-4">
                <FormRow label="OT Room *">
                  <FormSelect placeholder="Select OT" value={form.otRoom} onChange={v => set("otRoom", v)} options={OT_ROOMS} />
                </FormRow>
                <FormRow label="Scheduled Date *">
                  <FormInput type="date" value={form.scheduledDate} onChange={v => set("scheduledDate", v)} />
                </FormRow>
                <FormRow label="Start Time *">
                  <FormInput type="time" value={form.scheduledTime} onChange={v => set("scheduledTime", v)} />
                </FormRow>
                <FormRow label="Expected Duration">
                  <FormSelect placeholder="Select duration" options={["30 min","1 hr","1.5 hr","2 hr","2.5 hr","3 hr","4 hr","5+ hr"].map(d => ({ value: d, label: d }))} />
                </FormRow>
                <FormRow label="Anaesthesia Type *">
                  <FormSelect placeholder="Select type" options={ANAESTHESIA} />
                </FormRow>
              </div>
            </section>

            <div className="border-t border-[color:var(--subtle-2)]" />

            <section>
              <h3 className="text-[13px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-4">Surgical Team</h3>
              <div className="grid grid-cols-3 gap-4">
                <FormRow label="Primary Surgeon *">
                  <FormSelect placeholder="Select surgeon" value={form.surgeonId} onChange={v => set("surgeonId", v)} options={doctors.map(d => ({ value: String(d.id), label: d.name }))} />
                </FormRow>
                <FormRow label="Assistant Surgeon">
                  <FormSelect placeholder="Select assistant" options={doctors.map(d => ({ value: String(d.id), label: d.name }))} />
                </FormRow>
                <FormRow label="Anaesthetist *">
                  <FormSelect placeholder="Select anaesthetist" value={form.anesthetistId} onChange={v => set("anesthetistId", v)} options={doctors.map(d => ({ value: String(d.id), label: d.name }))} />
                </FormRow>
                <FormRow label="Scrub Nurse"><FormInput placeholder="Nurse name" /></FormRow>
                <FormRow label="Circulating Nurse"><FormInput placeholder="Nurse name" /></FormRow>
                <FormRow label="OT Technician"><FormInput placeholder="Technician name" /></FormRow>
              </div>
            </section>

            <div className="border-t border-[color:var(--subtle-2)]" />

            <section>
              <h3 className="text-[13px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-4">Pre-Op Notes & Special Requirements</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <FormRow label="Pre-Op Instructions">
                    <FormTextarea placeholder="NPO status, blood products needed, special equipment..." rows={3} />
                  </FormRow>
                </div>
                <FormRow label="Blood Product Required">
                  <FormSelect placeholder="Select" options={["None","Packed Red Cells (PRC)","Fresh Frozen Plasma (FFP)","Platelets","Whole Blood"].map(b => ({ value: b.toLowerCase().replace(/[^a-z]/g,"-"), label: b }))} />
                </FormRow>
                <FormRow label="Special Equipment">
                  <FormInput placeholder="e.g. C-arm, microscope, robot-assisted..." />
                </FormRow>
                <div className="col-span-2">
                  <FormRow label="Surgeon Notes">
                    <FormTextarea placeholder="Any additional notes for the OT team..." rows={2} />
                  </FormRow>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
