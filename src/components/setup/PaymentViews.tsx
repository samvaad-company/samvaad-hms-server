"use client";

/** Payments & banks: payment modes, bank accounts, card (EDC) terminals and their settlements. Also payout rules and referral sources. */
import { useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { ACCOUNT_TYPES, PAYOUT_ROLES, REFERRAL_TYPES, SERVICE_SCOPES, inr } from "@/types/setup";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Pill } from "@/components/mrd/shared";
import { attempt } from "@/components/hr/shared";
import { AddButton, EditIcon, FormDialog, Inactive, ListBox, ListHeader, Muted, Row, Toggle, dateRange, num, str, useSetup, type Rec } from "@/components/setup/ui";

const opt = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));
const money = (n: unknown) => inr(num(n));
const section = "mb-6";

export function PaymentsView() {
  const modes = useSetup("payment_mode");
  const banks = useSetup("bank_account");
  const terminals = useSetup("edc_terminal");
  const settlements = useSetup("edc_settlement");
  const { run } = useMutation();
  const [dialog, setDialog] = useState<null | { type: "bank" | "terminal" | "settlement" | "mode"; rec?: Rec }>(null);
  const bankName = (id: unknown) => banks.items.find((b) => b.id === Number(id))?.name ?? "";
  const bankOptions = [{ value: "", label: "None" }, ...banks.items.map((b) => ({ value: String(b.id), label: `${b.name} ··${str(b.data.accountLast4)}` }))];
  const lastSettlements = [...settlements.items].sort((a, b) => str(b.data.date).localeCompare(str(a.data.date))).slice(0, 20);

  return (
    <div>
      <section className={section}>
        <ListHeader title="Payment modes" count={modes.items.length}><AddButton label="Add mode" onClick={() => setDialog({ type: "mode" })} /></ListHeader>
        <div className="grid gap-x-3 gap-y-2" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {modes.items.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-[8px] border border-[color:var(--line)] px-3 py-[7px]">
              <span className="w-[110px] shrink-0 truncate font-mono text-[11px] text-[color:var(--ink-soft)]">{m.code}</span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{m.name}</span>
              <Muted>{str(m.data.group)}</Muted>
              <Toggle checked={m.active} label={`${m.name} active`} onChange={(v) => attempt(run(() => api.patch(`/setup/payment_mode/${m.id}`, { active: v }))).then(() => modes.reload())} />
              <EditIcon label={`Edit ${m.name}`} onClick={() => setDialog({ type: "mode", rec: m })} />
            </div>
          ))}
        </div>
      </section>

      <section className={section}>
        <ListHeader title="Bank accounts" count={banks.items.length}><AddButton label="Add account" onClick={() => setDialog({ type: "bank" })} /></ListHeader>
        <ListBox>
          {banks.items.map((b) => (
            <Row key={b.id}>
              <span className="flex w-[14px] justify-center">{b.data.isDefault === true && <Star size={13} className="fill-current" aria-label="Default account" />}</span>
              <span className="text-[14px] font-medium">{b.name}</span><Muted>{str(b.data.label)}</Muted>
              {!b.active && <Inactive />}
              <span className="ml-auto font-mono text-[12px] text-[color:var(--ink-soft)]">{str(b.data.ifsc)}</span>
              <span className="font-mono text-[12px] text-[color:var(--ink-soft)]">··{str(b.data.accountLast4)}</span>
              <Pill tone="plain">{str(b.data.accountType)}</Pill>
              <EditIcon label={`Edit ${b.name}`} onClick={() => setDialog({ type: "bank", rec: b })} />
            </Row>
          ))}
          {banks.items.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-[color:var(--ink-soft)]">No bank accounts yet.</p>}
        </ListBox>
      </section>

      <section className={section}>
        <ListHeader title="EDC terminals" count={terminals.items.length}><AddButton label="Add terminal" onClick={() => setDialog({ type: "terminal" })} /></ListHeader>
        <ListBox>
          {terminals.items.map((t) => (
            <Row key={t.id}>
              <span className="text-[14px] font-medium">{t.name}</span>{!t.active && <Inactive />}
              <Muted>settles to {bankName(t.data.bankAccountId) || "no account"}</Muted>
              <span className="ml-auto font-mono text-[12px] text-[color:var(--ink-soft)]">TID {str(t.data.terminalId)}</span><Muted>{str(t.data.model)}</Muted>
              <EditIcon label={`Edit ${t.name}`} onClick={() => setDialog({ type: "terminal", rec: t })} />
            </Row>
          ))}
          {terminals.items.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-[color:var(--ink-soft)]">No card terminals yet.</p>}
        </ListBox>
      </section>

      <section>
        <ListHeader title="EDC settlements (last 20)" count={lastSettlements.length}><AddButton label="Record settlement" onClick={() => setDialog({ type: "settlement" })} /></ListHeader>
        {lastSettlements.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-[color:var(--line)] py-8 text-center text-[14px] text-[color:var(--ink-soft)]">No settlements recorded yet.</p>
        ) : (
          <ListBox>{lastSettlements.map((s) => (
            <Row key={s.id}><span className="font-mono text-[12px]">{str(s.data.date)}</span><span className="text-[14px] font-medium">{terminals.items.find((t) => t.id === Number(s.data.terminalId))?.name ?? "Terminal"}</span><Muted>{str(s.data.batchNo) && `Batch ${str(s.data.batchNo)}`}</Muted><span className="ml-auto font-mono text-[13px]">{money(s.data.amount)}</span><EditIcon label="Edit settlement" onClick={() => setDialog({ type: "settlement", rec: s })} /></Row>
          ))}</ListBox>
        )}
      </section>

      {dialog?.type === "mode" && (
        <FormDialog key={dialog.rec?.id ?? "new"} title={dialog.rec ? "Edit payment mode" : "Add payment mode"} subtitle="How a patient can pay at the counter." endpoint="/setup/payment_mode" id={dialog.rec?.id} submitLabel={dialog.rec ? "Save changes" : "Add mode"} deleteLabel="Delete mode"
          initial={dialog.rec ? { code: dialog.rec.code, name: dialog.rec.name, group: dialog.rec.data.group, active: dialog.rec.active } : { group: "Cash", active: true }}
          rows={[[{ key: "code", label: "Code", mono: true, upper: true, placeholder: "CASH" }, { key: "name", label: "Name" }], [{ key: "group", label: "Group", type: "select", options: opt(["Cash", "Cheque", "Dd", "Ecs", "Card", "Upi", "Wallet", "Netbanking"]) }], [{ key: "active", label: "Active", type: "toggle" }]]}
          onClose={() => { setDialog(null); modes.reload(); }} />
      )}
      {dialog?.type === "bank" && (
        <FormDialog key={dialog.rec?.id ?? "new"} title={dialog.rec ? "Edit bank account" : "Add bank account"} subtitle="Settlement accounts for card machines and bank receipts. Only the last 4 digits are kept." endpoint="/setup/bank_account" id={dialog.rec?.id} submitLabel={dialog.rec ? "Save changes" : "Add account"} deleteLabel="Delete account"
          initial={dialog.rec ? { name: dialog.rec.name, label: dialog.rec.data.label, ifsc: dialog.rec.data.ifsc, accountLast4: dialog.rec.data.accountLast4, accountType: dialog.rec.data.accountType, isDefault: dialog.rec.data.isDefault === true, active: dialog.rec.active } : { accountType: "Current", active: true }}
          rows={[[{ key: "name", label: "Bank name" }, { key: "label", label: "Branch / label", placeholder: "Vadodara Main" }], [{ key: "ifsc", label: "IFSC", mono: true, upper: true, placeholder: "HDFC0001234" }, { key: "accountLast4", label: "Last 4 digits", placeholder: "5678", mono: true }], [{ key: "accountType", label: "Account type", type: "select", options: opt(ACCOUNT_TYPES) }], [{ key: "isDefault", label: "Default account", type: "toggle" }], [{ key: "active", label: "Active", type: "toggle" }]]}
          onClose={() => { setDialog(null); banks.reload(); }} />
      )}
      {dialog?.type === "terminal" && (
        <FormDialog key={dialog.rec?.id ?? "new"} width={500} title={dialog.rec ? "Edit EDC terminal" : "Add EDC terminal"} subtitle="Card machines map to a settlement bank account; daily batches reconcile against them." endpoint="/setup/edc_terminal" id={dialog.rec?.id} submitLabel={dialog.rec ? "Save terminal" : "Add terminal"} deleteLabel="Delete terminal"
          initial={dialog.rec ? { name: dialog.rec.name, terminalId: dialog.rec.data.terminalId, merchantId: dialog.rec.data.merchantId, model: dialog.rec.data.model, bankAccountId: str(dialog.rec.data.bankAccountId), active: dialog.rec.active } : { active: true }}
          rows={[[{ key: "name", label: "Label", placeholder: "Front Office EDC 1" }], [{ key: "terminalId", label: "Terminal ID", mono: true, placeholder: "TID00067890" }, { key: "merchantId", label: "Merchant ID", mono: true, placeholder: "MID987654322" }], [{ key: "model", label: "Model", placeholder: "Ezetap Android" }, { key: "bankAccountId", label: "Settles to", type: "select", options: bankOptions }], [{ key: "active", label: "Active", type: "toggle" }]]}
          onClose={() => { setDialog(null); terminals.reload(); }} />
      )}
      {dialog?.type === "settlement" && (
        <FormDialog key={dialog.rec?.id ?? "new"} title={dialog.rec ? "Edit settlement" : "Record settlement"} subtitle="A card batch the bank has paid out." endpoint="/setup/edc_settlement" id={dialog.rec?.id} submitLabel={dialog.rec ? "Save changes" : "Record settlement"} deleteLabel="Delete settlement"
          initial={dialog.rec ? { terminalId: str(dialog.rec.data.terminalId), date: dialog.rec.data.date, amount: dialog.rec.data.amount, batchNo: dialog.rec.data.batchNo, reference: dialog.rec.data.reference } : { date: new Date().toLocaleDateString("en-CA") }}
          rows={[[{ key: "terminalId", label: "Terminal", type: "select", options: [{ value: "", label: "Pick a terminal" }, ...terminals.items.map((t) => ({ value: String(t.id), label: t.name }))] }], [{ key: "date", label: "Settlement date", type: "date" }, { key: "amount", label: "Amount (₹)", type: "number", min: "0.01" }], [{ key: "batchNo", label: "Batch no." }, { key: "reference", label: "Bank reference" }]]}
          disabled={(v) => !v.terminalId || !v.date || !v.amount}
          prepare={(v) => ({ ...v, name: `${str(v.date)} settlement` })} onClose={() => { setDialog(null); settlements.reload(); }} />
      )}
    </div>
  );
}

