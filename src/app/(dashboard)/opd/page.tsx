"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tw } from "@/lib/design-system";
import { Activity, Plus, CheckCircle, XCircle } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { OpdRecordDTO, PatientDTO, DoctorDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import type { OpdRecord } from "@/types";

const COLUMNS = [
  { label: "Token",  width: "80px" },
  { label: "Patient", width: "minmax(140px,1.3fr)" },
  { label: "Age",    width: "55px" },
  { label: "Doctor", width: "minmax(130px,1.2fr)" },
  { label: "Reason", width: "minmax(140px,1.4fr)" },
  { label: "Priority", width: "100px" },
  { label: "Vitals", width: "150px" },
  { label: "Wait",   width: "80px" },
  { label: "Check-in", width: "95px" },
  { label: "Status", width: "130px" },
  { label: "Action", width: "52px", align: "right" as const },
];

const PRIORITY_CLR: Record<string, string> = {
  Emergency: "bg-[#ffe9e9] text-[#ff0004]",
  Urgent:    "bg-[#fff2e0] text-[#ff9000]",
  Normal:    "bg-[#f0f0f0] text-[#57575f]",
};

/** Compact vitals readout, e.g. "120/80 · 74 · 98.6°F · 98%". */
function vitalsSummary(v: OpdRecord["vitals"]): string {
  const parts: string[] = [];
  if (v.bpSystolic && v.bpDiastolic) parts.push(`${v.bpSystolic}/${v.bpDiastolic}`);
  if (v.pulse) parts.push(`${v.pulse} bpm`);
  if (v.temperature) parts.push(`${v.temperature}°F`);
  if (v.spo2) parts.push(`${v.spo2}%`);
  return parts.join(" · ");
}

const FILTERS = [
  { id: "All",             label: "All" },
  { id: "Waiting",         label: "Waiting" },
  { id: "InConsultation",  label: "In Consultation" },
  { id: "Completed",       label: "Completed" },
];

const MIN_WIDTH = 1340;

function OpdRow({ row, actions }: { row: OpdRecord; actions: RowAction[] }) {
  return (
    <div className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#009598]">{row.tokenNumber}</span>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.patientName}</span>
      <span className="text-[13px] font-normal text-[#57575f]">{row.patientAge}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.doctor}</span>
      <span className="text-[13px] font-normal text-[#57575f] truncate" title={row.reason}>
        {row.reason || "—"}
      </span>
      <div>
        <span className={`inline-flex px-[8px] py-[3px] rounded-full text-[11px] font-medium ${PRIORITY_CLR[row.priority] ?? PRIORITY_CLR.Normal}`}>
          {row.priority}
        </span>
      </div>
      <div className="flex items-center gap-[6px] min-w-0">
        {row.vitalsRecorded ? (
          <CheckCircle size={15} className="text-[#00955c] shrink-0" />
        ) : (
          <XCircle size={15} className="text-[#ff0004] shrink-0" />
        )}
        <span
          className={`text-[12px] font-normal truncate ${row.vitalsRecorded ? "text-[#11111c]" : "text-[#ff0004]"}`}
          title={vitalsSummary(row.vitals)}
        >
          {row.vitalsRecorded ? (vitalsSummary(row.vitals) || "Recorded") : "Pending"}
        </span>
      </div>
      <span className="text-[13px] font-normal text-[#11111c]">{row.waitTime}</span>
      <span className="text-[13px] font-normal text-[#11111c]">{row.checkInTime}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </div>
  );
}

const STATUS_MAP: Record<string, string> = { "InConsultation": "In Consultation" };

/**
 * Sending a patient to radiology used to always default the order to
 * "In-house" — a linked center only sees studies explicitly routed to it, so
 * silently defaulting away from it meant the center's queue never filled up.
 * Surface every destination (in-house + each active-linked center) as its
 * own row action instead of one generic link.
 */
