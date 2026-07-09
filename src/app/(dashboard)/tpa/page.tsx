"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { ShieldCheck, Plus } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { TpaDTO, TpaClaimDTO, PatientDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { TabBar } from "@/components/shared/TabBar";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";

// ─── TPA Master Tab ───────────────────────────────────────────────────────────

const TPA_COLUMNS = [
  { label: "TPA / Insurer",  width: "minmax(180px,1.6fr)" },
  { label: "Code",           width: "100px" },
  { label: "Contact Person", width: "minmax(140px,1.2fr)" },
  { label: "Phone",          width: "150px" },
  { label: "Email",          width: "minmax(160px,1.4fr)" },
  { label: "Status",         width: "100px" },
  { label: "Action",         width: "52px", align: "right" as const },
];

function TpaRow({ row, actions }: { row: TpaDTO; actions: RowAction[] }) {
  return (
    <div className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.name}</span>
      <span className="text-[13px] font-normal text-[#009598]">{row.code || "—"}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.contactPerson || "—"}</span>
      <span className="text-[13px] font-normal text-[#57575f] whitespace-nowrap">{row.phone || "—"}</span>
      <span className="text-[13px] font-normal text-[#57575f] truncate">{row.email || "—"}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </div>
  );
}

// ─── Claims Tab ───────────────────────────────────────────────────────────────

const CLAIM_COLUMNS = [
  { label: "Patient",   width: "minmax(150px,1.4fr)" },
  { label: "TPA",       width: "minmax(160px,1.4fr)" },
  { label: "Bill #",    width: "130px" },
  { label: "Claimed",   width: "110px", align: "right" as const },
  { label: "Approved",  width: "110px", align: "right" as const },
  { label: "Date",      width: "110px" },
  { label: "Status",    width: "120px" },
  { label: "Action",    width: "52px", align: "right" as const },
];
const CLAIM_FILTERS = [
  { id: "All", label: "All" }, { id: "Submitted", label: "Submitted" },
  { id: "In Review", label: "In Review" }, { id: "Approved", label: "Approved" },
  { id: "Settled", label: "Settled" }, { id: "Rejected", label: "Rejected" },
];

