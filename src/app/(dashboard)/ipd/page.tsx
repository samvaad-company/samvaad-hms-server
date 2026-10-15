"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { formatDate, todayIso } from "@/lib/dates";
import { useRouter } from "next/navigation";
import { BedDouble, Plus } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { IpdRecordDTO, PatientDTO, DoctorDTO, BedDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { usePagination } from "@/components/shared/Pagination";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormSelect, FormInput, FormTextarea } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import Link from "next/link";
import type { IpdRecord } from "@/types";

const COLUMNS = [
  { label: "Patient",   width: "minmax(140px,1.3fr)" },
  { label: "Age",       width: "60px" },
  { label: "Patient ID", width: "100px" },
  { label: "Admitted",  width: "110px" },
  { label: "Ward",      width: "minmax(110px,1fr)" },
  { label: "Bed",       width: "80px" },
  { label: "Doctor",    width: "minmax(130px,1.2fr)" },
  { label: "Diagnosis", width: "minmax(150px,1.5fr)" },
  { label: "Credit Limit", width: "110px", align: "right" as const },
  { label: "Status",    width: "110px" },
  { label: "Action",    width: "52px", align: "right" as const },
];

const FILTERS = [
  { id: "All",        label: "All" },
  { id: "Admitted",   label: "Admitted" },
  { id: "ICU",        label: "ICU" },
  { id: "Discharged", label: "Discharged" },
];

const MIN_WIDTH = 1330;

function IpdRow({ row, actions }: { row: IpdRecord; actions: RowAction[] }) {
  return (
    <Link href={`/ipd/${row.id}`} className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[color:var(--ink)] truncate">{row.patientName}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink-soft)]">{row.patientAge}</span>
      <span className="text-[12px] font-medium text-[color:var(--brand)] truncate">{row.patientId}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink)] whitespace-nowrap">{formatDate(row.admissionDate)}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink)] truncate">{row.ward}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink)]">{row.bed}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink)] truncate">{row.doctor}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink)] truncate">{row.diagnosis}</span>
      <span className="text-[13px] font-normal text-[color:var(--ink)] text-right whitespace-nowrap">{row.creditLimit > 0 ? `₹${row.creditLimit.toLocaleString("en-IN")}` : "—"}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </Link>
  );
}

