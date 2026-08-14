"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { Droplets, Plus } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { BloodDonorDTO, BloodStockDTO, BloodIssueDTO, PatientDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { TabBar } from "@/components/shared/TabBar";
import { Modal } from "@/components/shared/Modal";
import { DocumentsPanel } from "@/components/shared/DocumentsPanel";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { validateAadhaar } from "@/lib/validators";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const COMPONENTS = ["Whole Blood", "Plasma", "Platelets", "RBC"];

// ─── Stock Tab ────────────────────────────────────────────────────────────────

function StockView({ stock, onAdd, canWrite }: { stock: BloodStockDTO[]; onAdd: () => void; canWrite: boolean }) {
  const unitsFor = (group: string, component: string) =>
    stock.find(s => s.bloodGroup === group && s.component === component)?.units ?? 0;

  return (
    <div className="p-5 flex flex-col gap-4 overflow-auto" style={{ height: 580 }}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-light text-[#57575f]">
          Live availability by blood group and component. Issuing blood decrements stock automatically.
        </p>
        {canWrite && (
          <button onClick={onAdd} className="flex items-center gap-[6px] text-[13px] font-normal text-white bg-[#009598] px-4 py-[8px] rounded-full hover:bg-[#007f82] transition-colors whitespace-nowrap">
            <Plus size={14} /> Add Stock
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: 760 }}>
          <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: `120px repeat(${COMPONENTS.length}, 1fr)` }}>
            <div className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider py-2">Group</div>
            {COMPONENTS.map(c => (
              <div key={c} className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider text-center py-2">{c}</div>
            ))}
          </div>
          {BLOOD_GROUPS.map(group => (
            <div key={group} className="grid gap-2 mb-2" style={{ gridTemplateColumns: `120px repeat(${COMPONENTS.length}, 1fr)` }}>
              <div className="flex items-center gap-2 py-2">
                <Droplets size={16} className="text-[#ff0004]" />
                <span className="text-[15px] font-medium text-[#11111c]">{group}</span>
              </div>
              {COMPONENTS.map(component => {
                const units = unitsFor(group, component);
                const cls = units === 0
                  ? "bg-[#ffe9e9] text-[#ff0004]"
                  : units < 3
                    ? "bg-[#fff2e0] text-[#ff9000]"
                    : "bg-[#dffff3] text-[#00955c]";
                return (
                  <div key={component} className={`rounded-[8px] p-3 text-center ${cls}`}>
                    <div className="text-[18px] font-medium leading-none">{units}</div>
                    <div className="text-[10px] font-normal mt-1 opacity-80">unit{units === 1 ? "" : "s"}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Donors Tab ───────────────────────────────────────────────────────────────

const DONOR_COLUMNS = [
  { label: "Donor",          width: "minmax(150px,1.4fr)" },
  { label: "Age",            width: "60px" },
  { label: "Gender",         width: "80px" },
  { label: "Group",          width: "80px" },
  { label: "Phone",          width: "minmax(140px,1.2fr)" },
  { label: "Last Donation",  width: "120px" },
  { label: "Donations",      width: "90px", align: "right" as const },
  { label: "Status",         width: "110px" },
  { label: "Action",         width: "52px", align: "right" as const },
];

function DonorRow({ row, actions }: { row: BloodDonorDTO; actions: RowAction[] }) {
  return (
    <div className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.name}</span>
      <span className="text-[13px] font-normal text-[#57575f]">{row.age}</span>
      <span className="text-[13px] font-normal text-[#57575f]">{row.gender}</span>
      <span className="text-[13px] font-medium text-[#ff0004]">{row.bloodGroup}</span>
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{row.phone}</span>
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{row.lastDonationDate || "—"}</span>
      <span className="text-[13px] font-medium text-[#11111c] text-right">{row.totalDonations}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </div>
  );
}

// ─── Issues Tab ───────────────────────────────────────────────────────────────

const ISSUE_COLUMNS = [
  { label: "Patient",   width: "minmax(150px,1.4fr)" },
  { label: "Group",     width: "80px" },
  { label: "Component", width: "120px" },
  { label: "Units",     width: "70px", align: "right" as const },
  { label: "Doctor",    width: "minmax(140px,1.2fr)" },
  { label: "Date",      width: "110px" },
  { label: "Amount",    width: "100px", align: "right" as const },
  { label: "Status",    width: "110px" },
  { label: "Action",    width: "52px", align: "right" as const },
];

function IssueRow({ row, actions }: { row: BloodIssueDTO; actions: RowAction[] }) {
  return (
    <div className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.patientName}</span>
      <span className="text-[13px] font-medium text-[#ff0004]">{row.bloodGroup}</span>
      <span className="text-[13px] font-normal text-[#11111c]">{row.component}</span>
      <span className="text-[13px] font-medium text-[#11111c] text-right">{row.units}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.doctor || "—"}</span>
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{formatDate(row.date)}</span>
      <span className="text-[13px] font-medium text-[#11111c] text-right">₹{row.amount.toLocaleString("en-IN")}</span>
      <div><StatusBadge status={row.status} /></div>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BloodBankPage() {
  const { can } = useAuth();
  const canWrite = can("bloodbank", "write");
  const [docsFor, setDocsFor] = useState<BloodDonorDTO | null>(null);
  const [tab, setTab] = useState("stock");
  const [donorFilter, setDonorFilter] = useState("All");
  const [donorSearch, setDonorSearch] = useState("");
  const [issueSearch, setIssueSearch] = useState("");
  const [modal, setModal] = useState<"" | "stock" | "donor" | "issue">("");

  const { items: stock, reload: reloadStock } = useList<BloodStockDTO>("/blood-bank/stock", { all: true });
  const { items: donors, reload: reloadDonors } = useList<BloodDonorDTO>("/blood-bank/donors", { all: true });
  const { items: issues, reload: reloadIssues } = useList<BloodIssueDTO>("/blood-bank/issues", { all: true });
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });

  const reloadAll = () => { reloadStock(); reloadDonors(); reloadIssues(); };
  const donorActions = useRowActions("blood-bank/donors", reloadAll);
  const issueActions = useRowActions("blood-bank/issues", reloadAll);
  const { run, loading, error, reset } = useMutation();

  const [stockForm, setStockForm] = useState({ bloodGroup: "", component: "", units: "" });
  const [donorForm, setDonorForm] = useState({ name: "", age: "", gender: "", bloodGroup: "", phone: "", aadhaarNumber: "" });
  const [aadhaarTouched, setAadhaarTouched] = useState(false);
  const aadhaarError = validateAadhaar(donorForm.aadhaarNumber);
  const [issueForm, setIssueForm] = useState({ patientId: "", bloodGroup: "", component: "", units: "1", doctor: "", amount: "" });

  const closeModal = () => { setModal(""); reset(); };

  async function submitStock() {
    await run(() => api.post("/blood-bank/stock", {
      bloodGroup: stockForm.bloodGroup,
      component: stockForm.component,
      units: Number(stockForm.units),
    }));
    setStockForm({ bloodGroup: "", component: "", units: "" });
    closeModal();
    reloadStock();
  }

  async function submitDonor() {
    await run(() => api.post("/blood-bank/donors", {
      name: donorForm.name,
      age: Number(donorForm.age),
      gender: donorForm.gender,
      bloodGroup: donorForm.bloodGroup,
      phone: donorForm.phone,
      aadhaarNumber: donorForm.aadhaarNumber || undefined,
    }));
    setDonorForm({ name: "", age: "", gender: "", bloodGroup: "", phone: "", aadhaarNumber: "" });
    setAadhaarTouched(false);
    closeModal();
    reloadDonors();
  }

  async function submitIssue() {
    const patient = patients.find(p => String(p.id) === issueForm.patientId);
    await run(() => api.post("/blood-bank/issues", {
      patientId: issueForm.patientId ? Number(issueForm.patientId) : undefined,
      patientName: patient?.name ?? "",
      bloodGroup: issueForm.bloodGroup,
      component: issueForm.component,
      units: Number(issueForm.units),
      doctor: issueForm.doctor,
      amount: issueForm.amount ? Number(issueForm.amount) : 0,
    }));
    setIssueForm({ patientId: "", bloodGroup: "", component: "", units: "1", doctor: "", amount: "" });
    closeModal();
    reloadAll();
  }

  const TABS = [
    { id: "stock",  label: "Stock" },
    { id: "donors", label: "Donors", count: donors.length },
    { id: "issues", label: "Issues", count: issues.length },
  ];

  const totalUnits = stock.reduce((s, r) => s + r.units, 0);

  const visibleDonors = donors.filter(d => {
    const matchF = donorFilter === "All" || d.status === donorFilter;
    const q = donorSearch.toLowerCase();
    return matchF && (!q || d.name.toLowerCase().includes(q) || d.bloodGroup.toLowerCase().includes(q) || d.phone.includes(q));
  });

  const visibleIssues = issues.filter(i => {
    const q = issueSearch.toLowerCase();
    return !q || i.patientName.toLowerCase().includes(q) || i.bloodGroup.toLowerCase().includes(q) || i.component.toLowerCase().includes(q);
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
      {donorActions.dialog}
      {issueActions.dialog}

      <Modal open={modal === "stock"} onClose={closeModal} title="Add Blood Stock"
        footer={modalFooter(submitStock, "Add Stock", !stockForm.bloodGroup || !stockForm.component || !stockForm.units)}>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Blood Group *"><FormSelect placeholder="Select group" value={stockForm.bloodGroup} onChange={v => setStockForm(f => ({ ...f, bloodGroup: v }))} options={BLOOD_GROUPS.map(g => ({ value: g, label: g }))} /></FormRow>
          <FormRow label="Component *"><FormSelect placeholder="Select component" value={stockForm.component} onChange={v => setStockForm(f => ({ ...f, component: v }))} options={COMPONENTS.map(c => ({ value: c, label: c }))} /></FormRow>
          <FormRow label="Units *"><FormInput type="number" placeholder="e.g. 2" value={stockForm.units} onChange={v => setStockForm(f => ({ ...f, units: v }))} /></FormRow>
          {modalError}
        </div>
      </Modal>

      <Modal open={modal === "donor"} onClose={closeModal} title="Register Donor"
        footer={modalFooter(submitDonor, "Register", !donorForm.name || !donorForm.age || !donorForm.gender || !donorForm.bloodGroup || !donorForm.phone || !!aadhaarError)}>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Full Name *"><FormInput placeholder="Donor name" value={donorForm.name} onChange={v => setDonorForm(f => ({ ...f, name: v }))} /></FormRow>
          <FormRow label="Age *" hint="Donors must be 18–65"><FormInput type="number" placeholder="e.g. 30" value={donorForm.age} onChange={v => setDonorForm(f => ({ ...f, age: v }))} /></FormRow>
          <FormRow label="Gender *"><FormSelect placeholder="Select gender" value={donorForm.gender} onChange={v => setDonorForm(f => ({ ...f, gender: v }))} options={[{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }]} /></FormRow>
          <FormRow label="Blood Group *"><FormSelect placeholder="Select group" value={donorForm.bloodGroup} onChange={v => setDonorForm(f => ({ ...f, bloodGroup: v }))} options={BLOOD_GROUPS.map(g => ({ value: g, label: g }))} /></FormRow>
          <FormRow label="Phone *"><FormInput placeholder="+91 ..." value={donorForm.phone} onChange={v => setDonorForm(f => ({ ...f, phone: v }))} /></FormRow>
          <FormRow label="Aadhaar Number" error={aadhaarTouched ? aadhaarError ?? undefined : undefined}>
            <FormInput
              placeholder="XXXX XXXX XXXX"
              value={donorForm.aadhaarNumber}
              onChange={v => setDonorForm(f => ({ ...f, aadhaarNumber: v }))}
              onBlur={() => setAadhaarTouched(true)}
              error={aadhaarTouched && Boolean(aadhaarError)}
            />
          </FormRow>
          {modalError}
        </div>
      </Modal>

      <Modal open={modal === "issue"} onClose={closeModal} title="Issue Blood / Component"
        footer={modalFooter(submitIssue, "Issue", !issueForm.patientId || !issueForm.bloodGroup || !issueForm.component || !issueForm.units)}>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Patient *">
            <SearchSelect
              placeholder="Search patient by name, ID or phone…"
              value={issueForm.patientId}
              onChange={v => setIssueForm(f => ({ ...f, patientId: v }))}
              options={patients.map(p => ({ value: String(p.id), label: p.name, hint: `${p.patientId ?? ""} · ${p.phone}` }))}
            />
          </FormRow>
          <FormRow label="Requesting Doctor"><FormInput placeholder="Doctor name" value={issueForm.doctor} onChange={v => setIssueForm(f => ({ ...f, doctor: v }))} /></FormRow>
          <FormRow label="Blood Group *"><FormSelect placeholder="Select group" value={issueForm.bloodGroup} onChange={v => setIssueForm(f => ({ ...f, bloodGroup: v }))} options={BLOOD_GROUPS.map(g => ({ value: g, label: g }))} /></FormRow>
          <FormRow label="Component *"><FormSelect placeholder="Select component" value={issueForm.component} onChange={v => setIssueForm(f => ({ ...f, component: v }))} options={COMPONENTS.map(c => ({ value: c, label: c }))} /></FormRow>
          <FormRow label="Units *"><FormInput type="number" placeholder="1" value={issueForm.units} onChange={v => setIssueForm(f => ({ ...f, units: v }))} /></FormRow>
          <FormRow label="Charge (₹)" hint="A pending Blood bill is raised when set"><FormInput type="number" placeholder="0" value={issueForm.amount} onChange={v => setIssueForm(f => ({ ...f, amount: v }))} /></FormRow>
          {modalError}
        </div>
      </Modal>

      <PageHeader
        title="Blood Bank"
        subtitle="Track donors, group-wise stock, and blood or component issues."
        stats={[{ icon: Droplets, value: `${totalUnits}`, label: "Units in Stock" }]}
        action={canWrite ? { label: "Issue Blood", icon: Plus, onClick: () => setModal("issue") } : undefined}
      />
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 655 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />

          {tab === "stock" && <StockView stock={stock} onAdd={() => setModal("stock")} canWrite={canWrite} />}

          {tab === "donors" && (
            <>
              <FilterBar
                filters={[{ id: "All", label: "All" }, { id: "Eligible", label: "Eligible" }, { id: "Deferred", label: "Deferred" }]}
                searchPlaceholder="Search by donor name, group, or phone..."
                activeFilter={donorFilter} onFilterChange={setDonorFilter}
                searchQuery={donorSearch} onSearchChange={setDonorSearch}
                action={canWrite ? { label: "Register Donor", onClick: () => setModal("donor") } : undefined}
              />
              <DataTable columns={DONOR_COLUMNS} minWidth={1100}>
                {visibleDonors.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[#57575f]">No donors found.</div>
                ) : visibleDonors.map(d => (
                  <DonorRow key={d.id} row={d} actions={[
                    ...(canWrite ? [
                      { label: "Record donation", disabled: d.status !== "Eligible", onClick: () => donorActions.mutate(() => api.post(`/blood-bank/donors/${d.id}/donate`, {})) },
                      { label: d.status === "Eligible" ? "Mark Deferred" : "Mark Eligible", onClick: () => donorActions.mutate(() => api.patch(`/blood-bank/donors/${d.id}`, { status: d.status === "Eligible" ? "Deferred" : "Eligible" })) },
                    ] : []),
                    { label: "ID proof / Aadhaar", onClick: () => setDocsFor(d) },
                    ...(canWrite ? [{ label: "Delete", danger: true, onClick: () => donorActions.remove(d.id, d.name) }] : []),
                  ]} />
                ))}
              </DataTable>
            </>
          )}

          {tab === "issues" && (
            <>
              <FilterBar
                filters={[{ id: "All", label: "All" }]}
                searchPlaceholder="Search by patient, group, or component..."
                activeFilter="All" onFilterChange={() => {}}
                searchQuery={issueSearch} onSearchChange={setIssueSearch}
                action={canWrite ? { label: "Issue Blood", onClick: () => setModal("issue") } : undefined}
              />
              <DataTable columns={ISSUE_COLUMNS} minWidth={1100}>
                {visibleIssues.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[#57575f]">No issues recorded.</div>
                ) : visibleIssues.map(i => (
                  <IssueRow key={i.id} row={i} actions={canWrite ? [
                    { label: "Cancel & restock", disabled: i.status === "Cancelled", onClick: () => issueActions.ask({ message: `Cancel this issue and return ${i.units} unit(s) of ${i.bloodGroup} ${i.component} to stock?`, confirmLabel: "Cancel Issue", danger: true, action: () => api.patch(`/blood-bank/issues/${i.id}`, { status: "Cancelled" }) }) },
                    { label: "Delete", danger: true, onClick: () => issueActions.remove(i.id, `issue for ${i.patientName}`) },
                  ] : []} />
                ))}
              </DataTable>
            </>
          )}
        </div>
      </div>
      {docsFor && (
        <Modal
          open
          onClose={() => setDocsFor(null)}
          title={`ID Proof — ${docsFor.name}`}
          width={600}
          footer={
            <button onClick={() => setDocsFor(null)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">
              Close
            </button>
          }
        >
          <DocumentsPanel
            ownerType="donor"
            ownerId={docsFor.id}
            categories={["Aadhaar", "PAN", "Driving Licence", "Consent Form", "Other"]}
          />
        </Modal>
      )}
    </>
  );
}
