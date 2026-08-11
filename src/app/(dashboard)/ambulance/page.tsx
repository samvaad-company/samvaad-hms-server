"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { Ambulance as AmbulanceIcon, Plus } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { AmbulanceDTO, AmbulanceCallDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { TabBar } from "@/components/shared/TabBar";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";

// ─── Calls Tab ────────────────────────────────────────────────────────────────

const CALL_COLUMNS = [
  { label: "Patient",  width: "minmax(140px,1.3fr)" },
  { label: "Phone",    width: "130px" },
  { label: "Pickup",   width: "minmax(140px,1.4fr)" },
  { label: "Drop",     width: "minmax(140px,1.4fr)" },
  { label: "Vehicle",  width: "140px" },
  { label: "Date",     width: "110px" },
  { label: "Fare",     width: "90px", align: "right" as const },
  { label: "Status",   width: "120px" },
  { label: "Action",   width: "52px", align: "right" as const },
];
const CALL_FILTERS = [
  { id: "All", label: "All" }, { id: "Dispatched", label: "Dispatched" },
  { id: "Completed", label: "Completed" }, { id: "Cancelled", label: "Cancelled" },
];

function CallRow({ row, actions }: { row: AmbulanceCallDTO; actions: RowAction[] }) {
  return (
    <div className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.patientName}</span>
      <span className="text-[13px] font-normal text-[#57575f] whitespace-nowrap">{row.phone || "—"}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.pickupLocation}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.dropLocation}</span>
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{row.vehicleNumber || "—"}</span>
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{formatDate(row.date)}</span>
      <span className="text-[13px] font-medium text-[#11111c] text-right">₹{row.amount.toLocaleString("en-IN")}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </div>
  );
}

// ─── Fleet Tab ────────────────────────────────────────────────────────────────

const FLEET_COLUMNS = [
  { label: "Vehicle No.",  width: "minmax(150px,1.2fr)" },
  { label: "Model",        width: "minmax(170px,1.6fr)" },
  { label: "Driver",       width: "minmax(150px,1.3fr)" },
  { label: "Driver Phone", width: "150px" },
  { label: "Status",       width: "130px" },
  { label: "Action",       width: "52px", align: "right" as const },
];
const FLEET_FILTERS = [
  { id: "All", label: "All" }, { id: "Available", label: "Available" },
  { id: "On Call", label: "On Call" }, { id: "Maintenance", label: "Maintenance" },
];

