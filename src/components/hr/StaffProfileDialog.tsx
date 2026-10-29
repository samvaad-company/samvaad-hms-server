"use client";

/** Edit a staff member's HR profile: ID, personal details, qualification, licence and emergency contact. */
import { useState } from "react";
import { api } from "@/lib/api/client";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import type { StaffDTO } from "@/types/api";
import { DialogButtons, ErrorNote, fieldLabel } from "@/components/mrd/shared";
import { useAction } from "@/components/hr/shared";

const field = (label: string, node: React.ReactNode, hint?: string) => (
  <div className="flex flex-col gap-2"><span className={fieldLabel}>{label}</span>{node}{hint && <p className="text-[12px] text-[color:var(--ink-soft)]">{hint}</p>}</div>
);

export function StaffProfileDialog({ staff, onClose }: { staff: StaffDTO; onClose: () => void }) {
  const { loading, error, close, submit } = useAction(onClose);
  const [f, setF] = useState({
    employeeNo: staff.employeeNo, gender: staff.gender, dob: staff.dob ?? "", phone: staff.phone, email: staff.email, address: staff.address,
    qualification: staff.qualification, licenceNo: staff.licenceNo, licenceExpiry: staff.licenceExpiry ?? "",
    emergencyName: staff.emergencyName, emergencyPhone: staff.emergencyPhone,
  });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const body = { ...f, dob: f.dob || null, licenceExpiry: f.licenceExpiry || null };
  return (
    <Modal open onClose={close} width={600} title={`Edit profile — ${staff.name}`}
      footer={<DialogButtons onCancel={close} onConfirm={() => submit(() => api.patch(`/staff/${staff.id}`, body))} label="Save profile" loading={loading} disabled={f.employeeNo.trim().length < 1} />}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          {field("Employee ID", <FormInput value={f.employeeNo} onChange={set("employeeNo")} />)}
          {field("Gender", <FormSelect value={f.gender} onChange={set("gender")} placeholder="—" options={[{ value: "", label: "—" }, ...["Female", "Male", "Other"].map((g) => ({ value: g, label: g }))]} />)}
          {field("Date of birth", <FormInput type="date" value={f.dob} onChange={set("dob")} />)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("Phone", <FormInput type="tel" value={f.phone} onChange={set("phone")} />)}
          {field("Email", <FormInput type="email" value={f.email} onChange={set("email")} />)}
        </div>
        {field("Address", <FormInput value={f.address} onChange={set("address")} />)}
        {field("Qualification", <FormInput value={f.qualification} onChange={set("qualification")} placeholder="B.Sc Nursing, GNM…" />)}
        <div className="grid grid-cols-2 gap-3">
          {field("Licence number", <FormInput value={f.licenceNo} onChange={set("licenceNo")} placeholder="Nursing council, pharmacy…" />)}
          {field("Licence valid until", <FormInput type="date" value={f.licenceExpiry} onChange={set("licenceExpiry")} />, "HR is reminded 60 days before it lapses.")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("Emergency contact", <FormInput value={f.emergencyName} onChange={set("emergencyName")} placeholder="Name and relation" />)}
          {field("Emergency phone", <FormInput type="tel" value={f.emergencyPhone} onChange={set("emergencyPhone")} />)}
        </div>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}
