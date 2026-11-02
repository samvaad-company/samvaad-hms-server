"use client";

/** Setup → Hospital setup: identity and statutory details, financial year, registrations and licences, branch configuration, charges & posting, clinical policies. */
import { useState } from "react";
import { Building2 } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { Pill } from "@/components/mrd/shared";
import { ConfigCard } from "@/components/setup/ConfigCard";
import { EditIcon, FormDialog, str, useConfig, useSetup, type FieldSpec, type Rec } from "@/components/setup/ui";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => ({ value: String(i + 1), label: m }));
const sel = (values: string[]) => values.map((v) => ({ value: v, label: v }));

const IDENTITY: FieldSpec[][] = [
  [{ key: "name", label: "Hospital name", w: 2 }, { key: "shortName", label: "Short name" }, { key: "vertical", label: "Vertical", type: "select", options: sel(["Multispecialty", "Single specialty", "Clinic", "Diagnostics", "Day care"]) }],
  [{ key: "bedCount", label: "Bed count", type: "number" }, { key: "phone", label: "Phone" }, { key: "email", label: "Email", w: 2 }],
  [{ key: "address", label: "Address" }],
  [{ key: "pincode", label: "PIN code", mono: true }, { key: "gstin", label: "GSTIN", mono: true, upper: true }, { key: "gstRegistration", label: "GST registration", type: "select", options: sel(["Regular", "Composition", "Unregistered"]) }, { key: "gstRounding", label: "GST rounding", type: "select", options: sel(["Round half up (default)", "Round down", "Round up"]) }],
  [{ key: "unknownPatientState", label: "Unknown patient state", type: "select", options: sel(["Treat as intra-state (CGST+SGST)", "Treat as inter-state (IGST)"]) }, { key: "pan", label: "PAN", upper: true }, { key: "cin", label: "CIN", upper: true }, { key: "rohini", label: "ROHINI code" }],
  [{ key: "pcpndt", label: "PC-PNDT registration no." }, { key: "invoicePrefix", label: "Invoice prefix", mono: true, upper: true }, { key: "upiVpa", label: "UPI VPA", mono: true, w: 2 }],
  [{ key: "invoiceFooter", label: "Invoice footer note" }],
  [{ key: "supportName", label: "Support contact name" }, { key: "supportEmail", label: "Support email" }, { key: "supportPhone", label: "Support phone" }],
];
const IDENTITY_CHIPS: FieldSpec[] = [
  { key: "gstOnBills", label: "GST enabled on bills", type: "toggle" }, { key: "pricesInclusive", label: "Prices are GST-inclusive", type: "toggle" },
  { key: "roundOff", label: "Round off bill totals", type: "toggle" }, { key: "multiCenter", label: "Multi-center organization", type: "toggle" },
];
const FY: FieldSpec[][] = [[{ key: "fyStartMonth", label: "FY start month", type: "select", options: MONTHS }, { key: "fyStartDay", label: "FY start day", type: "select", options: [{ value: "1", label: "1st of the month" }] }]];
const REGS: FieldSpec[][] = [
  [{ key: "clinicRegNo", label: "Clinical establishment registration no." }],
  [{ key: "clinicAuthority", label: "Issuing authority", placeholder: "e.g. District Registering Authority, Pune" }, { key: "clinicValidUntil", label: "Valid until", type: "date" }],
  [{ key: "bloodLicenceNo", label: "Blood centre licence no." }, { key: "bloodValidUntil", label: "Valid until", type: "date" }],
];
const CHARGES: FieldSpec[][] = [
  [{ key: "autoPostBedCharges", label: "Post bed charges automatically every day", type: "toggle" }],
  [{ key: "autoPostConsultFee", label: "Post the consultation fee when a visit starts", type: "toggle" }],
  [{ key: "autoPostRegistrationFee", label: "Post the registration fee for new patients", type: "toggle" }],
  [{ key: "postingTime", label: "Daily posting time", type: "time" }, { key: "backdatingDays", label: "Back-dating allowed (days)", type: "number" }],
  [{ key: "allowBackdating", label: "Allow billing staff to back-date charges", type: "toggle" }],
];
const POLICIES: FieldSpec[][] = [
  [{ key: "mlcRequired", label: "Require an MLC number for medico-legal cases", type: "toggle" }],
  [{ key: "consentBeforeProcedure", label: "Require a signed consent before a procedure", type: "toggle" }],
  [{ key: "doubleCheckHighRisk", label: "Double-check high-risk medicines", type: "toggle" }],
  [{ key: "dischargeSummaryRequired", label: "Require a discharge summary before discharge", type: "toggle" }],
  [{ key: "allergyCheckOnPrescribe", label: "Check allergies when a prescription is written", type: "toggle" }],
  [{ key: "retentionYears", label: "Keep clinical records for (years)", type: "number" }],
];

const TABS = [{ id: "identity", label: "Identity & branches" }, { id: "charges", label: "Charges & posting" }, { id: "policies", label: "Clinical policies" }] as const;

