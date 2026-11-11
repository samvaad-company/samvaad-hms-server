"use client";

/** Setup → Masters → Medicines: the drug directory with its printed MRP, and the price the hospital charges (which wins over the MRP). */
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import type { MedicineDTO } from "@/types/api";

const PAGE = 50;
const rupee = (n: number | null) => (n == null ? "—" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);

function PriceCell({ m, canEdit, onSaved }: { m: MedicineDTO; canEdit: boolean; onSaved: (m: MedicineDTO) => void }) {
  const [v, setV] = useState(m.masterPrice == null ? "" : String(m.masterPrice));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const dirty = v !== (m.masterPrice == null ? "" : String(m.masterPrice));
  async function save() {
    setSaving(true); setErr("");
    try { onSaved(await api.patch<MedicineDTO>(`/medicines/${m.id}`, { price: v.trim() === "" ? null : Number(v) })); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save"); } finally { setSaving(false); }
  }
  if (!canEdit) return <span>{rupee(m.price)}</span>;
  return (
    <div className="flex items-center gap-2">
      <input type="number" min={0} step="0.01" value={v} onChange={(e) => setV(e.target.value)} placeholder={m.mrp == null ? "price" : `MRP ${m.mrp}`} aria-label={`Price of ${m.name}`}
        className="h-[30px] w-[110px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 text-[13px] focus:border-[color:var(--brand)] focus:outline-none" />
      {dirty && <button type="button" onClick={() => void save()} disabled={saving} className="h-[28px] rounded-full bg-[color:var(--brand)] px-3 text-[12px] text-white disabled:opacity-50 cursor-pointer">{saving ? "…" : v.trim() === "" ? "Use MRP" : "Save"}</button>}
      {err && <span className="text-[11px] text-[#ff0004]">{err}</span>}
    </div>
  );
}

export function MedicinesView() {
  const { can } = useAuth();
  const canEdit = can("admin", "write");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<MedicineDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { const t = setTimeout(() => { setTerm(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list<MedicineDTO>("/medicines", { page, pageSize: PAGE, ...(term ? { search: term } : {}) });
      setRows(res.data); setTotal(res.meta.total);
    } finally { setLoading(false); }
  }, [page, term]);
  useEffect(() => { void load(); }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-medium text-[color:var(--ink)]">Medicines</h2>
          <p className="text-[12px] text-[color:var(--ink-soft)]">{total.toLocaleString("en-IN")} medicines. Set a price to override the printed MRP; leave it empty to charge the MRP. Billing and pharmacy use this price.</p>
        </div>
        <div className="relative w-[280px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or composition…" aria-label="Search medicines"
            className="h-[34px] w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] pl-8 pr-3 text-[13px] focus:border-[color:var(--brand)] focus:outline-none" />
        </div>
      </div>
      <div className="overflow-x-auto rounded-[12px] border border-[color:var(--line)]">
        <table className="w-full min-w-[860px] text-left text-[13px]">
          <thead className="bg-[color:var(--subtle)] text-[11px] uppercase tracking-wide text-[color:var(--ink-soft)]">
            <tr><th className="px-3 py-2">Medicine</th><th className="px-3 py-2">Composition</th><th className="px-3 py-2">Pack</th><th className="px-3 py-2">MRP</th><th className="px-3 py-2">Price charged</th></tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-t border-[color:var(--line)] align-middle">
                <td className="px-3 py-2"><span className="block text-[color:var(--ink)]">{m.name}</span><span className="block text-[11px] text-[color:var(--ink-soft)]">{m.manufacturer}</span></td>
                <td className="max-w-[240px] px-3 py-2 text-[color:var(--ink-soft)]">{m.generic}</td>
                <td className="px-3 py-2 text-[color:var(--ink-soft)]">{m.pack || m.unit}</td>
                <td className="px-3 py-2">{rupee(m.mrp)}</td>
                <td className="px-3 py-2"><PriceCell key={`${m.id}-${m.masterPrice}`} m={m} canEdit={canEdit} onSaved={(u) => setRows((r) => r.map((x) => (x.id === u.id ? u : x)))} /></td>
              </tr>
            ))}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-[color:var(--ink-soft)]">No medicines found.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-[12px] text-[color:var(--ink-soft)]">
        <span>Page {page} of {pages.toLocaleString("en-IN")}</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} className="h-[30px] rounded-full border border-[color:var(--line)] px-4 disabled:opacity-40 cursor-pointer">Previous</button>
          <button type="button" disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)} className="h-[30px] rounded-full border border-[color:var(--line)] px-4 disabled:opacity-40 cursor-pointer">Next</button>
        </div>
      </div>
    </div>
  );
}
