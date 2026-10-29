"use client";

/** Sponsors & contracts: insurers, TPAs, corporates and schemes; their contracts; copay / exclusion / limit / DRG rules; and dual-sponsor coordination. */
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { COPAY_ENDS, SPONSOR_TYPES, inr } from "@/types/setup";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorNote, Pill } from "@/components/mrd/shared";
import { attempt } from "@/components/hr/shared";
import { AddButton, Code, EditIcon, FormDialog, Inactive, ListBox, ListHeader, Muted, num, str, useSetup, type Rec } from "@/components/setup/ui";

const opt = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));
const money = (n: unknown) => inr(num(n));
const card = "rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] p-4";

type RuleKind = "copay" | "exclusion" | "limit" | "drg";
const RULE_TABS: { id: RuleKind; label: string; bucket: string; title: string }[] = [
  { id: "copay", label: "Copay & deductible", bucket: "copay", title: "Copay matrix" },
  { id: "exclusion", label: "Exclusions", bucket: "exclusions", title: "Exclusions" },
  { id: "limit", label: "Limit rules", bucket: "limits", title: "Limit rules" },
  { id: "drg", label: "DRG & per diem", bucket: "drg", title: "DRG & per diem" },
];

export function SponsorsView() {
  const sponsors = useSetup("sponsor");
  const contracts = useSetup("contract");
  const dual = useSetup("dual_sponsor_rule");
  const groups = useSetup("service_group");
  const plans = useSetup("rate_plan");
  const [sponsorId, setSponsorId] = useState<number | null>(null);
  const [contractId, setContractId] = useState<number | null>(null);
  const [tab, setTab] = useState<RuleKind>("copay");
  const [dialog, setDialog] = useState<null | { type: "sponsor" | "contract" | "rule" | "dual"; rec?: Rec }>(null);
  const [removing, setRemoving] = useState<null | { label: string; run: () => Promise<unknown> }>(null);
  const { run, loading, error, reset } = useMutation();

  const sponsor = sponsors.items.find((s) => s.id === (sponsorId ?? sponsors.items[0]?.id));
  const mine = contracts.items.filter((c) => Number(c.data.sponsorId) === sponsor?.id);
  const contract = mine.find((c) => c.id === contractId) ?? mine[0];
  const activeTab = RULE_TABS.find((t) => t.id === tab)!;
  const rules = ((contract?.data[activeTab.bucket] as Record<string, unknown>[] | undefined) ?? []);
  const contractName = (id: unknown) => contracts.items.find((c) => c.id === Number(id))?.name ?? "(deleted contract)";

  async function confirmRemove() {
    if (!removing) return;
    reset();
    await attempt(run(removing.run));
    setRemoving(null);
    contracts.reload(); dual.reload();
  }

  const ruleText = (r: Record<string, unknown>): string[] => {
    if (tab === "copay") return [r.copayPercent != null && `copay ${num(r.copayPercent).toFixed(2)}%`, r.deductible != null && `deductible ${money(r.deductible)}`, r.copayMin != null && `min ${money(r.copayMin)}`, r.copayMax != null && `max ${money(r.copayMax)}`, r.annualLimit != null && `annual ${money(r.annualLimit)}`, r.encounterLimit != null && `encounter ${money(r.encounterLimit)}`, r.episodicLimit != null && `episodic ${money(r.episodicLimit)}`].filter(Boolean) as string[];
    if (tab === "exclusion") return [str(r.reason)].filter(Boolean);
    if (tab === "limit") return [r.limitAmount != null && `up to ${money(r.limitAmount)}`, r.limitCount != null && `${num(r.limitCount)} times`, str(r.per) && `per ${str(r.per)}`].filter(Boolean) as string[];
    return [str(r.code), r.packageAmount != null && `package ${money(r.packageAmount)}`, r.perDiemAmount != null && `per diem ${money(r.perDiemAmount)}`, r.maxDays != null && `max ${num(r.maxDays)} days`].filter(Boolean) as string[];
  };
  const ruleTitle = (r: Record<string, unknown>) => (tab === "copay" ? str(r.appliesTo) : tab === "drg" ? str(r.diagnosis) : str(r.target));

  return (
    <div>
      <ListHeader title="Sponsors & contracts" count={sponsors.items.length}><AddButton primary label="Add sponsor" onClick={() => setDialog({ type: "sponsor" })} /></ListHeader>
      <div className="flex items-start gap-4">
        <nav aria-label="Sponsors" className="w-[260px] shrink-0 text-[13px]">
          {sponsors.items.map((s) => (
            <div key={s.id} className={`group flex items-center rounded-[8px] ${sponsor?.id === s.id ? "bg-[color:var(--subtle)] font-medium" : "hover:bg-[color:var(--faint)]"}`}>
              <button onClick={() => { setSponsorId(s.id); setContractId(null); }} className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-[7px] text-left cursor-pointer"><span className="truncate" title={s.name}>{s.name}</span><Muted>{str(s.data.type)}</Muted></button>
              {sponsor?.id === s.id && <EditIcon label={`Edit ${s.name}`} onClick={() => setDialog({ type: "sponsor", rec: s })} />}
            </div>
          ))}
        </nav>
        {sponsor && (
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <section className={card}>
              <div className="mb-3 flex items-center gap-3"><p className="text-[13px] text-[color:var(--ink-soft)]">Contracts - {sponsor.name} <span className="ml-1 font-medium text-[color:var(--ink)]">{mine.length}</span></p><span className="ml-auto"><AddButton label="Add contract" onClick={() => setDialog({ type: "contract" })} /></span></div>
              <ListBox>
                {mine.map((c) => (
                  <div key={c.id} onClick={() => setContractId(c.id)} className={`flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 border-b border-[color:var(--line)] px-4 py-[10px] last:border-b-0 ${contract?.id === c.id ? "bg-[color:var(--faint)]" : "hover:bg-[color:var(--faint)]"}`}>
                    <span className="text-[14px] font-medium text-[color:var(--ink)]">{c.name}</span><Code>{c.code}</Code><Pill tone="plain">{str(c.data.kind)}</Pill>
                    <span className="font-mono text-[12px] text-[color:var(--ink-soft)]">{str(c.data.validFrom)} → {str(c.data.validTo) || "open"}</span>
                    {c.data.discountPercent != null && num(c.data.discountPercent) !== 0 && <span className="font-mono text-[12px]">{num(c.data.discountPercent).toFixed(2)}%</span>}
                    <span className="font-mono text-[12px] text-[color:var(--ink-soft)]">{num(c.data.creditDays)}d credit</span>
                    {!c.active && <Inactive />}
                    <span className="ml-auto flex items-center" onClick={(e) => e.stopPropagation()}>
                      <EditIcon label={`Edit ${c.name}`} onClick={() => setDialog({ type: "contract", rec: c })} />
                      <button aria-label={`Delete ${c.name}`} onClick={() => setRemoving({ label: c.name, run: () => api.del(`/setup/contract/${c.id}`) })} className="rounded-[6px] p-[6px] text-[color:var(--ink-soft)] hover:bg-[#ffe9e9] hover:text-[#c8001a] cursor-pointer"><Trash2 size={14} /></button>
                    </span>
                  </div>
                ))}
                {mine.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-[color:var(--ink-soft)]">No contracts with {sponsor.name} yet.</p>}
              </ListBox>
            </section>

            {contract && (
              <section className={card}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {RULE_TABS.map((t) => <button key={t.id} onClick={() => setTab(t.id)} aria-pressed={tab === t.id} className={`h-[26px] rounded-full border px-3 text-[12px] cursor-pointer ${tab === t.id ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-white" : "border-[color:var(--line)] hover:bg-[color:var(--subtle)]"}`}>{t.label}</button>)}
                </div>
                <div className="mb-2 flex items-center gap-3"><p className="text-[13px] text-[color:var(--ink-soft)]">{activeTab.title} <span className="ml-1 font-medium text-[color:var(--ink)]">{rules.length}</span> <Muted>· {contract.name}</Muted></p><span className="ml-auto"><AddButton label="Add rule" onClick={() => setDialog({ type: "rule" })} /></span></div>
                <ListBox>
                  {rules.map((r) => (
                    <div key={str(r.id)} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[color:var(--line)] px-4 py-[8px] last:border-b-0">
                      <span className="text-[13px] font-medium">{ruleTitle(r)}</span>
                      {ruleText(r).map((t) => <span key={t} className="font-mono text-[12px] text-[color:var(--ink)]">{t}</span>)}
                      <button aria-label="Remove rule" onClick={() => setRemoving({ label: "this rule", run: () => api.del(`/setup/contract/${contract.id}/rules?kind=${tab}&ruleId=${encodeURIComponent(str(r.id))}`) })} className="ml-auto rounded-[6px] p-[6px] text-[color:var(--ink-soft)] hover:bg-[#ffe9e9] hover:text-[#c8001a] cursor-pointer"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {rules.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-[color:var(--ink-soft)]">No {activeTab.title.toLowerCase()} on this contract.</p>}
                </ListBox>
              </section>
            )}

            <section className={card}>
              <div className="mb-3 flex items-center gap-3"><p className="text-[13px] text-[color:var(--ink-soft)]">Dual-sponsor coordination <span className="ml-1 font-medium text-[color:var(--ink)]">{dual.items.length}</span></p><span className="ml-auto"><AddButton label="Add rule" onClick={() => setDialog({ type: "dual" })} /></span></div>
              <ListBox>
                {dual.items.map((d) => (
                  <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[color:var(--line)] px-4 py-[8px] text-[13px] last:border-b-0">
                    <span className="font-medium">{contractName(d.data.primaryContractId)}</span><Muted>then</Muted><span className="font-medium">{contractName(d.data.secondaryContractId)}</span>
                    <Pill tone="plain">{str(d.data.rule)}</Pill>
                    {d.data.rule === "Proportional split" && <span className="font-mono text-[12px]">{num(d.data.primarySharePercent).toFixed(2)}% / rest</span>}
                    <button aria-label="Remove rule" onClick={() => setRemoving({ label: "this coordination rule", run: () => api.del(`/setup/dual_sponsor_rule/${d.id}`) })} className="ml-auto rounded-[6px] p-[6px] text-[color:var(--ink-soft)] hover:bg-[#ffe9e9] hover:text-[#c8001a] cursor-pointer"><Trash2 size={14} /></button>
                  </div>
                ))}
                {dual.items.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-[color:var(--ink-soft)]">No dual-sponsor rules.</p>}
              </ListBox>
            </section>
            <ErrorNote message={error?.message} />
          </div>
        )}
      </div>

      {dialog?.type === "sponsor" && (
        <FormDialog key={dialog.rec?.id ?? "new"} title={dialog.rec ? "Edit sponsor" : "Add sponsor"} subtitle="Insurers, TPAs, corporates and government schemes that pay for patients' care." endpoint="/setup/sponsor" id={dialog.rec?.id}
          initial={dialog.rec ? { name: dialog.rec.name, type: dialog.rec.data.type, active: dialog.rec.active } : { type: "Insurer", active: true }} submitLabel={dialog.rec ? "Save changes" : "Add sponsor"} deleteLabel="Delete sponsor"
          rows={[[{ key: "name", label: "Name" }], [{ key: "type", label: "Type", type: "select", options: opt(SPONSOR_TYPES) }], [{ key: "active", label: "Active", type: "toggle" }]]}
          onSaved={(r) => { const rec = r as Rec | null; if (rec?.id) setSponsorId(rec.id); else setSponsorId(null); }} onClose={() => { setDialog(null); sponsors.reload(); }} />
      )}
      {dialog?.type === "contract" && sponsor && (
        <FormDialog key={dialog.rec?.id ?? "new"} width={500} title={dialog.rec ? "Edit contract" : "Add contract"} subtitle={`A contract with ${sponsor.name}. The code is assigned when it is created.`} endpoint="/setup/contract" id={dialog.rec?.id}
          initial={dialog.rec ? { name: dialog.rec.name, kind: dialog.rec.data.kind, ratePlanId: str(dialog.rec.data.ratePlanId), validFrom: dialog.rec.data.validFrom, validTo: dialog.rec.data.validTo, discountPercent: dialog.rec.data.discountPercent, creditDays: dialog.rec.data.creditDays, active: dialog.rec.active } : { kind: "Package", validFrom: new Date().toLocaleDateString("en-CA"), discountPercent: "0", creditDays: "30", active: true }}
          submitLabel={dialog.rec ? "Save changes" : "Add contract"} deleteLabel="Delete contract"
          rows={[[{ key: "name", label: "Contract name", placeholder: `${sponsor.name} - Group Mediclaim 2026` }],
            [{ key: "kind", label: "Priced as", type: "select", options: opt(["Package", "Rate plan"]) }, { key: "ratePlanId", label: "Rate plan", type: "select", options: [{ value: "", label: "None" }, ...plans.items.map((p) => ({ value: String(p.id), label: p.name }))], showIf: (v) => v.kind === "Rate plan" }],
            [{ key: "validFrom", label: "Valid from", type: "date" }, { key: "validTo", label: "Valid to (optional)", type: "date" }],
            [{ key: "discountPercent", label: "Discount / uplift (%)", type: "number", min: "-100", hint: "Negative lowers the price." }, { key: "creditDays", label: "Credit days", type: "number" }],
            [{ key: "active", label: "Active", type: "toggle" }]]}
          prepare={(v) => ({ ...v, sponsorId: sponsor.id })} onSaved={(r) => { const rec = r as Rec | null; if (rec?.id) setContractId(rec.id); }} onClose={() => { setDialog(null); contracts.reload(); }} />
      )}
      {dialog?.type === "rule" && contract && <RuleDialog kind={tab} contract={contract} groups={groups.items} onClose={() => { setDialog(null); contracts.reload(); }} />}
      {dialog?.type === "dual" && (
        <FormDialog title="Add dual-sponsor rule" subtitle="Which contract is billed first, or the proportional split between the two." endpoint="/setup/dual_sponsor_rule" submitLabel="Add rule"
          initial={{ rule: "Primary first", primarySharePercent: "70", active: true }}
          rows={[[{ key: "primaryContractId", label: "Primary contract", type: "select", options: [{ value: "", label: "Pick a contract" }, ...contracts.items.map((c) => ({ value: String(c.id), label: c.name }))] }, { key: "secondaryContractId", label: "Secondary contract", type: "select", options: [{ value: "", label: "Pick a contract" }, ...contracts.items.map((c) => ({ value: String(c.id), label: c.name }))] }],
            [{ key: "rule", label: "Coordination rule", type: "select", options: opt(COPAY_ENDS) }], [{ key: "primarySharePercent", label: "Primary pays (%)", type: "number", showIf: (v) => v.rule === "Proportional split", hint: "The secondary contract pays the rest." }]]}
          width={560} disabled={(v) => !v.primaryContractId || !v.secondaryContractId}
          prepare={(v) => ({ ...v, name: `${contractName(v.primaryContractId)} → ${contractName(v.secondaryContractId)}` })} onClose={() => { setDialog(null); dual.reload(); }} />
      )}
      <ConfirmDialog open={removing !== null} title={`Delete ${removing?.label ?? ""}?`} message="This can't be undone." confirmLabel="Delete" danger loading={loading} onConfirm={confirmRemove} onCancel={() => setRemoving(null)} />
    </div>
  );
}

function RuleDialog({ kind, contract, groups, onClose }: { kind: RuleKind; contract: Rec; groups: Rec[]; onClose: () => void }) {
  const number = (key: string, label: string) => ({ key, label, type: "number" as const });
  const spec = {
    copay: {
      title: "Add copay rule", subtitle: "Deductible is subtracted first; copay % applies to the rest, clamped to min/max.",
      rows: [[{ key: "groupId", label: "Applies to", type: "select" as const, options: [{ value: "", label: "Whole contract (default rule)" }, ...groups.map((g) => ({ value: String(g.id), label: `${g.name} (group)` }))] }],
        [number("copayPercent", "Copay %"), number("deductible", "Deductible (₹)")], [number("copayMin", "Copay min (₹)"), number("copayMax", "Copay max (₹)")], [number("annualLimit", "Annual limit (₹)"), number("encounterLimit", "Per-encounter limit (₹)")], [number("episodicLimit", "Episodic limit (₹)")]],
    },
    exclusion: { title: "Add exclusion", subtitle: "Something this contract does not pay for.", rows: [[{ key: "target", label: "Excluded service or group", placeholder: "e.g. Cosmetic surgery" }], [{ key: "reason", label: "Reason (optional)" }]] },
    limit: { title: "Add limit rule", subtitle: "A cap on one kind of charge.", rows: [[{ key: "target", label: "Applies to", placeholder: "e.g. Room rent" }], [number("limitAmount", "Amount limit (₹)"), number("limitCount", "Times allowed")], [{ key: "per", label: "Per", type: "select" as const, options: opt(["contract", "year", "admission", "visit", "day"]) }]] },
    drg: { title: "Add DRG / per diem rule", subtitle: "A fixed package or daily rate for a diagnosis.", rows: [[{ key: "diagnosis", label: "Diagnosis or procedure" }, { key: "code", label: "Code" }], [number("packageAmount", "Package amount (₹)"), number("perDiemAmount", "Per diem (₹)")], [number("maxDays", "Max days")]] },
  }[kind];
  return (
    <FormDialog title={spec.title} subtitle={spec.subtitle} width={500} endpoint={`/setup/contract/${contract.id}/rules`} submitLabel="Add rule" initial={kind === "limit" ? { per: "contract" } : {}}
      rows={spec.rows as never} prepare={(v) => ({ kind, rule: { ...v, appliesTo: kind === "copay" ? (v.groupId ? `${groups.find((g) => g.id === Number(v.groupId))?.name ?? ""} (group)` : "Whole contract (default rule)") : undefined } })}
      onClose={onClose} />
  );
}
