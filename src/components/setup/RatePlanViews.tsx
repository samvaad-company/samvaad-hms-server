"use client";

/** Rate plans: each plan prices the service catalogue for a payer; a derived plan overrides some prices and falls through to its base. */
import { useMemo, useRef, useState } from "react";
import { History, Star, Upload } from "lucide-react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { RATE_SCOPES, inr, type RateScope } from "@/types/setup";
import { Modal } from "@/components/shared/Modal";
import { DialogButtons, ErrorNote, outlineBtn, primaryBtn, stampShort } from "@/components/mrd/shared";
import { attempt } from "@/components/hr/shared";
import { SearchBox } from "@/components/setup/CatalogViews";
import { AddButton, Code, EditIcon, FormDialog, Inactive, ListBox, ListHeader, Muted, Row, dateRange, num, parseCsv, str, useSetup, type Rec } from "@/components/setup/ui";

type PriceMap = Record<string, Record<string, number>>;
const SCOPE_LABEL: Record<RateScope, string> = { general: "General", package: "Package", tpa: "TPA" };

/** What a plan charges for a service: its own price, else its base plan's, else the service's list price. */
export function priceFor(plan: Rec | undefined, plans: Rec[], service: Rec, scope: RateScope, depth = 0): { price: number; own: boolean; from: string } {
  const own = ((plan?.data.prices as PriceMap | undefined) ?? {})[scope]?.[String(service.id)];
  if (own != null) return { price: own, own: true, from: plan?.name ?? "" };
  const base = plan?.data.basePlanId != null ? plans.find((p) => p.id === Number(plan.data.basePlanId)) : undefined;
  if (base && depth < 5) { const inherited = priceFor(base, plans, service, scope, depth + 1); return { ...inherited, own: false }; }
  return { price: num(service.data.price), own: false, from: "list price" };
}

