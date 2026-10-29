"use client";

/** Packages: priced bundles of services (health checks, multi-visit programmes, surgical packages) with inclusions, exclusions and who may order them. */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import type { MedicineDTO } from "@/types/api";
import { PACKAGE_TYPES } from "@/types/setup";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorNote, outlineBtn, primaryBtn } from "@/components/mrd/shared";
import { attempt } from "@/components/hr/shared";
import { AddButton, Labelled, ListHeader, Muted, ToggleRow, num, str, useSetup, type Rec } from "@/components/setup/ui";

interface Inclusion { kind: string; refId: number | null; name: string; category: string; qty: string; rate: string; maxQty: string; maxAmount: string }
interface Exclusion { kind: string; refId: number | null; name: string }
interface OrderRule { minAge: string; maxAge: string; gender: string; patientCategoryId: string; centerId: string }
interface Draft { name: string; code: string; type: string; price: string; sessions: string; gapDays: string; validityDays: string; description: string; active: boolean; inclusions: Inclusion[]; exclusions: Exclusion[]; rules: OrderRule[] }

const BLANK: Draft = { name: "", code: "", type: "Health check", price: "", sessions: "1", gapDays: "", validityDays: "", description: "", active: true, inclusions: [], exclusions: [], rules: [] };

function toDraft(r: Rec): Draft {
  const d = r.data;
  const arr = (k: string) => ((d[k] as Record<string, unknown>[] | undefined) ?? []);
  return {
    name: r.name, code: r.code, type: str(d.type) || "Health check", price: str(d.price), sessions: str(d.sessions) || "1", gapDays: str(d.gapDays), validityDays: str(d.validityDays), description: str(d.description), active: r.active,
    inclusions: arr("inclusions").map((i) => ({ kind: str(i.kind) || "service", refId: i.refId == null ? null : Number(i.refId), name: str(i.name), category: str(i.category), qty: str(i.qty), rate: str(i.rate), maxQty: str(i.maxQty), maxAmount: str(i.maxAmount) })),
    exclusions: arr("exclusions").map((i) => ({ kind: str(i.kind) || "service", refId: i.refId == null ? null : Number(i.refId), name: str(i.name) })),
    rules: arr("orderingRules").map((i) => ({ minAge: str(i.minAge), maxAge: str(i.maxAge), gender: str(i.gender) || "Any", patientCategoryId: str(i.patientCategoryId), centerId: str(i.centerId) })),
  };
}

const cell = "h-[30px] w-full rounded-[6px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 text-right font-mono text-[12px] focus:border-[color:var(--brand)] focus:outline-none";
const card = "rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] p-4";

export function PackagesView() {
  const packages = useSetup("package");
  const [selected, setSelected] = useState<number | "new" | null>(null);
  const current = selected === "new" ? null : packages.items.find((p) => p.id === (selected ?? packages.items[0]?.id)) ?? null;
  const currentId = selected === "new" ? "new" : current?.id ?? null;
  return (
    <div>
      <ListHeader title="Packages" count={packages.items.length}><AddButton primary label="New package" onClick={() => setSelected("new")} /></ListHeader>
      <div className="flex items-start gap-4">
        <nav aria-label="Packages" className="w-[250px] shrink-0 text-[13px]">
          {packages.items.map((p) => (
            <button key={p.id} onClick={() => setSelected(p.id)} className={`flex w-full items-center justify-between gap-2 rounded-[8px] px-3 py-[8px] text-left cursor-pointer ${currentId === p.id ? "bg-[color:var(--subtle)] font-medium" : "hover:bg-[color:var(--faint)]"}`}>
              <span className="min-w-0 truncate" title={p.name}>{p.name}</span><Muted>{str(p.data.type)}</Muted>
            </button>
          ))}
          {selected === "new" && <div className="rounded-[8px] bg-[color:var(--subtle)] px-3 py-[8px] font-medium">New package…</div>}
        </nav>
        {(current || selected === "new") ? (
          <PackageEditor key={String(currentId)} pkg={current} onChanged={(id) => { packages.reload(); if (id !== null) setSelected(id); else setSelected(null); }} />
        ) : <p className="py-12 text-[14px] text-[color:var(--ink-soft)]">No packages yet — add the first one.</p>}
      </div>
    </div>
  );
}

