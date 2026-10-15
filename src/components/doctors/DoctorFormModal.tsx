"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import type { DoctorDTO } from "@/types/api";

const SPECIALTIES = ["General Physician","Paediatrician","Cardiologist","Neurologist","Orthopaedic Surgeon","Dermatologist","Gastroenterologist","Endocrinologist","Pulmonologist","Physiotherapist"];
const DEPARTMENTS = ["OPD","Paediatrics","Cardiology","Neurology","Ortho","Skin","Surgery","Internal Med","Respiratory","Rehab"];
const STATUS_OPTS = [{ value: "Active", label: "Active" }, { value: "In OPD", label: "In OPD" }, { value: "On Leave", label: "On Leave" }];

/** The list plus the value already saved, so editing a doctor whose value isn't a stock option doesn't blank it. */
const withCurrent = (list: string[], current?: string) =>
  (current && !list.includes(current) ? [...list, current] : list).map((v) => ({ value: v, label: v }));

const EMPTY = { name: "", specialty: "", department: "", phone: "", experience: "", status: "Active" };

/** Add a doctor, or edit one when `doctor` is given. The form only exists while open, so it always starts from the saved details. */
export function DoctorFormModal(props: {
  open: boolean;
  doctor?: DoctorDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return props.open ? <DoctorForm key={props.doctor?.id ?? "new"} {...props} /> : null;
}

function DoctorForm({
  open,
  doctor,
  onClose,
  onSaved,
}: {
  open: boolean;
  doctor?: DoctorDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!doctor;
  const { run, loading, error } = useMutation();
  const [form, setForm] = useState(() => doctor
    ? { name: doctor.name, specialty: doctor.specialty, department: doctor.department, phone: doctor.phone, experience: doctor.experience, status: doctor.status }
    : EMPTY);
  const set = (k: keyof typeof EMPTY, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  async function save() {
    await run(() => (doctor ? api.patch(`/doctors/${doctor.id}`, form) : api.post("/doctors", form)));
    onSaved();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit Doctor" : "Add Doctor"}
      footer={
        <>
          <button onClick={onClose} className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
          <button onClick={save} disabled={loading || !form.name.trim()}
            className="text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
            {loading ? "Saving…" : editing ? "Save changes" : "Add Doctor"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><FormRow label="Full Name *"><FormInput placeholder="Dr. First Last" value={form.name} onChange={(v) => set("name", v)} /></FormRow></div>
        <FormRow label="Specialty *"><FormSelect placeholder="Select specialty" value={form.specialty} onChange={(v) => set("specialty", v)} options={withCurrent(SPECIALTIES, form.specialty)} /></FormRow>
        <FormRow label="Department *"><FormSelect placeholder="Select dept" value={form.department} onChange={(v) => set("department", v)} options={withCurrent(DEPARTMENTS, form.department)} /></FormRow>
        <FormRow label="Phone *"><FormInput placeholder="+91 XXXXX XXXXX" type="tel" value={form.phone} onChange={(v) => set("phone", v)} /></FormRow>
        <FormRow label="Experience"><FormInput placeholder="e.g. 10 yrs" value={form.experience} onChange={(v) => set("experience", v)} /></FormRow>
        <FormRow label="Status"><FormSelect placeholder="Select status" value={form.status} onChange={(v) => set("status", v)} options={STATUS_OPTS} /></FormRow>
        {error && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
      </div>
    </Modal>
  );
}