function sendToRadiologyActions(
  r: OpdRecordDTO,
  centers: { id: number; name: string }[],
  router: ReturnType<typeof useRouter>,
): RowAction[] {
  const go = (radiologyCenterId?: number) =>
    router.push(
      `/radiology?patientId=${r.patientId}${r.doctorId ? `&doctorId=${r.doctorId}` : ""}${radiologyCenterId ? `&radiologyCenterId=${radiologyCenterId}` : ""}`,
    );
  if (centers.length === 0) {
    return [{ label: "Send to Radiology", disabled: !r.patientId, onClick: () => go() }];
  }
  return [
    { label: "Send to Radiology — In-house", disabled: !r.patientId, onClick: () => go() },
    ...centers.map((c) => ({
      label: `Send to Radiology — ${c.name}`,
      disabled: !r.patientId,
      onClick: () => go(c.id),
    })),
  ];
}

/** Same destination-choice pattern as radiology, for lab orders. */
function sendToLabActions(
  r: OpdRecordDTO,
  centers: { id: number; name: string }[],
  router: ReturnType<typeof useRouter>,
): RowAction[] {
  const go = (labCenterId?: number) =>
    router.push(
      `/lab?patientId=${r.patientId}${r.doctorId ? `&doctorId=${r.doctorId}` : ""}${labCenterId ? `&labCenterId=${labCenterId}` : ""}`,
    );
  if (centers.length === 0) {
    return [{ label: "Send to Lab", disabled: !r.patientId, onClick: () => go() }];
  }
  return [
    { label: "Send to Lab — In-house", disabled: !r.patientId, onClick: () => go() },
    ...centers.map((c) => ({
      label: `Send to Lab — ${c.name}`,
      disabled: !r.patientId,
      onClick: () => go(c.id),
    })),
  ];
}