function ClaimRow({ row, actions }: { row: TpaClaimDTO; actions: RowAction[] }) {
  return (
    <div className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.patientName}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.tpaName}</span>
      <span className="text-[13px] font-normal text-[#009598] whitespace-nowrap">{row.billNumber || "—"}</span>
      <span className="text-[13px] font-normal text-[#11111c] text-right">₹{row.claimAmount.toLocaleString("en-IN")}</span>
      <span className="text-[13px] font-medium text-[#11111c] text-right">{row.approvedAmount > 0 ? `₹${row.approvedAmount.toLocaleString("en-IN")}` : "—"}</span>
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{row.date}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TpaPage() {
  const [tab, setTab] = useState("claims");
  const [tpaSearch, setTpaSearch] = useState("");
  const [claimFilter, setClaimFilter] = useState("All");
  const [claimSearch, setClaimSearch] = useState("");
  const [modal, setModal] = useState<"" | "tpa" | "claim">("");

  const { items: tpas, reload: reloadTpas } = useList<TpaDTO>("/tpa", { all: true });
  const { items: claims, reload: reloadClaims } = useList<TpaClaimDTO>("/tpa/claims", { all: true });
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const tpaActions = useRowActions("tpa", reloadTpas);
  const claimActions = useRowActions("tpa/claims", reloadClaims);
  const { run, loading, error, reset } = useMutation();

  const [tpaForm, setTpaForm] = useState({ name: "", code: "", contactPerson: "", phone: "", email: "", address: "" });
  const [claimForm, setClaimForm] = useState({ tpaId: "", patientId: "", billNumber: "", claimAmount: "" });

  const closeModal = () => { setModal(""); reset(); };

  async function submitTpa() {
    await run(() => api.post("/tpa", tpaForm));
    setTpaForm({ name: "", code: "", contactPerson: "", phone: "", email: "", address: "" });
    closeModal();
    reloadTpas();
  }

  async function submitClaim() {
    const patient = patients.find(p => String(p.id) === claimForm.patientId);
    await run(() => api.post("/tpa/claims", {
      tpaId: Number(claimForm.tpaId),
      patientId: claimForm.patientId ? Number(claimForm.patientId) : undefined,
      patientName: patient?.name ?? "",
      billNumber: claimForm.billNumber,
      claimAmount: Number(claimForm.claimAmount),
    }));
    setClaimForm({ tpaId: "", patientId: "", billNumber: "", claimAmount: "" });
    closeModal();
    reloadClaims();
  }

  /** Approve a claim for its full claimed amount. */
  const approveClaim = (c: TpaClaimDTO) =>
    claimActions.mutate(() => api.patch(`/tpa/claims/${c.id}`, { status: "Approved", approvedAmount: c.claimAmount }));

  const TABS = [
    { id: "claims", label: "Claims",       count: claims.length },
    { id: "master", label: "TPA Master",   count: tpas.length },
  ];

  const pendingClaims = claims.filter(c => c.status === "Submitted" || c.status === "In Review").length;

  const visibleTpas = tpas.filter(t => {
    const q = tpaSearch.toLowerCase();
    return !q || t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q) || t.contactPerson.toLowerCase().includes(q);
  });
  const visibleClaims = claims.filter(c => {
    const matchF = claimFilter === "All" || c.status === claimFilter;
    const q = claimSearch.toLowerCase();
    return matchF && (!q || c.patientName.toLowerCase().includes(q) || c.tpaName.toLowerCase().includes(q) || c.billNumber.toLowerCase().includes(q));
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
      {tpaActions.dialog}
      {claimActions.dialog}

      <Modal open={modal === "tpa"} onClose={closeModal} title="Add TPA / Insurer"
        footer={modalFooter(submitTpa, "Add TPA", !tpaForm.name)}>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Name *"><FormInput placeholder="e.g. MediAssist India" value={tpaForm.name} onChange={v => setTpaForm(f => ({ ...f, name: v }))} /></FormRow>
          <FormRow label="Code"><FormInput placeholder="e.g. TPA-005" value={tpaForm.code} onChange={v => setTpaForm(f => ({ ...f, code: v }))} /></FormRow>
          <FormRow label="Contact Person"><FormInput placeholder="Name" value={tpaForm.contactPerson} onChange={v => setTpaForm(f => ({ ...f, contactPerson: v }))} /></FormRow>
          <FormRow label="Phone"><FormInput placeholder="+91 ..." value={tpaForm.phone} onChange={v => setTpaForm(f => ({ ...f, phone: v }))} /></FormRow>
          <FormRow label="Email"><FormInput placeholder="claims@..." value={tpaForm.email} onChange={v => setTpaForm(f => ({ ...f, email: v }))} /></FormRow>
          <FormRow label="Address"><FormInput placeholder="City" value={tpaForm.address} onChange={v => setTpaForm(f => ({ ...f, address: v }))} /></FormRow>
          {modalError}
        </div>
      </Modal>

      <Modal open={modal === "claim"} onClose={closeModal} title="Submit Claim"
        footer={modalFooter(submitClaim, "Submit Claim", !claimForm.tpaId || !claimForm.patientId || !claimForm.claimAmount)}>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="TPA / Insurer *"><FormSelect placeholder="Select TPA" value={claimForm.tpaId} onChange={v => setClaimForm(f => ({ ...f, tpaId: v }))} options={tpas.filter(t => t.status === "Active").map(t => ({ value: String(t.id), label: t.name }))} /></FormRow>
          <FormRow label="Patient *"><FormSelect placeholder="Search patient" value={claimForm.patientId} onChange={v => setClaimForm(f => ({ ...f, patientId: v }))} options={patients.map(p => ({ value: String(p.id), label: `${p.name} — ${p.patientId}` }))} /></FormRow>
          <FormRow label="Bill Number"><FormInput placeholder="INV-..." value={claimForm.billNumber} onChange={v => setClaimForm(f => ({ ...f, billNumber: v }))} /></FormRow>
          <FormRow label="Claim Amount (₹) *"><FormInput type="number" placeholder="0" value={claimForm.claimAmount} onChange={v => setClaimForm(f => ({ ...f, claimAmount: v }))} /></FormRow>
          {modalError}
        </div>
      </Modal>

      <PageHeader
        title="TPA / Insurance"
        subtitle="Manage insurance companies and track cashless claim settlements."
        stats={[{ icon: ShieldCheck, value: `${pendingClaims}`, label: "Open Claims" }]}
        action={{ label: tab === "master" ? "Add TPA" : "Submit Claim", icon: Plus, onClick: () => setModal(tab === "master" ? "tpa" : "claim") }}
      />
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 655 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />

          {tab === "claims" && (
            <>
              <FilterBar filters={CLAIM_FILTERS} searchPlaceholder="Search by patient, TPA, or bill number..."
                activeFilter={claimFilter} onFilterChange={setClaimFilter} searchQuery={claimSearch} onSearchChange={setClaimSearch}
                action={{ label: "Submit Claim", icon: Plus, onClick: () => setModal("claim") }} />
              <DataTable columns={CLAIM_COLUMNS} minWidth={1150}>
                {visibleClaims.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[#57575f]">No claims found.</div>
                ) : visibleClaims.map(c => (
                  <ClaimRow key={c.id} row={c} actions={[
                    { label: "Move to Review", disabled: c.status !== "Submitted", onClick: () => claimActions.mutate(() => api.patch(`/tpa/claims/${c.id}`, { status: "In Review" })) },
                    { label: "Approve (full amount)", disabled: c.status === "Approved" || c.status === "Settled", onClick: () => approveClaim(c) },
                    { label: "Reject", disabled: c.status === "Rejected" || c.status === "Settled", onClick: () => claimActions.mutate(() => api.patch(`/tpa/claims/${c.id}`, { status: "Rejected" })) },
                    { label: "Mark Settled", disabled: c.status !== "Approved", onClick: () => claimActions.mutate(() => api.patch(`/tpa/claims/${c.id}`, { status: "Settled" })) },
                    { label: "Delete", danger: true, onClick: () => claimActions.remove(c.id, `claim for ${c.patientName}`) },
                  ]} />
                ))}
              </DataTable>
            </>
          )}

          {tab === "master" && (
            <>
              <FilterBar filters={[{ id: "All", label: "All" }]} searchPlaceholder="Search by name, code, or contact..."
                activeFilter="All" onFilterChange={() => {}} searchQuery={tpaSearch} onSearchChange={setTpaSearch}
                action={{ label: "Add TPA", icon: Plus, onClick: () => setModal("tpa") }} />
              <DataTable columns={TPA_COLUMNS} minWidth={1100}>
                {visibleTpas.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[#57575f]">No TPAs registered.</div>
                ) : visibleTpas.map(t => (
                  <TpaRow key={t.id} row={t} actions={[
                    { label: t.status === "Active" ? "Mark Inactive" : "Mark Active", onClick: () => tpaActions.mutate(() => api.patch(`/tpa/${t.id}`, { status: t.status === "Active" ? "Inactive" : "Active" })) },
                    { label: "Delete", danger: true, onClick: () => tpaActions.remove(t.id, t.name) },
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
