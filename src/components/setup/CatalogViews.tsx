"use client";

/** Catalog & pricing: the service catalogue (with its groups and CSV import) and the Tax & GST mappings. */
import { useMemo, useRef, useState } from "react";
import { Upload, FolderPlus, Search } from "lucide-react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { BILLING_CATEGORIES, inr } from "@/types/setup";
import { Modal } from "@/components/shared/Modal";
import { DialogButtons, ErrorNote, outlineBtn, Pill } from "@/components/mrd/shared";
import { AddButton, Code, EditIcon, FormDialog, Inactive, ListBox, ListHeader, Row, num, parseCsv, str, useSetup, type Rec } from "@/components/setup/ui";

const opt = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-[240px]">
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="h-[34px] w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] pl-8 pr-3 text-[13px] focus:border-[color:var(--brand)] focus:outline-none" />
    </div>
  );
}

// ── Services ─────────────────────────────────────────────────────────────────

export function ServicesView() {
  const groups = useSetup("service_group");
  const services = useSetup("service");
  const centers = useSetup("collection_center");
  const wardClasses = useSetup("ward_class", true);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ type: "service" | "group"; rec?: Rec } | null>(null);
  const [importing, setImporting] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of services.items) { const g = Number(s.data.groupId); if (g) m.set(g, (m.get(g) ?? 0) + 1); }
    return m;
  }, [services.items]);
  const groupName = useMemo(() => new Map(groups.items.map((g) => [g.id, g.name])), [groups.items]);
  const q = query.trim().toLowerCase();
  const shown = services.items.filter((s) => (groupId === null || Number(s.data.groupId) === groupId) && (!q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)));
  const selectedGroup = groupId === null ? undefined : groups.items.find((g) => g.id === groupId);

  return (
    <div>
      <ListHeader title="Services" count={services.items.length}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search name or code..." />
        <button onClick={() => setImporting(true)} className={outlineBtn + " !h-[34px]"}><Upload size={14} /> Import CSV</button>
        <button onClick={() => setDialog({ type: "group" })} className={outlineBtn + " !h-[34px]"}><FolderPlus size={14} /> Add group</button>
        <AddButton primary label="Add service" onClick={() => setDialog({ type: "service" })} />
      </ListHeader>
      <div className="flex items-start gap-4">
        <nav aria-label="Service groups" className="w-[190px] shrink-0 text-[13px]">
          {[{ id: null as number | null, name: "All services", count: services.items.length }, ...groups.items.map((g) => ({ id: g.id as number | null, name: g.name, count: counts.get(g.id) ?? 0 }))].map((g) => (
            <div key={g.id ?? "all"} className={`group flex items-center rounded-[8px] ${groupId === g.id ? "bg-[color:var(--subtle)] font-medium" : "hover:bg-[color:var(--faint)]"}`}>
              <button onClick={() => setGroupId(g.id)} className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-[7px] text-left cursor-pointer"><span className="truncate" title={g.name}>{g.name}</span><span className="text-[12px] text-[color:var(--ink-soft)]">{g.count}</span></button>
              {g.id !== null && groupId === g.id && <EditIcon label={`Edit group ${g.name}`} onClick={() => setDialog({ type: "group", rec: selectedGroup })} />}
            </div>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          <ListBox>
            {shown.map((s) => (
              <Row key={s.id}>
                <span className="w-[96px] shrink-0"><Code>{s.code}</Code></span>
                <span className="min-w-[130px] flex-1 truncate text-[14px] font-medium text-[color:var(--ink)]" title={s.name}>{s.name}</span>
                {!s.active && <Inactive />}
                <span className="hidden max-w-[150px] truncate whitespace-nowrap text-[12px] text-[color:var(--ink-soft)] xl:inline">{groupName.get(Number(s.data.groupId)) ?? ""}</span>
                {s.data.gstApplies === true && <Pill tone="plain">GST {num(s.data.gstRate)}%</Pill>}
                <span className="w-[92px] shrink-0 text-right font-mono text-[13px] text-[color:var(--ink)]">{inr(num(s.data.price))}</span>
                <EditIcon label={`Edit ${s.name}`} onClick={() => setDialog({ type: "service", rec: s })} />
              </Row>
            ))}
            {shown.length === 0 && <p className="px-4 py-10 text-center text-[14px] text-[color:var(--ink-soft)]">No services {q ? "match your search" : "here yet"}.</p>}
          </ListBox>
        </div>
      </div>

      {dialog?.type === "group" && (
        <FormDialog key={dialog.rec?.id ?? "new-group"} title={dialog.rec ? "Edit service group" : "Add service group"} subtitle="Groups organise the catalog (up to 3 levels) and map services to a billing category."
          endpoint="/setup/service_group" id={dialog.rec?.id} submitLabel={dialog.rec ? "Save changes" : "Add group"} deleteLabel="Delete group"
          initial={dialog.rec ? { code: dialog.rec.code, name: dialog.rec.name, parentId: dialog.rec.data.parentId == null ? "" : String(dialog.rec.data.parentId), billingCategory: dialog.rec.data.billingCategory, active: dialog.rec.active } : { billingCategory: "Other", active: true }}
          rows={[[{ key: "code", label: "Code", mono: true, upper: true }], [{ key: "name", label: "Name" }],
            [{ key: "parentId", label: "Parent group", type: "select", options: [{ value: "", label: "None (top level)" }, ...groups.items.filter((g) => g.id !== dialog.rec?.id && g.data.parentId == null).map((g) => ({ value: String(g.id), label: g.name }))] }],
            [{ key: "billingCategory", label: "Billing category", type: "select", options: opt(BILLING_CATEGORIES) }], [{ key: "active", label: "Active", type: "toggle" }]]}
          onClose={() => { setDialog(null); groups.reload(); services.reload(); }} />
      )}
      {dialog?.type === "service" && (
        <FormDialog key={dialog.rec?.id ?? "new-service"} width={500} title={dialog.rec ? "Edit service" : "Add service"} subtitle="Services drive billing line items; rate plans and tax mappings build on them."
          endpoint="/setup/service" id={dialog.rec?.id} submitLabel={dialog.rec ? "Save changes" : "Add service"} deleteLabel="Delete service"
          initial={dialog.rec
            ? { name: dialog.rec.name, code: dialog.rec.code, active: dialog.rec.active, shortName: dialog.rec.data.shortName, groupId: dialog.rec.data.groupId == null ? "" : String(dialog.rec.data.groupId), cghsCode: dialog.rec.data.cghsCode, socCode: dialog.rec.data.socCode, price: dialog.rec.data.price, unit: dialog.rec.data.unit, gstApplies: dialog.rec.data.gstApplies === true, hsnSac: dialog.rec.data.hsnSac, collectionCenterId: dialog.rec.data.collectionCenterId == null ? "" : String(dialog.rec.data.collectionCenterId), wardClassId: dialog.rec.data.wardClassId == null ? "" : String(dialog.rec.data.wardClassId) }
            : { active: true, groupId: groupId === null ? "" : String(groupId), unit: "per session" }}
          rows={[[{ key: "name", label: "Name" }],
            [{ key: "shortName", label: "Short name", placeholder: "CBC" }, { key: "groupId", label: "Group", type: "select", options: [{ value: "", label: "None" }, ...groups.items.map((g) => ({ value: String(g.id), label: g.name }))] }],
            [{ key: "code", label: "Code", placeholder: "LAB-CBC", mono: true, upper: true }, { key: "cghsCode", label: "CGHS code" }, { key: "socCode", label: "SOC code" }],
            [{ key: "price", label: "Price (₹)", type: "number", placeholder: "500.00", mono: true }, { key: "unit", label: "Unit", placeholder: "per session" }],
            [{ key: "gstApplies", label: "GST applies", type: "toggle" }, { key: "hsnSac", label: "HSN/SAC", placeholder: "9993" }],
            [{ key: "collectionCenterId", label: "Collection center", type: "select", options: [{ value: "", label: "None" }, ...centers.items.map((c) => ({ value: String(c.id), label: c.name }))] },
              { key: "wardClassId", label: "Bed charge for ward class", type: "select", options: [{ value: "", label: "Not a bed charge" }, ...wardClasses.items.map((c) => ({ value: String(c.id), label: c.name }))] }],
            [{ key: "active", label: "Active", type: "toggle" }]]}
          onClose={() => { setDialog(null); services.reload(); }} />
      )}
      {importing && <ImportDialog onClose={() => { setImporting(false); services.reload(); }} />}
    </div>
  );
}

const IMPORT_COLUMNS: Record<string, string> = {
  name: "name", service: "name", "service name": "name", code: "code", "service code": "code", group: "group", "service group": "group", price: "price", rate: "price", "price (₹)": "price", unit: "unit",
  "short name": "shortName", shortname: "shortName", "hsn/sac": "hsnSac", hsn: "hsnSac", sac: "hsnSac", "cghs code": "cghsCode", "soc code": "socCode",
};

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const { run, loading, error, reset } = useMutation();
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; updated: number; failed: { row: number; message: string }[] } | null>(null);

  async function choose(f: File | undefined) {
    setParseError(null); setResult(null); reset();
    if (!f) return;
    const table = parseCsv(await f.text());
    if (table.length < 2) { setParseError("The file needs a header row and at least one service."); setRows(null); return; }
    const headers = table[0].map((h) => IMPORT_COLUMNS[h.trim().toLowerCase()] ?? "");
    if (!headers.includes("name")) { setParseError("The header row needs a Name column (and usually Code, Group, Price)."); setRows(null); return; }
    setFileName(f.name);
    setRows(table.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()]).filter(([h]) => h))));
  }
  async function go() {
    if (!rows) return;
    reset();
    try { setResult(await run(() => api.post<NonNullable<typeof result>>("/setup/service/import", { rows }))); } catch { /* shown below */ }
  }
  return (
    <Modal open onClose={onClose} width={520} title="Import services from CSV" subtitle="Rows with a code that already exists update that service; the rest are added."
      footer={result ? <DialogButtons onCancel={onClose} onConfirm={onClose} label="Done" /> : <DialogButtons onCancel={onClose} onConfirm={go} label={rows ? `Import ${rows.length} ${rows.length === 1 ? "row" : "rows"}` : "Import"} busyLabel="Importing…" loading={loading} disabled={!rows} />}>
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-[color:var(--ink-soft)]">Columns: <span className="font-mono">Name, Code, Group, Price, Unit, Short name, HSN/SAC</span> (Name is required; Group is matched by name or code).</p>
        <input ref={file} type="file" accept=".csv,text/csv" onChange={(e) => choose(e.target.files?.[0])} className="text-[13px]" aria-label="CSV file" />
        {rows && !result && <p className="text-[13px] text-[color:var(--ink)]">{fileName}: {rows.length} {rows.length === 1 ? "row" : "rows"} ready.</p>}
        {result && (
          <div role="status" className="rounded-[8px] bg-[color:var(--subtle)] px-3 py-3 text-[14px]">
            <p>{result.created} added, {result.updated} updated{result.failed.length ? `, ${result.failed.length} skipped` : ""}.</p>
            {result.failed.length > 0 && <ul className="mt-2 list-disc pl-5 text-[13px] text-[#8a3b00]">{result.failed.slice(0, 8).map((f) => <li key={f.row}>Row {f.row}: {f.message}</li>)}</ul>}
          </div>
        )}
        <ErrorNote message={parseError ?? error?.message} />
      </div>
    </Modal>
  );
}