export default function HospitalSetupPage() {
  const { can, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("identity");
  const { item: cfg, reload } = useConfig("hospital");
  const branches = useSetup("branch");
  const plans = useSetup("rate_plan");
  const [editingBranch, setEditingBranch] = useState<Rec | null>(null);
  const canEdit = can("admin", "write");
  if (authLoading) return null;
  if (!can("admin", "read")) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">Hospital setup is managed by hospital administrators.</p></div>;

  return (
    <div className={`${tw.gutterX} pt-[16px] mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 480 }}>
        <div className="flex items-baseline gap-3 border-b border-[color:var(--line)] px-5 py-3">
          <Building2 size={16} className="self-center text-[color:var(--ink-soft)]" />
          <h1 className="text-[15px] font-semibold text-[color:var(--ink)]">Hospital Setup</h1>
          <span className="text-[13px] text-[color:var(--ink-soft)]">Identity, charges, financial year &amp; auto-posting</span>
          <span className="ml-auto hidden text-[12px] text-[color:var(--ink-soft)] md:inline">Name, GST, financial year, branches</span>
        </div>
        <div className="px-5 pt-4">
          <div role="tablist" aria-label="Hospital setup" className="inline-flex rounded-[10px] bg-[color:var(--subtle)] p-[3px]">
            {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`h-[30px] rounded-[8px] px-3 text-[14px] cursor-pointer ${tab === t.id ? "bg-[color:var(--surface)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>{t.label}</button>)}
          </div>
        </div>
        {!cfg ? <p className="px-5 py-10 text-[14px] text-[color:var(--ink-soft)]">Loading…</p> : (
          <div className="grid items-start gap-4 p-5" style={{ gridTemplateColumns: tab === "identity" ? "minmax(0, 1.7fr) minmax(0, 1fr)" : "minmax(0, 1fr)" }}>
            {tab === "identity" && (
              <>
                <ConfigCard title="Identity, statutory & billing" configKey="hospital" rows={IDENTITY} chips={IDENTITY_CHIPS} values={cfg} canEdit={canEdit} onSaved={reload} />
                <div className="flex flex-col gap-4">
                  <ConfigCard title="Financial year" configKey="hospital" rows={FY} values={{ ...cfg, fyStartMonth: String(cfg.fyStartMonth), fyStartDay: "1" }} canEdit={canEdit} onSaved={reload} />
                  <ConfigCard title="Registrations & licences" configKey="hospital" rows={REGS} values={cfg} canEdit={canEdit} onSaved={reload} note="Clinical Establishments Act or your state's act prints on the letterhead. The blood centre licence heads every blood bank register." />
                  <section className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
                    <h2 className="mb-3 text-[13px] text-[color:var(--ink-soft)]">Branch configuration</h2>
                    {branches.items.map((b) => (
                      <div key={b.id} className="flex items-center gap-2 py-1 text-[14px]">
                        <span className="font-mono text-[11px] text-[color:var(--ink-soft)]">{b.code}</span><span className="font-medium">{b.name}</span>{b.data.isPrimary === true && <Pill tone="green">Main</Pill>}
                        {canEdit && <span className="ml-auto"><EditIcon label={`Configure ${b.name}`} onClick={() => setEditingBranch(b)} /></span>}
                      </div>
                    ))}
                  </section>
                </div>
              </>
            )}
            {tab === "charges" && <ConfigCard title="Charges & auto-posting" configKey="hospital" rows={CHARGES} values={cfg} canEdit={canEdit} onSaved={reload} note="How charges reach the bill without anyone typing them." />}
            {tab === "policies" && <ConfigCard title="Clinical policies" configKey="hospital" rows={POLICIES} values={cfg} canEdit={canEdit} onSaved={reload} note="Hospital-wide rules for care and records." />}
          </div>
        )}
      </div>
      {editingBranch && (
        <FormDialog key={editingBranch.id} title="Branch configuration" subtitle="Billing identity and defaults for this branch. The branch itself (name, hours, staff) is managed under Branches." width={500}
          endpoint="/setup/branch" id={editingBranch.id} submitLabel="Save branch config"
          initial={{ name: editingBranch.name, code: editingBranch.code, address: editingBranch.data.address, phone: editingBranch.data.phone, gstin: editingBranch.data.gstin, defaultRatePlanId: str(editingBranch.data.defaultRatePlanId), isPrimary: editingBranch.data.isPrimary === true }}
          rows={[[{ key: "name", label: "Branch name", w: 2 }, { key: "code", label: "Code", mono: true, upper: true }], [{ key: "address", label: "Address", type: "textarea", rows: 2 }], [{ key: "phone", label: "Phone" }, { key: "gstin", label: "GSTIN", mono: true, upper: true }],
            [{ key: "defaultRatePlanId", label: "Default rate plan", type: "select", options: [{ value: "", label: "None (org default)" }, ...plans.items.map((p) => ({ value: String(p.id), label: p.name }))] }], [{ key: "isPrimary", label: "Main branch", type: "toggle" }]]}
          onClose={() => { setEditingBranch(null); branches.reload(); }} />
      )}
    </div>
  );
}