// ── Payout rules ─────────────────────────────────────────────────────────────

export function PayoutRulesView() {
  const rules = useSetup("payout_rule");
  const services = useSetup("service");
  const [editing, setEditing] = useState<Rec | "new" | null>(null);
  const serviceName = (id: unknown) => services.items.find((s) => s.id === Number(id))?.name ?? "";
  return (
    <div>
      <ListHeader title="Payout rules" note="Doctor & outhouse revenue shares - the most specific rule wins; shares accrue on finalize."><AddButton primary label="New rule" onClick={() => setEditing("new")} /></ListHeader>
      <ListBox>
        {rules.items.map((r) => (
          <Row key={r.id}>
            <span className="min-w-0 truncate text-[14px] font-medium">{r.name}</span>{!r.active && <Inactive />}
            <span className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <Pill tone="plain">{str(r.data.role)}</Pill>
              {r.data.scope === "IPD" && <Pill tone="plain">IPD</Pill>}
              {r.data.scope === "A single service" && <Muted>{serviceName(r.data.serviceId)}</Muted>}
              <span className="rounded-[6px] bg-[color:var(--subtle)] px-2 py-[1px] font-mono text-[12px]">{r.data.valueKind === "fixed" ? money(r.data.value) : `${num(r.data.value).toFixed(2)}%`}</span>
              <span className="w-[110px] text-right font-mono text-[12px] text-[color:var(--ink-soft)]">{dateRange(r.data.effectiveFrom, r.data.effectiveTo)}</span>
            </span>
            <EditIcon label={`Edit ${r.name}`} onClick={() => setEditing(r)} />
          </Row>
        ))}
        {rules.items.length === 0 && <p className="px-4 py-10 text-center text-[14px] text-[color:var(--ink-soft)]">No payout rules yet.</p>}
      </ListBox>
      {editing && (
        <FormDialog key={editing === "new" ? "new" : editing.id} width={500} title={editing === "new" ? "New payout rule" : "Edit payout rule"} subtitle="A share of revenue paid to a doctor, outhouse or referrer. The most specific rule that matches wins."
          endpoint="/setup/payout_rule" id={editing === "new" ? undefined : editing.id} submitLabel={editing === "new" ? "Add rule" : "Save changes"} deleteLabel="Delete rule"
          initial={editing === "new" ? { role: "Consulting", scope: "All services", valueKind: "percent", effectiveFrom: new Date().toLocaleDateString("en-CA"), active: true } : { name: editing.name, role: editing.data.role, scope: editing.data.scope, serviceId: str(editing.data.serviceId), valueKind: editing.data.valueKind, value: editing.data.value, effectiveFrom: editing.data.effectiveFrom, effectiveTo: editing.data.effectiveTo, active: editing.active }}
          rows={[[{ key: "name", label: "Payee", placeholder: "Dr. name, outhouse or referrer" }], [{ key: "role", label: "Role", type: "select", options: opt(PAYOUT_ROLES) }, { key: "scope", label: "Applies to", type: "select", options: opt(SERVICE_SCOPES) }],
            [{ key: "serviceId", label: "Service", type: "select", options: [{ value: "", label: "Pick a service" }, ...services.items.map((s) => ({ value: String(s.id), label: s.name }))], showIf: (v) => v.scope === "A single service" }],
            [{ key: "valueKind", label: "Share is", type: "select", options: [{ value: "percent", label: "A percentage" }, { value: "fixed", label: "A fixed amount (₹)" }] }, { key: "value", label: "Value", type: "number" }],
            [{ key: "effectiveFrom", label: "Effective from", type: "date" }, { key: "effectiveTo", label: "Effective to (optional)", type: "date" }], [{ key: "active", label: "Active", type: "toggle" }]]}
          onClose={() => { setEditing(null); rules.reload(); }} />
      )}
    </div>
  );
}