export default function IpdPage() {
  const { can } = useAuth();
  const canWrite = can("ipd", "write");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [ward, setWard] = useState("");

  const { items: ipdRecords, reload } = useList<IpdRecordDTO>("/ipd", { all: true });
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  const { items: beds, reload: reloadBeds } = useList<BedDTO>("/beds", { all: true });
  const { run, loading, error } = useMutation();
  const router = useRouter();
  const { dialog, remove, mutate, ask } = useRowActions("ipd", () => { reload(); reloadBeds(); });

  const [form, setForm] = useState({ patientId: "", doctorId: "", bedId: "", status: "Admitted", diagnosis: "", creditLimit: "" });
  const [admissionDate, setAdmissionDate] = useState(todayIso());
  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }));
  const admissionDateValid = Boolean(admissionDate) && admissionDate >= todayIso();

  async function admit() {
    const patient = patients.find(p => String(p.id) === form.patientId);
    await run(() =>
      api.post("/ipd", {
        patientId: Number(form.patientId),
        patientName: patient?.name ?? "",
        doctorId: form.doctorId ? Number(form.doctorId) : undefined,
        bedId: Number(form.bedId),
        ward,
        status: form.status,
        diagnosis: form.diagnosis,
        creditLimit: form.creditLimit ? Number(form.creditLimit) : 0,
        admissionDate,
      }),
    );
    setForm({ patientId: "", doctorId: "", bedId: "", status: "Admitted", diagnosis: "", creditLimit: "" });
    setWard("");
    setAdmissionDate(todayIso());
    setShowModal(false);
    reload();
    reloadBeds();
  }

  // Quick "Add Doctor Round" from the list, without navigating to the admission page.
  const [roundTarget, setRoundTarget] = useState<IpdRecordDTO | null>(null);
  const [roundFindings, setRoundFindings] = useState("");
  const [roundOrders, setRoundOrders] = useState("");
  const { run: runRound, loading: roundLoading } = useMutation();

  function openRound(r: IpdRecordDTO) {
    setRoundTarget(r);
    setRoundFindings("");
    setRoundOrders("");
  }

  async function saveRound() {
    if (!roundTarget) return;
    const combined = [roundFindings.trim() && `Findings: ${roundFindings.trim()}`, roundOrders.trim() && `Orders: ${roundOrders.trim()}`]
      .filter(Boolean).join("\n\n");
    if (!combined) return;
    await runRound(() => api.post("/ipd/notes", { admissionId: roundTarget.id, noteType: "Doctor Round", content: combined }));
    setRoundTarget(null);
  }

  const WARD_OPTS = [...new Set(beds.map(b => b.ward))].map(w => ({ value: w, label: w }));

  const visible = ipdRecords.filter(r => {
    const matchF = filter === "All" || r.status === filter;
    const q = search.toLowerCase();
    const matchS = !q || r.patientName.toLowerCase().includes(q) || r.patientId.toLowerCase().includes(q) || r.doctor.toLowerCase().includes(q) || r.diagnosis.toLowerCase().includes(q);
    return matchF && matchS;
  });

  const { rows: pagedVisible, bar: barVisible } = usePagination(visible, "admissions");

  const availableBeds = beds.filter(b => b.ward === ward && b.status === "Available");

  return (
    <>
      {dialog}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Quick Admission" width={640}
        footer={
          <>
            <button onClick={() => setShowModal(false)} className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
            <Link href="/ipd/new" onClick={() => setShowModal(false)} className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Full Form →</Link>
            <button onClick={admit} disabled={loading || !form.patientId || !form.bedId || !form.diagnosis.trim() || !admissionDateValid}
              className="text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
              {loading ? "Admitting…" : "Admit Patient"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Patient *">
            <SearchSelect
              placeholder="Search patient by name, ID or phone…"
              value={form.patientId}
              onChange={v => set("patientId", v)}
              options={patients.map(p => ({ value: String(p.id), label: p.name, hint: `${p.patientId ?? ""} · ${p.phone}` }))}
            />
          </FormRow>
          <FormRow label="Admission Date *" error={admissionDate && !admissionDateValid ? "Cannot be in the past" : undefined}>
            <FormInput type="date" value={admissionDate} onChange={setAdmissionDate} min={todayIso()} error={Boolean(admissionDate) && !admissionDateValid} />
          </FormRow>
          <FormRow label="Doctor *"><FormSelect placeholder="Select doctor" value={form.doctorId} onChange={v => set("doctorId", v)} options={doctors.map(d => ({ value: String(d.id), label: d.name }))} /></FormRow>
          <FormRow label="Ward *"><FormSelect placeholder="Select ward" options={WARD_OPTS} value={ward} onChange={v => { setWard(v); set("bedId", ""); }} /></FormRow>
          <FormRow label="Bed *"><FormSelect placeholder={ward ? `${availableBeds.length} available` : "Select ward first"} value={form.bedId} onChange={v => set("bedId", v)} options={availableBeds.map(b => ({ value: String(b.id), label: b.bedNumber }))} /></FormRow>
          <FormRow label="Status"><FormSelect placeholder="Status" value={form.status} onChange={v => set("status", v)} options={["Admitted","ICU"].map(s => ({ value: s, label: s }))} /></FormRow>
          <FormRow label="Credit Limit (₹)" hint="Maximum credit allowed for this admission"><FormInput type="number" placeholder="e.g. 50000" value={form.creditLimit} onChange={v => set("creditLimit", v)} /></FormRow>
          <div className="col-span-2"><FormRow label="Diagnosis / Reason"><FormInput placeholder="Provisional diagnosis or reason for admission" value={form.diagnosis} onChange={v => set("diagnosis", v)} /></FormRow></div>
          {error && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
        </div>
      </Modal>

      <Modal open={!!roundTarget} onClose={() => setRoundTarget(null)} title={roundTarget ? `Add Doctor Round — ${roundTarget.patientName}` : ""}
        footer={
          <>
            <button onClick={() => setRoundTarget(null)} className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
            <button onClick={saveRound} disabled={roundLoading || (!roundFindings.trim() && !roundOrders.trim())}
              className="text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
              {roundLoading ? "Saving…" : "Add Round"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormRow label="Findings">
            <FormTextarea placeholder="Clinical findings on this round…" rows={3} value={roundFindings} onChange={setRoundFindings} />
          </FormRow>
          <FormRow label="Orders">
            <FormTextarea placeholder="Orders / instructions…" rows={3} value={roundOrders} onChange={setRoundOrders} />
          </FormRow>
        </div>
      </Modal>

      <PageHeader
        title="IPD"
        subtitle="Manage inpatient admissions, ward assignments, and discharge records."
        stats={[{ icon: BedDouble, value: `${visible.filter(r => r.status !== "Discharged").length}`, label: "Active Admissions" }]}
        action={canWrite ? { label: "New Admission", icon: Plus, onClick: () => setShowModal(true) } : undefined}
      />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 220 }}>
          <FilterBar
            filters={FILTERS}
            searchPlaceholder="Search by patient name, ID, or ward..."
            activeFilter={filter}
            onFilterChange={setFilter}
            searchQuery={search}
            onSearchChange={setSearch}
          />
          <DataTable columns={COLUMNS} minWidth={MIN_WIDTH}>
            {pagedVisible.map((r) => (
              <IpdRow key={r.id} row={r} actions={[
                { label: "View admission", onClick: () => router.push(`/ipd/${r.id}`) },
                ...(canWrite ? [
                  { label: "Add doctor round", disabled: r.status === "Discharged", onClick: () => openRound(r) },
                  { label: "Discharge", disabled: r.status === "Discharged", onClick: () => ask({ title: "Discharge patient", message: `Discharge ${r.patientName} and free bed ${r.bed}?`, confirmLabel: "Discharge", action: () => api.post(`/ipd/${r.id}/discharge`) }) },
                  { label: "Move to ICU", disabled: r.status === "ICU" || r.status === "Discharged", onClick: () => mutate(() => api.patch(`/ipd/${r.id}`, { status: "ICU" })) },
                  { label: "Delete", danger: true, onClick: () => remove(r.id, r.patientName) },
                ] : []),
              ]} />
            ))}
          </DataTable>
{barVisible}
        </div>
      </div>
    </>
  );
}
