"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { useRowActions } from "@/lib/api/useRowActions";
import type { AmbulanceDTO } from "@/types/api";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormRow, FormSelect } from "@/components/shared/FormRow";
import { Chip, Err, VEHICLE_STATUS, VEHICLE_TYPES, ghostBtn, primaryBtn } from "./shared";

/** The vehicles: board code, registration, type, driver and whether each is on the road. */
export function FleetTab({ vehicles, canWrite, reload }: { vehicles: AmbulanceDTO[]; canWrite: boolean; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const blank = { code: "", vehicleNumber: "", vehicleType: VEHICLE_TYPES[0], model: "", driverName: "", driverPhone: "" };
  const [f, setF] = useState(blank);
  const { run, loading, error, reset } = useMutation();
  const actions = useRowActions("ambulance/vehicles", reload);
  const set = (k: keyof typeof blank) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const close = () => { setOpen(false); setF(blank); reset(); };
  const save = () => run(async () => { await api.post("/ambulance/vehicles", { ...f, code: f.code.trim() }); close(); reload(); }).catch(() => undefined);
  return (
    <div className="p-4">
      {actions.dialog}
      {canWrite && <div className="mb-3 flex"><button className={`${primaryBtn} ml-auto`} onClick={() => setOpen(true)}><Plus size={14} />Add vehicle</button></div>}
      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
        <table className="w-full min-w-[860px] border-collapse text-[14px]">
          <thead><tr className="bg-[color:var(--subtle)] text-left text-[12px] text-[color:var(--ink-soft)]"><th className="px-4 py-2 font-medium">Code</th><th className="px-4 py-2 font-medium">Registration</th><th className="px-4 py-2 font-medium">Type</th><th className="px-4 py-2 font-medium">Driver</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2" /></tr></thead>
          <tbody>
            {vehicles.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-[color:var(--ink-soft)]">No vehicles in the fleet.</td></tr>}
            {vehicles.map((v) => (
              <tr key={v.id} className="border-t border-[color:var(--line)]">
                <td className="px-4 py-[10px] font-mono font-bold">{v.code}</td><td className="px-4 py-[10px] font-mono text-[13px]">{v.vehicleNumber}</td><td className="px-4 py-[10px]">{v.vehicleType || v.model || "—"}</td>
                <td className="px-4 py-[10px]">{v.driverName || "—"}{v.driverPhone && <span className="ml-2 font-mono text-[12px] text-[color:var(--ink-soft)]">{v.driverPhone}</span>}</td>
                <td className="px-4 py-[10px]"><Chip tone={VEHICLE_STATUS[v.status].tone}>{VEHICLE_STATUS[v.status].label}</Chip></td>
                <td className="whitespace-nowrap px-4 py-[10px] text-right text-[13px]">
                  {canWrite && v.status === "Available" && <button className={ghostBtn} onClick={() => actions.mutate(() => api.patch(`/ambulance/vehicles/${v.id}`, { status: "Maintenance" }))}>Send off road</button>}
                  {canWrite && v.status === "Maintenance" && <button className={ghostBtn} onClick={() => actions.mutate(() => api.patch(`/ambulance/vehicles/${v.id}`, { status: "Available" }))}>Put back on road</button>}
                  {canWrite && v.status !== "On Call" && <button className="ml-2 cursor-pointer text-[12px] text-[color:var(--ink-soft)] hover:text-[#c8001a]" onClick={() => actions.remove(v.id, v.code)}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={open} onClose={close} title="Add vehicle" width={460}
        footer={<div className="flex justify-end gap-3"><button onClick={close} className="cursor-pointer px-3 py-2 text-[14px] font-medium">Cancel</button><button onClick={() => void save()} disabled={loading || f.vehicleNumber.trim().length < 4} className="cursor-pointer rounded-[8px] bg-[color:var(--brand)] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50">Add vehicle</button></div>}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3"><FormRow label="Registration no." required><FormInput value={f.vehicleNumber} onChange={set("vehicleNumber")} placeholder="GJ-06-AB-1234" /></FormRow><FormRow label="Board code" hint="Blank = next AMB-nn"><FormInput value={f.code} onChange={set("code")} placeholder="AMB-05" /></FormRow></div>
          <FormRow label="Type"><FormSelect value={f.vehicleType} onChange={set("vehicleType")} options={VEHICLE_TYPES.map((t) => ({ value: t, label: t }))} /></FormRow>
          <div className="grid grid-cols-2 gap-3"><FormRow label="Driver"><FormInput value={f.driverName} onChange={set("driverName")} /></FormRow><FormRow label="Driver phone"><FormInput value={f.driverPhone} onChange={set("driverPhone")} placeholder="+91 …" /></FormRow></div>
          <Err message={error?.message} />
        </div>
      </Modal>
    </div>
  );
}
