"use client";

/**
 * Setup → Masters → Manufacturers, under the list: pick a manufacturer to see the medicines in the pharmacy inventory that it makes,
 * move one to another manufacturer, or bring in a medicine that has none (or belongs to another).
 */
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { useSetup } from "@/components/setup/ui";
import { LoadingBlock, Spinner } from "@/components/shared/Spinner";
import type { PharmacyItemDTO } from "@/types/api";

interface MedicineRow { id: number; name: string; category: string; stock: number; supplier: string }

const select = "h-[32px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 text-[13px] focus:border-[color:var(--brand)] focus:outline-none";

export function ManufacturerMedicines() {
  const { can } = useAuth();
  const canEdit = can("admin", "write");
  const makers = useSetup("manufacturer");
  const [makerId, setMakerId] = useState("");
  const [rows, setRows] = useState<MedicineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<PharmacyItemDTO[]>([]);

  const load = useCallback(async () => {
    if (!makerId) { setRows([]); return; }
    setLoading(true);
    try { setRows(await api.get<MedicineRow[]>(`/pharmacy/manufacturers/${makerId}/medicines`)); setError(""); }
    catch (e) { setRows([]); setError(e instanceof Error ? e.message : "Couldn't load the medicines."); }
    finally { setLoading(false); }
  }, [makerId]);
  useEffect(() => { void load(); }, [load]);
  // A manufacturer that was deleted or renamed in the list above.
  useEffect(() => { if (makerId && !makers.items.some((m) => String(m.id) === makerId)) setMakerId(""); }, [makers.items, makerId]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setFound([]); return; }
    const t = setTimeout(() => {
      api.list<PharmacyItemDTO>("/pharmacy", { search: term, pageSize: 8 }).then((r) => setFound(r.data)).catch(() => setFound([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function move(itemId: number, to: string) {
    setError("");
    try {
      await api.patch(`/pharmacy/${itemId}/manufacturer`, { manufacturerId: to === "" ? null : Number(to) });
      setQ(""); setFound([]);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't change the manufacturer."); }
  }

  const current = makers.items.find((m) => String(m.id) === makerId);
  return (
    <section className="mt-8 rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5" aria-label="Medicines by manufacturer">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <h3 className="text-[14px] font-semibold text-[color:var(--ink)]">Medicines by manufacturer</h3>
          <p className="text-[12px] text-[color:var(--ink-soft)]">Choose a manufacturer to see its medicines, and change which manufacturer a medicine belongs to.</p>
        </div>
        <select value={makerId} onChange={(e) => setMakerId(e.target.value)} className={`${select} min-w-[220px]`} aria-label="Manufacturer">
          <option value="">Choose a manufacturer…</option>
          {makers.items.filter((m) => m.active).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {!makerId ? <p className="py-6 text-center text-[13px] text-[color:var(--ink-soft)]">Choose a manufacturer above.</p> : loading && rows.length === 0 ? <LoadingBlock label="Loading medicines…" /> : (
        <>
          {canEdit && (
            <div className="relative mb-3 max-w-[420px]">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Add a medicine to ${current?.name ?? "this manufacturer"}…`} aria-label="Search medicines to add"
                className="h-[34px] w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] pl-8 pr-3 text-[13px] focus:border-[color:var(--brand)] focus:outline-none" />
              {found.length > 0 && (
                <div className="absolute left-0 right-0 top-[36px] z-20 max-h-[240px] overflow-auto rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] shadow-md">
                  {found.map((m) => (
                    <button key={m.id} type="button" onClick={() => void move(m.id, makerId)} className="block w-full px-3 py-2 text-left hover:bg-[color:var(--subtle)]">
                      <span className="block text-[13px] text-[color:var(--ink)]">{m.name}</span>
                      <span className="block text-[11px] text-[color:var(--ink-soft)]">{m.manufacturer ? `Now: ${m.manufacturer}` : "No manufacturer yet"} · {m.stock} in stock</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {error && <p role="alert" className="mb-2 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#ff0004]">{error}</p>}
          {loading && <p className="mb-2 inline-flex items-center gap-2 text-[12px] text-[color:var(--ink-soft)]" role="status"><Spinner size={12} /> Updating…</p>}
          <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
            <table data-keep-table className="w-full min-w-[560px] text-left text-[13px]">
              <thead className="bg-[color:var(--subtle)] text-[11px] uppercase tracking-wide text-[color:var(--ink-soft)]">
                <tr><th className="px-3 py-2">Medicine</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Stock</th><th className="px-3 py-2">Supplier</th>{canEdit && <th className="px-3 py-2">Manufacturer</th>}</tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[color:var(--line)]">
                    <td className="px-3 py-2 text-[color:var(--ink)]">{r.name}</td>
                    <td className="px-3 py-2 text-[color:var(--ink-soft)]">{r.category}</td>
                    <td className="px-3 py-2">{r.stock}</td>
                    <td className="px-3 py-2 text-[color:var(--ink-soft)]">{r.supplier || "—"}</td>
                    {canEdit && (
                      <td className="px-3 py-2">
                        <select value={makerId} onChange={(e) => void move(r.id, e.target.value)} className={select} aria-label={`Manufacturer of ${r.name}`}>
                          {makers.items.filter((m) => m.active || String(m.id) === makerId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                          <option value="">None</option>
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
                {!loading && rows.length === 0 && <tr><td colSpan={canEdit ? 5 : 4} className="px-3 py-8 text-center text-[color:var(--ink-soft)]">No medicines under this manufacturer yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