function FleetRow({ row, actions }: { row: AmbulanceDTO; actions: RowAction[] }) {
  return (
    <div className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#009598] whitespace-nowrap">{row.vehicleNumber}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.model}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.driverName}</span>
      <span className="text-[13px] font-normal text-[#57575f] whitespace-nowrap">{row.driverPhone}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AmbulancePage() {
  const [tab, setTab] = useState("calls");
  const [callFilter, setCallFilter] = useState("All");
  const [callSearch, setCallSearch] = useState("");
  const [fleetFilter, setFleetFilter] = useState("All");
  const [fleetSearch, setFleetSearch] = useState("");
  const [modal, setModal] = useState<"" | "call" | "vehicle">("");

  const { items: calls, reload: reloadCalls } = useList<AmbulanceCallDTO>("/ambulance/calls", { all: true });
  const { items: vehicles, reload: reloadVehicles } = useList<AmbulanceDTO>("/ambulance/vehicles", { all: true });
  const reloadAll = () => { reloadCalls(); reloadVehicles(); };
  const callActions = useRowActions("ambulance/calls", reloadAll);
  const fleetActions = useRowActions("ambulance/vehicles", reloadAll);
  const { run, loading, error, reset } = useMutation();

  const [callForm, setCallForm] = useState({ patientName: "", phone: "", pickup: "", drop: "", ambulanceId: "", amount: "" });
  const [vehicleForm, setVehicleForm] = useState({ vehicleNumber: "", model: "", driverName: "", driverPhone: "" });

  const closeModal = () => { setModal(""); reset(); };

  async function submitCall() {
    await run(() => api.post("/ambulance/calls", {
      patientName: callForm.patientName,
      phone: callForm.phone,
      pickupLocation: callForm.pickup,
      dropLocation: callForm.drop,
      ambulanceId: callForm.ambulanceId ? Number(callForm.ambulanceId) : undefined,
      amount: callForm.amount ? Number(callForm.amount) : 0,
    }));
    setCallForm({ patientName: "", phone: "", pickup: "", drop: "", ambulanceId: "", amount: "" });
    closeModal();
    reloadAll();
  }

  async function submitVehicle() {
    await run(() => api.post("/ambulance/vehicles", vehicleForm));
    setVehicleForm({ vehicleNumber: "", model: "", driverName: "", driverPhone: "" });
    closeModal();
    reloadVehicles();
  }

  const TABS = [
    { id: "calls", label: "Call Log", count: calls.length },
    { id: "fleet", label: "Fleet",    count: vehicles.length },
  ];

  const activeCalls = calls.filter(c => c.status === "Dispatched").length;

  const visibleCalls = calls.filter(c => {
    const matchF = callFilter === "All" || c.status === callFilter;
    const q = callSearch.toLowerCase();
    return matchF && (!q || c.patientName.toLowerCase().includes(q) || c.vehicleNumber.toLowerCase().includes(q) || c.pickupLocation.toLowerCase().includes(q));
  });

  const visibleVehicles = vehicles.filter(v => {
    const matchF = fleetFilter === "All" || v.status === fleetFilter;
    const q = fleetSearch.toLowerCase();
    return matchF && (!q || v.vehicleNumber.toLowerCase().includes(q) || v.model.toLowerCase().includes(q) || v.driverName.toLowerCase().includes(q));
  });

  const modalError = error && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>;
  const modalFooter = (onSubmit: () => void, label: string, disabled: boolean) => (
    <>
      <button onClick={closeModal} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
      <button onClick={onSubmit} disabled={loading || disabled}
        className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
        {loading ? "Saving…" : label}
      </button>
    </>
  );

  return (
    <>
      {callActions.dialog}
      {fleetActions.dialog}

      <Modal open={modal === "call"} onClose={closeModal} title="New Ambulance Call"
        footer={modalFooter(submitCall, "Dispatch", !callForm.patientName || !callForm.pickup || !callForm.drop)}>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Patient / Caller *"><FormInput placeholder="Name" value={callForm.patientName} onChange={v => setCallForm(f => ({ ...f, patientName: v }))} /></FormRow>
          <FormRow label="Phone"><FormInput placeholder="+91 ..." value={callForm.phone} onChange={v => setCallForm(f => ({ ...f, phone: v }))} /></FormRow>
          <FormRow label="Pickup Location *"><FormInput placeholder="Pickup address" value={callForm.pickup} onChange={v => setCallForm(f => ({ ...f, pickup: v }))} /></FormRow>
          <FormRow label="Drop Location *"><FormInput placeholder="Drop address" value={callForm.drop} onChange={v => setCallForm(f => ({ ...f, drop: v }))} /></FormRow>
          <FormRow label="Ambulance" hint="Only available vehicles are listed">
            <FormSelect placeholder="Assign vehicle" value={callForm.ambulanceId} onChange={v => setCallForm(f => ({ ...f, ambulanceId: v }))}
              options={vehicles.filter(v => v.status === "Available").map(v => ({ value: String(v.id), label: `${v.vehicleNumber} — ${v.driverName}` }))} />
          </FormRow>
          <FormRow label="Fare (₹)" hint="Billed as an Ambulance bill on completion"><FormInput type="number" placeholder="0" value={callForm.amount} onChange={v => setCallForm(f => ({ ...f, amount: v }))} /></FormRow>
          {modalError}
        </div>
      </Modal>

      <Modal open={modal === "vehicle"} onClose={closeModal} title="Add Ambulance"
        footer={modalFooter(submitVehicle, "Add Vehicle", !vehicleForm.vehicleNumber || !vehicleForm.model || !vehicleForm.driverName || !vehicleForm.driverPhone)}>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Vehicle Number *"><FormInput placeholder="MH-12-AB-1234" value={vehicleForm.vehicleNumber} onChange={v => setVehicleForm(f => ({ ...f, vehicleNumber: v }))} /></FormRow>
          <FormRow label="Model *"><FormInput placeholder="e.g. Force Traveller (ALS)" value={vehicleForm.model} onChange={v => setVehicleForm(f => ({ ...f, model: v }))} /></FormRow>
          <FormRow label="Driver Name *"><FormInput placeholder="Driver name" value={vehicleForm.driverName} onChange={v => setVehicleForm(f => ({ ...f, driverName: v }))} /></FormRow>
          <FormRow label="Driver Phone *"><FormInput placeholder="+91 ..." value={vehicleForm.driverPhone} onChange={v => setVehicleForm(f => ({ ...f, driverPhone: v }))} /></FormRow>
          {modalError}
        </div>
      </Modal>

      <PageHeader
        title="Ambulance"
        subtitle="Dispatch ambulance calls, manage the vehicle fleet, and bill trips."
        stats={[{ icon: AmbulanceIcon, value: `${activeCalls}`, label: "Active Calls" }]}
        action={{ label: "New Call", icon: Plus, onClick: () => setModal("call") }}
      />
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 655 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />

          {tab === "calls" && (
            <>
              <FilterBar filters={CALL_FILTERS} searchPlaceholder="Search by patient, vehicle, or pickup..."
                activeFilter={callFilter} onFilterChange={setCallFilter} searchQuery={callSearch} onSearchChange={setCallSearch}
                action={{ label: "New Call", icon: Plus, onClick: () => setModal("call") }} />
              <DataTable columns={CALL_COLUMNS} minWidth={1250}>
                {visibleCalls.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[#57575f]">No calls logged.</div>
                ) : visibleCalls.map(c => (
                  <CallRow key={c.id} row={c} actions={[
                    { label: "Mark Completed", disabled: c.status !== "Dispatched", onClick: () => callActions.mutate(() => api.patch(`/ambulance/calls/${c.id}`, { status: "Completed" })) },
                    { label: "Cancel call", disabled: c.status !== "Dispatched", onClick: () => callActions.mutate(() => api.patch(`/ambulance/calls/${c.id}`, { status: "Cancelled" })) },
                    { label: "Delete", danger: true, onClick: () => callActions.remove(c.id, `call for ${c.patientName}`) },
                  ]} />
                ))}
              </DataTable>
            </>
          )}

          {tab === "fleet" && (
            <>
              <FilterBar filters={FLEET_FILTERS} searchPlaceholder="Search by vehicle number, model, or driver..."
                activeFilter={fleetFilter} onFilterChange={setFleetFilter} searchQuery={fleetSearch} onSearchChange={setFleetSearch}
                action={{ label: "Add Vehicle", icon: Plus, onClick: () => setModal("vehicle") }} />
              <DataTable columns={FLEET_COLUMNS} minWidth={1000}>
                {visibleVehicles.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[#57575f]">No vehicles in the fleet.</div>
                ) : visibleVehicles.map(v => (
                  <FleetRow key={v.id} row={v} actions={[
                    { label: "Mark Available", disabled: v.status === "Available", onClick: () => fleetActions.mutate(() => api.patch(`/ambulance/vehicles/${v.id}`, { status: "Available" })) },
                    { label: "Send to Maintenance", disabled: v.status === "Maintenance", onClick: () => fleetActions.mutate(() => api.patch(`/ambulance/vehicles/${v.id}`, { status: "Maintenance" })) },
                    { label: "Delete", danger: true, onClick: () => fleetActions.remove(v.id, v.vehicleNumber) },
                  ]} />
                ))}
              </DataTable>
            </>
          )}
        </div>
      </div>
    </>
  );
}