function PackageEditor({ pkg, onChanged }: { pkg: Rec | null; onChanged: (id: number | null) => void }) {
  const services = useSetup("service");
  const groups = useSetup("service_group");
  const categories = useSetup("patient_category");
  const centers = useSetup("collection_center");
  const { items: medicines } = useList<MedicineDTO>("/medicines", { all: true });
  const [draft, setDraft] = useState<Draft>(() => (pkg ? toDraft(pkg) : BLANK));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run, loading, error, reset } = useMutation();
  const current = pkg;
  const selected = pkg ? pkg.id : "new";
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const patchAt = <T,>(key: "inclusions" | "exclusions" | "rules", i: number, patch: Partial<T>) => setDraft((d) => ({ ...d, [key]: (d[key] as unknown as T[]).map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const removeAt = (key: "inclusions" | "exclusions" | "rules", i: number) => setDraft((d) => ({ ...d, [key]: (d[key] as unknown[]).filter((_, j) => j !== i) }));
  const serviceOptions = services.items.map((s) => ({ value: String(s.id), label: s.name, hint: s.code }));
  const groupName = (s: Rec) => groups.items.find((g) => g.id === Number(s.data.groupId))?.name ?? "";

  async function save() {
    reset();
    const fields = { name: draft.name, code: draft.code, type: draft.type, price: draft.price, sessions: draft.sessions, gapDays: draft.gapDays, validityDays: draft.validityDays, description: draft.description, active: draft.active };
    const content = { inclusions: draft.inclusions, exclusions: draft.exclusions, orderingRules: draft.rules };
    let id = current?.id;
    const ok = await attempt(run(async () => {
      if (selected === "new" || !current) id = (await api.post<Rec>("/setup/package", fields)).id;
      else await api.patch(`/setup/package/${current.id}`, fields);
      await api.put(`/setup/package/${id}/content`, content);
    }));
    if (ok) onChanged(id ?? null);
  }
  async function remove() {
    if (!current) return;
    setConfirmDelete(false);
    if (await attempt(run(() => api.del(`/setup/package/${current.id}`)))) onChanged(null);
  }

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
            <section className={card}>
              <p className="mb-3 text-[12px] text-[color:var(--ink-soft)]">Package</p>
              <div className="grid gap-3" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
                <Labelled label="Name"><FormInput value={draft.name} onChange={(v) => set("name", v)} /></Labelled>
                <Labelled label="Code"><div className="font-mono"><FormInput value={draft.code} placeholder="PKG-01" onChange={(v) => set("code", v.toUpperCase())} /></div></Labelled>
                <Labelled label="Type"><FormSelect value={draft.type} onChange={(v) => set("type", v)} options={PACKAGE_TYPES.map((t) => ({ value: t, label: t }))} /></Labelled>
              </div>
              <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                <Labelled label="Price (₹)"><FormInput type="number" value={draft.price} onChange={(v) => set("price", v)} /></Labelled>
                <Labelled label="Sessions"><FormInput type="number" min="1" value={draft.sessions} onChange={(v) => set("sessions", v)} /></Labelled>
                <Labelled label="Gap (days)"><FormInput type="number" value={draft.gapDays} placeholder="-" onChange={(v) => set("gapDays", v)} /></Labelled>
                <Labelled label="Validity (days)"><FormInput type="number" value={draft.validityDays} placeholder="never lapses" onChange={(v) => set("validityDays", v)} /></Labelled>
              </div>
              <div className="mt-3 grid items-end gap-3" style={{ gridTemplateColumns: "1fr 160px" }}>
                <Labelled label="Description"><FormInput value={draft.description} onChange={(v) => set("description", v)} /></Labelled>
                <ToggleRow label="Active" checked={draft.active} onChange={(v) => set("active", v)} />
              </div>
            </section>

            <section className={card}>
              <p className="mb-3 text-[12px] text-[color:var(--ink-soft)]">Inclusions &amp; limits</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[13px]">
                  <thead><tr className="text-[12px] text-[color:var(--ink-soft)]"><th className="py-1 font-normal">Item</th><th className="font-normal">Category</th><th className="w-[70px] text-right font-normal">Qty</th><th className="w-[90px] text-right font-normal">Rate ₹</th><th className="w-[80px] text-right font-normal">Max qty</th><th className="w-[90px] text-right font-normal">Max ₹</th><th className="w-[30px]" /></tr></thead>
                  <tbody>
                    {draft.inclusions.map((i, n) => (
                      <tr key={n} className="border-t border-[color:var(--line)]">
                        <td className="py-[6px] pr-2">{i.name}{i.kind === "category" && <Muted> (category limit)</Muted>}</td>
                        <td className="pr-2"><Muted>{i.category}</Muted></td>
                        <td className="pr-1">{i.kind !== "category" && <input aria-label={`${i.name} quantity`} className={cell} value={i.qty} onChange={(e) => patchAt<Inclusion>("inclusions", n, { qty: e.target.value })} />}</td>
                        <td className="pr-1">{i.kind !== "category" && <input aria-label={`${i.name} rate`} className={cell} value={i.rate} onChange={(e) => patchAt<Inclusion>("inclusions", n, { rate: e.target.value })} />}</td>
                        <td className="pr-1"><input aria-label={`${i.name} max quantity`} className={cell} value={i.maxQty} onChange={(e) => patchAt<Inclusion>("inclusions", n, { maxQty: e.target.value })} /></td>
                        <td className="pr-1"><input aria-label={`${i.name} max amount`} className={cell} value={i.maxAmount} onChange={(e) => patchAt<Inclusion>("inclusions", n, { maxAmount: e.target.value })} /></td>
                        <td><button aria-label={`Remove ${i.name}`} onClick={() => removeAt("inclusions", n)} className="p-1 text-[color:var(--ink-soft)] hover:text-[#c8001a] cursor-pointer"><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {draft.inclusions.length === 0 && <p className="rounded-[8px] border border-dashed border-[color:var(--line)] py-6 text-center text-[13px] text-[color:var(--ink-soft)]">No inclusions yet - add services, inventory items, or category limits below.</p>}
              </div>
              <div className="mt-3 grid items-center gap-2" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
                <SearchSelect placeholder="Add a service or charge…" value="" options={serviceOptions}
                  onChange={(v) => { const s = services.items.find((x) => String(x.id) === v); if (s) set("inclusions", [...draft.inclusions, { kind: "service", refId: s.id, name: s.name, category: groupName(s), qty: "1", rate: str(s.data.price), maxQty: "", maxAmount: "" }]); }} />
                <SearchSelect placeholder="Add an inventory item (search drugs)…" value="" options={medicines.map((m) => ({ value: String(m.id), label: m.name, hint: m.generic }))}
                  onChange={(v) => { const m = medicines.find((x) => String(x.id) === v); if (m) set("inclusions", [...draft.inclusions, { kind: "item", refId: m.id, name: m.name, category: m.category, qty: "1", rate: "", maxQty: "", maxAmount: "" }]); }} />
                <CategoryAdd label="Category limit" groups={groups.items} onPick={(g) => set("inclusions", [...draft.inclusions, { kind: "category", refId: g.id, name: g.name, category: "Category", qty: "", rate: "", maxQty: "", maxAmount: "" }])} />
              </div>
            </section>

            <section className={card}>
              <p className="mb-3 text-[12px] text-[color:var(--ink-soft)]">Exclusions</p>
              {draft.exclusions.length === 0 ? <p className="rounded-[8px] border border-dashed border-[color:var(--line)] py-6 text-center text-[13px] text-[color:var(--ink-soft)]">Nothing excluded - every catalog item may ride this package&apos;s cart.</p> : (
                <ul className="mb-2 flex flex-wrap gap-2">{draft.exclusions.map((x, n) => <li key={n} className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] px-3 py-[3px] text-[13px]">{x.name}{x.kind === "category" && <Muted>(category)</Muted>}<button aria-label={`Remove ${x.name}`} onClick={() => removeAt("exclusions", n)} className="text-[color:var(--ink-soft)] hover:text-[#c8001a] cursor-pointer">×</button></li>)}</ul>
              )}
              <div className="mt-2 grid items-center gap-2" style={{ gridTemplateColumns: "1fr auto" }}>
                <SearchSelect placeholder="Add a service or charge…" value="" options={serviceOptions}
                  onChange={(v) => { const s = services.items.find((x) => String(x.id) === v); if (s) set("exclusions", [...draft.exclusions, { kind: "service", refId: s.id, name: s.name }]); }} />
                <CategoryAdd label="Exclude a category" groups={groups.items} onPick={(g) => set("exclusions", [...draft.exclusions, { kind: "category", refId: g.id, name: g.name }])} />
              </div>
            </section>

            <section className={card}>
              <p className="text-[12px] text-[color:var(--ink-soft)]">Ordering rules</p>
              <p className="mb-3 text-[12px] text-[color:var(--ink-soft)]">No rules = anyone can order. With rules, at least one must match the patient/center - each rule combines its filled constraints.</p>
              {draft.rules.map((r, n) => (
                <div key={n} className="mb-2 grid items-end gap-2" style={{ gridTemplateColumns: "80px 80px 110px 1fr 1fr 30px" }}>
                  <Labelled label="Min age"><FormInput type="number" value={r.minAge} onChange={(v) => patchAt<OrderRule>("rules", n, { minAge: v })} /></Labelled>
                  <Labelled label="Max age"><FormInput type="number" value={r.maxAge} onChange={(v) => patchAt<OrderRule>("rules", n, { maxAge: v })} /></Labelled>
                  <Labelled label="Gender"><FormSelect value={r.gender} onChange={(v) => patchAt<OrderRule>("rules", n, { gender: v })} options={["Any", "Male", "Female"].map((g) => ({ value: g, label: g }))} /></Labelled>
                  <Labelled label="Patient category"><FormSelect value={r.patientCategoryId} onChange={(v) => patchAt<OrderRule>("rules", n, { patientCategoryId: v })} options={[{ value: "", label: "Any" }, ...categories.items.map((c) => ({ value: String(c.id), label: c.name }))]} /></Labelled>
                  <Labelled label="Center"><FormSelect value={r.centerId} onChange={(v) => patchAt<OrderRule>("rules", n, { centerId: v })} options={[{ value: "", label: "Any" }, ...centers.items.map((c) => ({ value: String(c.id), label: c.name }))]} /></Labelled>
                  <button aria-label="Remove rule" onClick={() => removeAt("rules", n)} className="mb-3 p-1 text-[color:var(--ink-soft)] hover:text-[#c8001a] cursor-pointer"><Trash2 size={14} /></button>
                </div>
              ))}
              <button onClick={() => set("rules", [...draft.rules, { minAge: "", maxAge: "", gender: "Any", patientCategoryId: "", centerId: "" }])} className={outlineBtn + " !h-[32px]"}><Plus size={14} /> Add rule</button>
            </section>

            <ErrorNote message={error?.message} />
            <div className="flex items-center gap-2">
              {current && <button onClick={() => setConfirmDelete(true)} className="h-[36px] rounded-[8px] px-3 text-[13px] font-medium text-[#c8001a] hover:bg-[#ffe9e9] cursor-pointer">Delete package</button>}
              <button onClick={save} disabled={loading || draft.name.trim().length < 1 || draft.code.trim().length < 1 || num(draft.price) < 0 || draft.price === ""} className={primaryBtn + " ml-auto"}>{loading ? "Saving…" : selected === "new" ? "Create package" : "Save package"}</button>
            </div>
          </div>
      <ConfirmDialog open={confirmDelete} title="Delete this package?" message={`${draft.name} is removed from the catalogue.`} confirmLabel="Delete" danger onConfirm={remove} onCancel={() => setConfirmDelete(false)} />
    </>
  );
}

function CategoryAdd({ label, groups, onPick }: { label: string; groups: Rec[]; onPick: (g: Rec) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className={outlineBtn + " !h-[40px]"}><Plus size={14} /> {label}</button>
      {open && (
        <ul className="absolute right-0 z-20 mt-1 max-h-[240px] w-[230px] overflow-y-auto rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] py-1 shadow-lg">
          {groups.map((g) => <li key={g.id}><button onClick={() => { onPick(g); setOpen(false); }} className="w-full px-3 py-[6px] text-left text-[13px] hover:bg-[color:var(--subtle)] cursor-pointer">{g.name}</button></li>)}
        </ul>
      )}
    </div>
  );
}