// ── Tax & GST ────────────────────────────────────────────────────────────────

const GST_RATES = ["5", "12", "18", "28"];

export function TaxView() {
  const { items, reload } = useSetup("service");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Rec | null>(null);
  const q = query.trim().toLowerCase();
  const shown = items.filter((s) => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  return (
    <div>
      <ListHeader title="Service GST mappings" count={items.length}><SearchBox value={query} onChange={setQuery} placeholder="Search a service to map..." /></ListHeader>
      <ListBox>
        {shown.map((s) => (
          <Row key={s.id}>
            <span className="w-[96px] shrink-0"><Code>{s.code}</Code></span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[color:var(--ink)]">{s.name}</span>
            {s.data.gstApplies === true ? <Pill tone="plain">GST {num(s.data.gstRate)}%</Pill> : <Pill tone="green">Exempt</Pill>}
            <span className="w-[120px] shrink-0 text-right font-mono text-[12px] text-[color:var(--ink-soft)]">{str(s.data.taxFrom) ? `${str(s.data.taxFrom)} →` : ""}</span>
            <EditIcon label={`Map GST for ${s.name}`} onClick={() => setEditing(s)} />
          </Row>
        ))}
        {shown.length === 0 && <p className="px-4 py-10 text-center text-[14px] text-[color:var(--ink-soft)]">No services match.</p>}
      </ListBox>
      {editing && (
        <FormDialog key={editing.id} title="GST mapping" subtitle={`${editing.code} · ${editing.name}`} endpoint="/setup/service" id={editing.id} submitLabel="Save mapping"
          initial={{ gstApplies: editing.data.gstApplies === true, gstRate: editing.data.gstApplies === true ? String(num(editing.data.gstRate)) : "18", hsnSac: editing.data.hsnSac, taxFrom: editing.data.taxFrom }}
          rows={[[{ key: "gstApplies", label: "GST applies", type: "toggle", hint: "Off means the service is exempt." }],
            [{ key: "gstRate", label: "GST rate (%)", type: "select", options: [...GST_RATES.map((r) => ({ value: r, label: `${r}%` }))], showIf: (v) => v.gstApplies === true }],
            [{ key: "hsnSac", label: "HSN/SAC code", placeholder: "9993" }], [{ key: "taxFrom", label: "Effective from", type: "date" }]]}
          prepare={(v) => ({ ...v, gstRate: v.gstApplies === true ? Number(v.gstRate || 0) : 0 })}
          onClose={() => { setEditing(null); reload(); }} />
      )}
    </div>
  );
}
