"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import type { AmbulanceCallDTO, AmbulanceDTO, PatientDTO } from "@/types/api";
import { Modal } from "@/components/shared/Modal";
import { PatientPicker } from "@/components/shared/PatientPicker";
import { FormInput, FormRow, FormSelect } from "@/components/shared/FormRow";
import { CALL_STATUS, CALL_TYPES, Chip, Err, OPEN_STATUSES, VEHICLE_STATUS, ghostBtn, hhmm, inr, primaryBtn } from "./shared";

type Dialog = { kind: "open" } | { kind: "dispatch" | "complete"; call: AmbulanceCallDTO } | null;

/** The fleet board and the calls still being worked: open a call, send a vehicle, and move it along until it's closed. */
export function DispatchTab({ vehicles, calls, patients, canWrite, reload }: { vehicles: AmbulanceDTO[]; calls: AmbulanceCallDTO[]; patients: PatientDTO[]; canWrite: boolean; reload: () => void }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const blank = { callType: CALL_TYPES[0], patientId: "", pickup: "", drop: "", ambulanceId: "", fare: "" };
  const [f, setF] = useState(blank);
  const { run, loading, error, reset } = useMutation();
  const set = (k: keyof typeof blank) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const close = () => { setDialog(null); setF(blank); reset(); };
  const free = vehicles.filter((v) => v.status === "Available");
  const vehicleOptions = free.map((v) => ({ value: String(v.id), label: `${v.code} — ${v.vehicleType || v.model}` }));
  const active = calls.filter((c) => OPEN_STATUSES.includes(c.status)).sort((a, b) => a.id - b.id);
  const act = (path: string, body?: unknown) => void run(async () => { await api.post(path, body); reload(); }).catch(() => undefined);
  const save = () => run(async () => {
    if (!dialog) return;
    if (dialog.kind === "open") await api.post("/ambulance/calls", { callType: f.callType, ...(f.patientId && { patientId: Number(f.patientId) }), pickupLocation: f.pickup, dropLocation: f.drop, ...(f.ambulanceId && { ambulanceId: Number(f.ambulanceId) }) });
    else if (dialog.kind === "dispatch") await api.post(`/ambulance/calls/${dialog.call.id}/dispatch`, { ambulanceId: Number(f.ambulanceId) });
    else await api.post(`/ambulance/calls/${dialog.call.id}/complete`, f.fare !== "" ? { amount: Number(f.fare) } : {});
    close(); reload();
  }).catch(() => undefined);
  const title = !dialog ? "" : dialog.kind === "open" ? "Open ambulance call" : dialog.kind === "dispatch" ? "Dispatch a vehicle" : "Complete call";
  const subtitle = !dialog ? "" : dialog.kind === "open" ? "Pick an available vehicle to dispatch now, or leave it queued and dispatch later."
    : dialog.kind === "dispatch" ? `${dialog.call.callNo} · ${dialog.call.pickupLocation}` : `${dialog.call.callNo} — frees the vehicle${dialog.call.amount ? "" : "; add a fare to bill it"}.`;
  const ready = !dialog ? false : dialog.kind === "open" ? f.pickup.trim().length >= 2 : dialog.kind === "dispatch" ? !!f.ambulanceId : true;

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center">
        <h2 className="text-[13px] font-semibold text-[color:var(--ink-soft)]">Fleet board</h2>
        {canWrite && <button className={`${primaryBtn} ml-auto`} title="Receive a call and dispatch an available vehicle" onClick={() => setDialog({ kind: "open" })}><Plus size={14} />Open call</button>}
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {vehicles.length === 0 && <p className="text-[13px] text-[color:var(--ink-soft)]">No vehicles yet — add them on the Fleet tab.</p>}
        {vehicles.map((v) => (
          <div key={v.id} className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3">
            <p className="flex items-center justify-between gap-2"><span className="font-mono text-[15px] font-bold">{v.code}</span><Chip tone={VEHICLE_STATUS[v.status].tone}>{VEHICLE_STATUS[v.status].label}</Chip></p>
            <p className="mt-1 text-[13px] text-[color:var(--ink-soft)]">{v.vehicleType || v.model || "—"}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-7 text-[13px] font-semibold text-[color:var(--ink-soft)]">Active calls</h2>
      {active.length === 0 && <p className="rounded-[10px] border border-[color:var(--line)] py-8 text-center text-[13px] text-[color:var(--ink-soft)]">No active calls.</p>}
      <div className="flex flex-col gap-3">
        {active.map((c) => {
          const v = vehicles.find((x) => x.id === c.ambulanceId);
          return (
            <article key={c.id} className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[14px] font-bold">{c.callNo || `#${c.id}`}</span>
                <span className="rounded-[6px] border border-[color:var(--line)] px-2 py-[1px] text-[12px]">{c.callType}</span>
                <Chip tone={CALL_STATUS[c.status].tone}>{CALL_STATUS[c.status].label}</Chip>
                {v && <span className="font-mono text-[13px] text-[color:var(--ink-soft)]">{v.code}</span>}
                <span className="ml-auto font-mono text-[12px] text-[color:var(--ink-soft)]">opened {hhmm(c.openedAt)}{c.amount > 0 && ` · ${inr(c.amount)}`}</span>
              </p>
              <p className="mt-1 text-[13px] text-[color:var(--ink-soft)]">{c.pickupLocation}{c.dropLocation && ` → ${c.dropLocation}`}{c.patientName !== "Unidentified" && ` · ${c.patientName}`}</p>
              {canWrite && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {c.status === "Queued" && <button className={`${ghostBtn} bg-[color:var(--brand-soft)] text-[color:var(--brand)]`} disabled={free.length === 0} title={free.length === 0 ? "No vehicle is free" : undefined} onClick={() => setDialog({ kind: "dispatch", call: c })}>Dispatch</button>}
                  {c.status === "Dispatched" && <button className={`${ghostBtn} bg-[color:var(--brand-soft)] text-[color:var(--brand)]`} onClick={() => act(`/ambulance/calls/${c.id}/arrive`)} disabled={loading}>Mark at scene</button>}
                  {c.status === "At scene" && <button className={`${ghostBtn} bg-[color:var(--brand-soft)] text-[color:var(--brand)]`} onClick={() => act(`/ambulance/calls/${c.id}/transport`)} disabled={loading}>Start transport</button>}
                  {c.status !== "Queued" && <button className={ghostBtn} onClick={() => setDialog({ kind: "complete", call: c })}>Complete</button>}
                  <button className="cursor-pointer px-2 py-[6px] text-[13px] text-[color:var(--ink-soft)] hover:text-[#c8001a]" onClick={() => act(`/ambulance/calls/${c.id}/cancel`)} disabled={loading}>Cancel</button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {error && !dialog && <p role="alert" className="mt-3 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}

      <Modal open={!!dialog} onClose={close} title={title} subtitle={subtitle} width={440}
        footer={<div className="flex justify-end gap-3"><button onClick={close} className="cursor-pointer px-3 py-2 text-[14px] font-medium">Cancel</button><button onClick={() => void save()} disabled={loading || !ready} className="cursor-pointer rounded-[8px] bg-[color:var(--brand)] px-4 py-2 text-[14px] font-medium text-white disabled:opacity-50">{dialog?.kind === "open" ? "Receive call" : dialog?.kind === "dispatch" ? "Dispatch" : "Complete call"}</button></div>}>
        <div className="flex flex-col gap-4">
          {dialog?.kind === "open" && (<>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Call type"><FormSelect value={f.callType} onChange={set("callType")} options={CALL_TYPES.map((t) => ({ value: t, label: t }))} /></FormRow>
              <FormRow label="Patient (optional)"><PatientPicker patients={patients} value={f.patientId} onChange={(id) => set("patientId")(id)} placeholder="Unidentified / none" /></FormRow>
            </div>
            <FormRow label="Pickup address" required><FormInput value={f.pickup} onChange={set("pickup")} /></FormRow>
            <FormRow label="Destination"><FormInput value={f.drop} onChange={set("drop")} placeholder={f.callType === CALL_TYPES[0] ? "Blank = this hospital" : ""} /></FormRow>
            <FormRow label="Dispatch vehicle"><FormSelect value={f.ambulanceId} onChange={set("ambulanceId")} options={[{ value: "", label: "Queue (no vehicle yet)" }, ...vehicleOptions]} /></FormRow>
          </>)}
          {dialog?.kind === "dispatch" && <FormRow label="Vehicle" required><FormSelect value={f.ambulanceId} onChange={set("ambulanceId")} placeholder="Pick an available vehicle" options={vehicleOptions} /></FormRow>}
          {dialog?.kind === "complete" && <FormRow label="Fare (₹)" hint={`Billed as an Ambulance bill. ${dialog.call.amount ? `Quoted ${inr(dialog.call.amount)}.` : ""}`}><FormInput type="number" value={f.fare} onChange={set("fare")} min="0" placeholder={dialog.call.amount ? String(dialog.call.amount) : "0"} /></FormRow>}
          <Err message={error?.message} />
        </div>
      </Modal>
    </div>
  );
}