export default function OpdPage() {
  const { can } = useAuth();
  const router = useRouter();
  const canWrite = can("opd", "write");
  const canOrderRadiology = can("radiology", "write");
  const canOrderLab = can("lab", "write");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingRow, setEditingRow] = useState<OpdRecordDTO | null>(null);
  const { items: opdRecords, reload } = useList<OpdRecordDTO>("/opd", { all: true });
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  // Linked radiology centers this hospital can route studies to — used to
  // offer a destination choice on "Send to Radiology" instead of silently
  // defaulting to in-house.
  const { items: radiologyCenters } = useList<{ id: number; name: string }>("/radiology/routable-centers");
  // Linked lab centers this hospital can route tests to — same purpose as
  // radiologyCenters above, for "Send to Lab".
  const { items: labCenters } = useList<{ id: number; name: string }>("/lab/routable-centers");
  const { run, loading, error } = useMutation();
  const { dialog, remove, mutate } = useRowActions("opd", reload);
  // Next token follows the highest existing token, not the row count, so it
  // stays correct after deletions and re-numbering.
  const maxToken = opdRecords.reduce((m, r) => {
    const n = Number(r.tokenNumber.replace(/\D/g, ""));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  const NEXT_TOKEN = `T-${String(maxToken + 1).padStart(3, "0")}`;

  const EMPTY = {
    patientId: "", doctorId: "", reason: "", priority: "Normal",
    bpSystolic: "", bpDiastolic: "", pulse: "", temperature: "", spo2: "",
  };
  const [form, setForm] = useState(EMPTY);
  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  /** Selecting a patient pre-fills their usual doctor and visit reason. */
  function selectPatient(patientId: string) {
    const p = patients.find(x => String(x.id) === patientId);
    const usualDoctor = p ? doctors.find(d => d.name === p.doctor) : undefined;
    setForm(prev => ({
      ...prev,
      patientId,
      doctorId: usualDoctor ? String(usualDoctor.id) : prev.doctorId,
      reason: p?.reason || prev.reason,
    }));
  }

  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  function closeModal() {
    setShowModal(false);
    setEditingRow(null);
    setForm(EMPTY);
  }

  /** Open the modal pre-filled with an existing entry's details. */
  function openEdit(row: OpdRecordDTO) {
    setEditingRow(row);
    setForm({
      patientId: row.patientId != null ? String(row.patientId) : "",
      doctorId: row.doctorId != null ? String(row.doctorId) : "",
      reason: row.reason ?? "",
      priority: row.priority,
      bpSystolic: row.vitals.bpSystolic ? String(row.vitals.bpSystolic) : "",
      bpDiastolic: row.vitals.bpDiastolic ? String(row.vitals.bpDiastolic) : "",
      pulse: row.vitals.pulse ? String(row.vitals.pulse) : "",
      temperature: row.vitals.temperature ? String(row.vitals.temperature) : "",
      spo2: row.vitals.spo2 ? String(row.vitals.spo2) : "",
    });
    setShowModal(true);
  }

  async function checkIn() {
    const patient = patients.find(p => String(p.id) === form.patientId);
    const doctor = doctors.find(d => String(d.id) === form.doctorId);
    await run(() =>
      api.post("/opd", {
        patientId: Number(form.patientId),
        patientName: patient?.name ?? "",
        patientAge: patient?.age ?? 0,
        doctorId: form.doctorId ? Number(form.doctorId) : undefined,
        doctor: doctor?.name ?? "",
        reason: form.reason,
        priority: form.priority,
        bpSystolic: num(form.bpSystolic),
        bpDiastolic: num(form.bpDiastolic),
        pulse: num(form.pulse),
        temperature: num(form.temperature),
        spo2: num(form.spo2),
      }),
    );
    closeModal();
    reload();
  }

  async function saveEdit() {
    if (!editingRow) return;
    await run(() =>
      api.patch(`/opd/${editingRow.id}`, {
        doctorId: form.doctorId ? Number(form.doctorId) : undefined,
        reason: form.reason,
        priority: form.priority,
        bpSystolic: num(form.bpSystolic),
        bpDiastolic: num(form.bpDiastolic),
        pulse: num(form.pulse),
        temperature: num(form.temperature),
        spo2: num(form.spo2),
      }),
    );
    closeModal();
    reload();
  }

  const submit = editingRow ? saveEdit : checkIn;

  const visible = opdRecords.filter(r => {
    const matchF = filter === "All" || r.status === (STATUS_MAP[filter] ?? filter);
    const q = search.toLowerCase();
    const matchS = !q || r.patientName.toLowerCase().includes(q) || r.doctor.toLowerCase().includes(q) || r.tokenNumber.toLowerCase().includes(q);
    return matchF && matchS;
  });

  return (
    <>
      {dialog}
      <Modal open={showModal} onClose={closeModal} title={editingRow ? `Edit OPD Entry — ${editingRow.tokenNumber}` : "New OPD Check-in"}
        footer={
          <>
            <button onClick={closeModal} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
            <button onClick={submit} disabled={loading || (!editingRow && !form.patientId)}
              className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
              {loading ? (editingRow ? "Saving…" : "Issuing…") : editingRow ? "Save Changes" : "Issue Token"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          {editingRow ? (
            <div className="col-span-2 flex items-center gap-3 p-3 bg-[#e8f7f7] rounded-[10px]">
              <div className="flex flex-col">
                <span className="text-[10px] font-medium text-[#009598] uppercase tracking-wider">{editingRow.tokenNumber}</span>
                <span className="text-[16px] font-medium text-[#11111c]">{editingRow.patientName}</span>
              </div>
            </div>
          ) : (
            <div className="col-span-2 flex items-center gap-3 p-3 bg-[#e8f7f7] rounded-[10px]">
              <div className="flex flex-col">
                <span className="text-[10px] font-medium text-[#009598] uppercase tracking-wider">Next Token</span>
                <span className="text-[24px] font-medium text-[#009598]">{NEXT_TOKEN}</span>
              </div>
            </div>
          )}
          {!editingRow && (
            <FormRow label="Patient *">
              <SearchSelect
                placeholder="Search patient by name, ID or phone…"
                value={form.patientId}
                onChange={selectPatient}
                options={patients.map(p => ({ value: String(p.id), label: p.name, hint: `${p.patientId ?? ""} · ${p.phone}` }))}
              />
            </FormRow>
          )}
          <FormRow label="Doctor *">
            <FormSelect placeholder="Select doctor" value={form.doctorId} onChange={v => set("doctorId", v)} options={doctors.map(d => ({ value: String(d.id), label: d.name }))} />
          </FormRow>
          <div className="col-span-2"><FormRow label="Chief Complaint"><FormInput placeholder="Brief reason for visit" value={form.reason} onChange={v => set("reason", v)} /></FormRow></div>
          <FormRow label="Priority">
            <FormSelect placeholder="Normal" value={form.priority} onChange={v => set("priority", v)}
              options={[{ value: "Normal", label: "Normal" }, { value: "Urgent", label: "Urgent" }, { value: "Emergency", label: "Emergency" }]} />
          </FormRow>
          <div />

          <div className="col-span-2 border-t border-[#f0f0f0] pt-3">
            <p className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider mb-1">
              Vitals <span className="font-normal normal-case">— optional; entering any reading marks vitals as recorded</span>
            </p>
          </div>
          <FormRow label="Blood Pressure (mmHg)">
            <div className="flex items-center gap-2">
              <FormInput placeholder="120" type="number" value={form.bpSystolic} onChange={v => set("bpSystolic", v)} />
              <span className="text-[#57575f]">/</span>
              <FormInput placeholder="80" type="number" value={form.bpDiastolic} onChange={v => set("bpDiastolic", v)} />
            </div>
          </FormRow>
          <FormRow label="Pulse (bpm)">
            <FormInput placeholder="72" type="number" value={form.pulse} onChange={v => set("pulse", v)} />
          </FormRow>
          <FormRow label="Temperature (°F)">
            <FormInput placeholder="98.6" type="number" value={form.temperature} onChange={v => set("temperature", v)} />
          </FormRow>
          <FormRow label="Oxygen / SpO₂ (%)">
            <FormInput placeholder="98" type="number" value={form.spo2} onChange={v => set("spo2", v)} />
          </FormRow>
          {error && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
        </div>
      </Modal>

      <PageHeader
        title="OPD Queue"
        subtitle="Manage today's outpatient queue — track tokens, vitals, and consultation status in real time."
        stats={[{ icon: Activity, value: `${visible.length}`, label: "Active Tokens" }]}
        action={canWrite ? { label: "New Check-in", icon: Plus, onClick: () => { setEditingRow(null); setForm(EMPTY); setShowModal(true); } } : undefined}
        dateRange={false}
      />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 220 }}>
          <FilterBar
            filters={FILTERS}
            searchPlaceholder="Search by token, patient name, or doctor..."
            activeFilter={filter}
            onFilterChange={setFilter}
            searchQuery={search}
            onSearchChange={setSearch}
          />
          <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
            {visible.map((r) => (
              <OpdRow key={r.id} row={r} actions={[
                ...(canWrite ? [
                  { label: "Edit", onClick: () => openEdit(r) },
                  { label: "Begin consultation", disabled: r.status !== "Waiting", onClick: () => mutate(() => api.patch(`/opd/${r.id}`, { status: "In Consultation" })) },
                  { label: "Mark completed", disabled: r.status === "Completed", onClick: () => mutate(() => api.patch(`/opd/${r.id}`, { status: "Completed" })) },
                  { label: r.vitalsRecorded ? "Vitals recorded ✓" : "Record vitals", disabled: r.vitalsRecorded, onClick: () => mutate(() => api.patch(`/opd/${r.id}`, { vitalsRecorded: true })) },
                ] : []),
                ...(canOrderRadiology ? sendToRadiologyActions(r, radiologyCenters, router) : []),
                ...(canOrderLab ? sendToLabActions(r, labCenters, router) : []),
                ...(canWrite ? [
                  { label: "Delete", danger: true, onClick: () => remove(r.id, r.tokenNumber) },
                ] : []),
              ]} />
            ))}
          </DataTable>
        </div>
      </div>
    </>
  );
}
