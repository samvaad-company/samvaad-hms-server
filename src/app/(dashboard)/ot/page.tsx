"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { Scissors, Plus } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { OtRecordDTO, PatientDTO, DoctorDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import Link from "next/link";
import type { OtRecord } from "@/types";

const COLUMNS = [
  { label: "Patient",     width: "minmax(140px,1.3fr)" },
  { label: "Procedure",   width: "minmax(160px,1.6fr)" },
  { label: "OT Room",     width: "90px" },
  { label: "Surgeon",     width: "minmax(140px,1.2fr)" },
  { label: "Anesthetist", width: "minmax(130px,1.1fr)" },
  { label: "Date",        width: "110px" },
  { label: "Time",        width: "90px" },
  { label: "Status",      width: "120px" },
  { label: "Action",      width: "52px", align: "right" as const },
];

const FILTERS = [
  { id: "All",        label: "All" },
  { id: "Scheduled",  label: "Scheduled" },
  { id: "InProgress", label: "In Progress" },
  { id: "Completed",  label: "Completed" },
  { id: "Cancelled",  label: "Cancelled" },
];

const MIN_WIDTH = 1200;

function OtRow({ row, actions }: { row: OtRecord; actions: RowAction[] }) {
  return (
    <div className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.patientName}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.procedure}</span>
      <div>
        <span className="inline-flex items-center px-[8px] py-[3px] rounded-full text-[11px] font-medium bg-[#f2f3f3] text-[#11111c] whitespace-nowrap">
          {row.otRoom}
        </span>
      </div>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.surgeon}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.anesthetist}</span>
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{formatDate(row.scheduledDate)}</span>
      <span className="text-[12px] font-light text-[#57575f] whitespace-nowrap">{row.scheduledTime}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </div>
  );
}

const OT_ROOMS = ["OT-1 (General Surgery)","OT-2 (Cardiac)","OT-3 (Orthopaedics)","OT-4 (Neurosurgery)","OT-5 (Gynaecology)"].map(r => ({ value: r, label: r }));
const FILTER_MAP: Record<string, string> = { "InProgress": "In Progress" };

export default function OtPage() {
  const router = useRouter();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const { items: otRecords, reload } = useList<OtRecordDTO>("/ot", { all: true });
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  const { run, loading, error } = useMutation();
  const { dialog, remove, mutate } = useRowActions("ot", reload);

  const [form, setForm] = useState({ patientId: "", procedure: "", otRoom: "", surgeonId: "", anesthetistId: "", date: "", time: "" });
  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  async function schedule() {
    const patient = patients.find(p => String(p.id) === form.patientId);
    const surgeon = doctors.find(d => String(d.id) === form.surgeonId);
    await run(() =>
      api.post("/ot", {
        patientId: Number(form.patientId),
        patientName: patient?.name ?? "",
        procedure: form.procedure,
        otRoom: form.otRoom,
        surgeonId: form.surgeonId ? Number(form.surgeonId) : undefined,
        anesthetist: doctors.find(d => String(d.id) === form.anesthetistId)?.name ?? "",
        surgeon: surgeon?.name ?? "",
        scheduledDate: form.date,
        scheduledTime: form.time,
      }),
    );
    setForm({ patientId: "", procedure: "", otRoom: "", surgeonId: "", anesthetistId: "", date: "", time: "" });
    setShowModal(false);
    reload();
  }

  const visible = otRecords.filter(r => {
    const matchF = filter === "All" || r.status === (FILTER_MAP[filter] ?? filter);
    const q = search.toLowerCase();
    const matchS = !q || r.patientName.toLowerCase().includes(q) || r.procedure.toLowerCase().includes(q) || r.surgeon.toLowerCase().includes(q);
    return matchF && matchS;
  });

  return (
    <>
      {dialog}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Quick Schedule OT" width={640}
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
            <Link href="/ot/new" onClick={() => setShowModal(false)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Full Form →</Link>
            <button onClick={schedule} disabled={loading || !form.patientId || !form.procedure || !form.otRoom || !form.surgeonId || !form.date || !form.time}
              className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
              {loading ? "Scheduling…" : "Schedule OT"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Patient *"><FormSelect placeholder="Search patient" value={form.patientId} onChange={v => set("patientId", v)} options={patients.map(p => ({ value: String(p.id), label: `${p.name} — ${p.patientId}` }))} /></FormRow>
          <FormRow label="Procedure *"><FormInput placeholder="e.g. Appendectomy, CABG..." value={form.procedure} onChange={v => set("procedure", v)} /></FormRow>
          <FormRow label="OT Room *"><FormSelect placeholder="Select OT" value={form.otRoom} onChange={v => set("otRoom", v)} options={OT_ROOMS} /></FormRow>
          <FormRow label="Surgeon *"><FormSelect placeholder="Select surgeon" value={form.surgeonId} onChange={v => set("surgeonId", v)} options={doctors.map(d => ({ value: String(d.id), label: d.name }))} /></FormRow>
          <FormRow label="Anaesthetist"><FormSelect placeholder="Select anaesthetist" value={form.anesthetistId} onChange={v => set("anesthetistId", v)} options={doctors.map(d => ({ value: String(d.id), label: d.name }))} /></FormRow>
          <FormRow label="Scheduled Date *"><FormInput type="date" value={form.date} onChange={v => set("date", v)} /></FormRow>
          <FormRow label="Start Time *"><FormInput type="time" value={form.time} onChange={v => set("time", v)} /></FormRow>
          {error && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
        </div>
      </Modal>

      <PageHeader
        title="Operation Theatre"
        subtitle="Schedule and track surgical procedures, OT room allocation, and surgical team assignments."
        stats={[{ icon: Scissors, value: `${visible.filter(r => r.status === "Scheduled").length}`, label: "Scheduled OTs" }]}
        action={{ label: "Schedule OT", icon: Plus, onClick: () => setShowModal(true) }}
      />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 220 }}>
          <FilterBar
            filters={FILTERS}
            searchPlaceholder="Search by patient name, procedure, or surgeon..."
            activeFilter={filter}
            onFilterChange={setFilter}
            searchQuery={search}
            onSearchChange={setSearch}
          />
          <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
            {visible.map((r) => (
              <OtRow key={r.id} row={r} actions={[
                { label: "View full form", onClick: () => router.push(`/ot/${r.id}`) },
                { label: "Start procedure", disabled: r.status !== "Scheduled", onClick: () => mutate(() => api.patch(`/ot/${r.id}`, { status: "In Progress" })) },
                { label: "Mark completed", disabled: r.status === "Completed" || r.status === "Cancelled", onClick: () => mutate(() => api.patch(`/ot/${r.id}`, { status: "Completed" })) },
                { label: "Cancel", disabled: r.status === "Cancelled" || r.status === "Completed", onClick: () => mutate(() => api.patch(`/ot/${r.id}`, { status: "Cancelled" })) },
                { label: "Delete", danger: true, onClick: () => remove(r.id, r.procedure) },
              ]} />
            ))}
          </DataTable>
        </div>
      </div>
    </>
  );
}