export function RatePlansView() {
  const plans = useSetup("rate_plan");
  const services = useSetup("service");
  const payers = useSetup("payer_class");
  const categories = useSetup("patient_category");
  const wards = useSetup("ward_class");
  const [selected, setSelected] = useState<number | null>(null);
  const [scope, setScope] = useState<RateScope>("general");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [dialog, setDialog] = useState<{ plan?: Rec } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [importing, setImporting] = useState(false);
  const { run, loading, error, reset } = useMutation();

  const plan = plans.items.find((p) => p.id === (selected ?? plans.items[0]?.id));
  const q = query.trim().toLowerCase();
  const shown = services.items.filter((s) => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  const dirty = Object.keys(draft).length;

  function pick(id: number) { setSelected(id); setDraft({}); reset(); }
  function changeScope(s: RateScope) { setScope(s); setDraft({}); reset(); }

  async function save() {
    if (!plan) return;
    reset();
    const changes = Object.entries(draft).map(([id, v]) => ({ serviceId: Number(id), price: v.trim() === "" ? null : Number(v) }));
    if (await attempt(run(() => api.put(`/setup/rate_plan/${plan.id}/prices`, { scope, changes })))) { setDraft({}); plans.reload(); }
  }

  const planOptions = (exceptId?: number) => [{ value: "", label: "None" }, ...plans.items.filter((p) => p.id !== exceptId).map((p) => ({ value: String(p.id), label: p.name }))];

  return (
    <div>
      <ListHeader title="Rate plans" count={plans.items.length}><AddButton primary label="Add plan" onClick={() => setDialog({})} /></ListHeader>
      <div className="flex items-start gap-4">
        <nav aria-label="Rate plans" className="w-[230px] shrink-0 text-[13px]">
          {plans.items.map((p) => (
            <button key={p.id} onClick={() => pick(p.id)} className={`flex w-full items-center gap-2 rounded-[8px] px-3 py-[8px] text-left cursor-pointer ${plan?.id === p.id ? "bg-[color:var(--subtle)] font-medium" : "hover:bg-[color:var(--faint)]"}`}>
              <span className="min-w-0 flex-1 truncate" title={p.name}>{p.name}</span>
              {p.data.isDefault === true && <Star size={12} className="shrink-0 fill-current text-[color:var(--ink)]" aria-label="Default plan" />}
              {!p.active && <Inactive />}
            </button>
          ))}
        </nav>
        {plan ? (
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="font-mono text-[12px] text-[color:var(--ink-soft)]">{dateRange(plan.data.effectiveFrom, plan.data.effectiveTo)}</span>
              <EditIcon label={`Edit ${plan.name}`} onClick={() => setDialog({ plan })} />
              {plan.data.basePlanId != null && <Muted>Falls back to {plans.items.find((p) => p.id === Number(plan.data.basePlanId))?.name ?? "its base plan"}</Muted>}
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <div role="tablist" aria-label="Price list" className="inline-flex rounded-[8px] bg-[color:var(--subtle)] p-[3px]">
                  {RATE_SCOPES.map((s) => (
                    <button key={s} role="tab" aria-selected={scope === s} onClick={() => changeScope(s)} className={`h-[26px] rounded-[6px] px-3 text-[12px] cursor-pointer ${scope === s ? "bg-[color:var(--surface)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>{SCOPE_LABEL[s]}</button>
                  ))}
                </div>
                <button onClick={() => setImporting(true)} className={outlineBtn + " !h-[34px]"}><Upload size={14} /> Import</button>
                <button onClick={() => setShowHistory(true)} className={outlineBtn + " !h-[34px]"}><History size={14} /> History</button>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <SearchBox value={query} onChange={setQuery} placeholder="Search services..." />
              {dirty > 0 && (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[13px] text-[color:var(--ink-soft)]">{dirty} unsaved {dirty === 1 ? "change" : "changes"}</span>
                  <button onClick={() => setDraft({})} className={outlineBtn + " !h-[34px]"}>Discard</button>
                  <button onClick={save} disabled={loading} className={primaryBtn + " !h-[34px]"}>{loading ? "Saving…" : "Save prices"}</button>
                </div>
              )}
            </div>
            <ErrorNote message={error?.message} />
            <ListBox>
              {shown.map((s) => {
                const eff = priceFor(plan, plans.items, s, scope);
                const edited = s.id in draft;
                return (
                  <Row key={s.id}>
                    <span className="w-[96px] shrink-0"><Code>{s.code}</Code></span>
                    <span className="min-w-0 flex-1 truncate text-[14px] text-[color:var(--ink)]">{s.name}</span>
                    {!eff.own && !edited && <Muted>{eff.from}</Muted>}
                    <input aria-label={`${s.name} price`} inputMode="decimal" value={edited ? draft[s.id] : eff.own ? String(eff.price) : ""} placeholder={String(eff.price)}
                      onChange={(e) => setDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                      className={`h-[32px] w-[110px] rounded-[6px] border bg-[color:var(--surface)] px-2 text-right font-mono text-[13px] focus:border-[color:var(--brand)] focus:outline-none ${edited ? "border-[color:var(--brand)]" : "border-[color:var(--line)]"} ${eff.own ? "font-semibold" : ""}`} />
                  </Row>
                );
              })}
            </ListBox>
          </div>
        ) : <p className="py-12 text-[14px] text-[color:var(--ink-soft)]">No rate plans yet — add the first one.</p>}
      </div>

      {dialog && (
        <FormDialog key={dialog.plan?.id ?? "new"} width={500} title={dialog.plan ? "Edit rate plan" : "Add rate plan"} subtitle="A plan prices services for a payer class; a derived plan overrides selected services and the rest fall through to its base."
          endpoint="/setup/rate_plan" id={dialog.plan?.id} submitLabel={dialog.plan ? "Save changes" : "Add plan"} deleteLabel="Delete plan"
          initial={dialog.plan
            ? { name: dialog.plan.name, payerClassId: str(dialog.plan.data.payerClassId), basePlanId: str(dialog.plan.data.basePlanId), patientCategoryId: str(dialog.plan.data.patientCategoryId), wardClassId: str(dialog.plan.data.wardClassId), effectiveFrom: dialog.plan.data.effectiveFrom, effectiveTo: dialog.plan.data.effectiveTo, notes: dialog.plan.data.notes, isDefault: dialog.plan.data.isDefault === true, active: dialog.plan.active }
            : { effectiveFrom: new Date().toLocaleDateString("en-CA"), active: true }}
          rows={[[{ key: "name", label: "Name" }],
            [{ key: "payerClassId", label: "Payer class", type: "select", options: [{ value: "", label: "None" }, ...payers.items.map((p) => ({ value: String(p.id), label: p.name }))] }, { key: "basePlanId", label: "Base plan", type: "select", options: planOptions(dialog.plan?.id) }],
            [{ key: "patientCategoryId", label: "Patient category", type: "select", options: [{ value: "", label: "None" }, ...categories.items.map((c) => ({ value: String(c.id), label: c.name }))] }, { key: "wardClassId", label: "Ward class", type: "select", options: [{ value: "", label: "None" }, ...wards.items.map((w) => ({ value: String(w.id), label: w.name }))] }],
            [{ key: "effectiveFrom", label: "Effective from", type: "date" }, { key: "effectiveTo", label: "Effective to (optional)", type: "date" }],
            [{ key: "notes", label: "Notes", type: "textarea", rows: 2 }],
            [{ key: "isDefault", label: "Default plan (used when nothing else matches)", type: "toggle" }], [{ key: "active", label: "Active", type: "toggle" }]]}
          onClose={() => { setDialog(null); plans.reload(); }} onSaved={(r) => { const rec = r as Rec | null; if (rec?.id) pick(rec.id); }} />
      )}
      {showHistory && plan && <HistoryDialog plan={plan} onClose={() => setShowHistory(false)} />}
      {importing && plan && <PriceImportDialog plan={plan} scope={scope} services={services.items} onClose={() => { setImporting(false); plans.reload(); }} />}
    </div>
  );
}

function HistoryDialog({ plan, onClose }: { plan: Rec; onClose: () => void }) {
  const history = (plan.data.history as { at: string; by: string; scope: string; service: string; from: number | null; to: number | null }[] | undefined) ?? [];
  return (
    <Modal open onClose={onClose} width={560} title="Price history" subtitle={`${plan.name} — the latest 300 price changes.`} footer={<DialogButtons onCancel={onClose} onConfirm={onClose} label="Close" />}>
      {history.length === 0 ? <p className="py-8 text-center text-[14px] text-[color:var(--ink-soft)]">No price has been changed on this plan yet.</p> : (
        <ul className="max-h-[420px] divide-y divide-[color:var(--line)] overflow-y-auto rounded-[8px] border border-[color:var(--line)]">
          {history.map((h, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate font-medium">{h.service}</span>
              <span className="font-mono text-[12px] text-[color:var(--ink-soft)]">{SCOPE_LABEL[h.scope as RateScope] ?? h.scope}</span>
              <span className="font-mono">{h.from == null ? "—" : inr(h.from)} → {h.to == null ? "removed" : inr(h.to)}</span>
              <span className="w-full text-[12px] text-[color:var(--ink-soft)]">{h.by} · {stampShort(h.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function PriceImportDialog({ plan, scope, services, onClose }: { plan: Rec; scope: RateScope; services: Rec[]; onClose: () => void }) {
  const { run, loading, error, reset } = useMutation();
  const [changes, setChanges] = useState<{ serviceId: number; price: number | null }[] | null>(null);
  const [unknown, setUnknown] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const byCode = useMemo(() => new Map(services.map((s) => [s.code.toUpperCase(), s.id])), [services]);

  async function choose(f: File | undefined) {
    reset(); setDone(false);
    if (!f) return;
    const table = parseCsv(await f.text());
    const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
    const ci = header.findIndex((h) => h === "code" || h === "service code");
    const pi = header.findIndex((h) => h === "price" || h === "rate" || h === "price (₹)");
    if (ci < 0 || pi < 0) { setChanges(null); setUnknown(["The header row needs Code and Price columns."]); return; }
    const out: { serviceId: number; price: number | null }[] = [], miss: string[] = [];
    for (const r of table.slice(1)) {
      const id = byCode.get((r[ci] ?? "").trim().toUpperCase());
      if (!id) { miss.push(`${r[ci] ?? "?"}: no such service code`); continue; }
      const raw = (r[pi] ?? "").trim();
      out.push({ serviceId: id, price: raw === "" ? null : Number(raw) });
    }
    setChanges(out); setUnknown(miss);
  }
  async function go() {
    if (!changes?.length) return;
    if (await attempt(run(() => api.put(`/setup/rate_plan/${plan.id}/prices`, { scope, changes })))) setDone(true);
  }
  return (
    <Modal open onClose={onClose} width={500} title="Import prices" subtitle={`${plan.name} · ${SCOPE_LABEL[scope]} prices. A CSV with Code and Price columns; an empty price removes that plan's own price.`}
      footer={done ? <DialogButtons onCancel={onClose} onConfirm={onClose} label="Done" /> : <DialogButtons onCancel={onClose} onConfirm={go} label={changes ? `Apply ${changes.length} prices` : "Apply"} busyLabel="Applying…" loading={loading} disabled={!changes?.length} />}>
      <div className="flex flex-col gap-3">
        <input ref={file} type="file" accept=".csv,text/csv" onChange={(e) => choose(e.target.files?.[0])} aria-label="CSV file" className="text-[13px]" />
        {changes && !done && <p className="text-[13px]">{changes.length} prices ready.</p>}
        {done && <p role="status" className="rounded-[8px] bg-[#dffff3] px-3 py-2 text-[13px] text-[#0b7a47]">Prices applied.</p>}
        {unknown.length > 0 && <ul className="list-disc pl-5 text-[13px] text-[#8a3b00]">{unknown.slice(0, 6).map((u) => <li key={u}>{u}</li>)}</ul>}
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}