// ── Referral sources ─────────────────────────────────────────────────────────

export function ReferralsView() {
  const sources = useSetup("referral_source");
  const specialties = useSetup("specialty");
  const [editing, setEditing] = useState<Rec | "new" | null>(null);
  const [removing, setRemoving] = useState<Rec | null>(null);
  const { run, loading, error } = useMutation();
  async function remove() {
    if (!removing) return;
    await attempt(run(() => api.del(`/setup/referral_source/${removing.id}`)));
    setRemoving(null); sources.reload();
  }
  return (
    <div>
      <ListHeader title="Referral sources" note="Referring doctors, channels, camps and tie-ups; referring doctors carry the payout rule."><AddButton primary label="New source" onClick={() => setEditing("new")} /></ListHeader>
      <ListBox>
        {sources.items.map((r) => (
          <Row key={r.id} onClick={() => setEditing(r)}>
            <span className="min-w-0 truncate text-[14px] font-medium">{r.name}</span>{!r.active && <Inactive />}
            <span className="ml-auto flex items-center gap-2"><Pill tone="plain">{str(r.data.type)}</Pill>{str(r.data.specialty) && <Muted>{str(r.data.specialty)}</Muted>}{r.data.payoutValue != null && <span className="rounded-[6px] bg-[color:var(--subtle)] px-2 py-[1px] font-mono text-[12px]">{money(r.data.payoutValue)}</span>}</span>
            <button aria-label={`Delete ${r.name}`} onClick={(e) => { e.stopPropagation(); setRemoving(r); }} className="rounded-[6px] p-[6px] text-[color:var(--ink-soft)] hover:bg-[#ffe9e9] hover:text-[#c8001a] cursor-pointer"><Trash2 size={14} /></button>
          </Row>
        ))}
      </ListBox>
      {editing && (
        <FormDialog key={editing === "new" ? "new" : editing.id} title={editing === "new" ? "New referral source" : "Edit referral source"} subtitle="Who sends patients here — a doctor, an organisation, a camp or a channel." endpoint="/setup/referral_source" id={editing === "new" ? undefined : editing.id} submitLabel={editing === "new" ? "Add source" : "Save changes"}
          initial={editing === "new" ? { type: "Referring doctor", active: true } : { name: editing.name, type: editing.data.type, specialty: editing.data.specialty, payoutValue: editing.data.payoutValue, active: editing.active }}
          rows={[[{ key: "name", label: "Name" }], [{ key: "type", label: "Type", type: "select", options: opt(REFERRAL_TYPES) }],
            [{ key: "specialty", label: "Specialty", type: "select", options: [{ value: "", label: "None" }, ...specialties.items.map((s) => ({ value: s.name, label: s.name }))], showIf: (v) => v.type === "Referring doctor" }],
            [{ key: "payoutValue", label: "Payout per referral (₹)", type: "number", hint: "Optional. Referring doctors carry the payout rule." }], [{ key: "active", label: "Active", type: "toggle" }]]}
          onClose={() => { setEditing(null); sources.reload(); }} />
      )}
      <ConfirmDialog open={removing !== null} title={`Delete ${removing?.name ?? ""}?`} message={error?.message ?? "Patients already registered with this source keep it."} confirmLabel="Delete" danger loading={loading} onConfirm={remove} onCancel={() => setRemoving(null)} />
    </div>
  );
}
