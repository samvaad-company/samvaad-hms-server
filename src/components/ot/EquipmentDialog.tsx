"use client";

/** Theatre equipment: add, take out of use for maintenance (with a note) and back, delete an unused item. */
import { useState } from "react";
import { Plus, Trash2, Wrench } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { FormInput } from "@/components/shared/FormRow";
import type { OtEquipmentDTO } from "@/types/api";
import { btn } from "@/components/ot/shared";

export function EquipmentDialog({ open, onClose, canWrite }: { open: boolean; onClose: () => void; canWrite: boolean }) {
  const { items, reload } = useList<OtEquipmentDTO>("/ot/equipment");
  const { run, loading, error, reset } = useMutation();
  const [name, setName] = useState("");
  const [noting, setNoting] = useState<{ id: number; note: string } | null>(null);

  async function act(fn: () => Promise<unknown>): Promise<boolean> {
    reset();
    try { await run(fn); } catch { return false; }
    reload();
    return true;
  }
  const down = items.filter((e) => e.status === "Maintenance").length;

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Equipment" subtitle={`${items.length} items${down ? ` · ${down} under maintenance` : ""}. Equipment under maintenance can't be booked.`} width={600}>
      <div className="flex flex-col gap-4">
        <ul className="rounded-[10px] border border-[color:var(--line)] overflow-hidden">
          {items.map((e) => (
            <li key={e.id} className="border-b border-[color:var(--line)] last:border-b-0 px-4 py-[10px]">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[14px] font-medium ${e.status === "Maintenance" ? "text-[color:var(--ink-soft)] line-through" : "text-[color:var(--ink)]"}`}>{e.name}</p>
                  {e.note && <p className="truncate text-[12px] text-[color:var(--ink-soft)]">{e.note}</p>}
                </div>
                <span className={`rounded-full px-3 py-[2px] text-[12px] ${e.status === "Maintenance" ? "bg-[#fff2d6] text-[#8a5300]" : "bg-[#dffff3] text-[#0b7a47]"}`}>{e.status}</span>
                {canWrite && (
                  <>
                    {e.status === "Available"
                      ? <button type="button" onClick={() => setNoting({ id: e.id, note: "" })} className={`${btn.base} ${btn.ghost} !h-[30px] !text-[12px]`}><Wrench size={12} /> Maintenance</button>
                      : <button type="button" onClick={() => act(() => api.patch(`/ot/equipment/${e.id}`, { status: "Available", note: "" }))} className={`${btn.base} ${btn.ghost} !h-[30px] !text-[12px]`}>Back in use</button>}
                    <button type="button" aria-label={`Delete ${e.name}`} onClick={() => act(() => api.del(`/ot/equipment/${e.id}`))} className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--ink-soft)] hover:bg-[#ffe9e9] hover:text-[#c8001a] cursor-pointer"><Trash2 size={14} /></button>
                  </>
                )}
              </div>
              {noting?.id === e.id && (
                <div className="mt-2 flex gap-2">
                  <input autoFocus value={noting.note} onChange={(ev) => setNoting({ id: e.id, note: ev.target.value })} placeholder="Why — e.g. Under service until Friday" aria-label={`Maintenance note for ${e.name}`}
                    className="h-[32px] flex-1 rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)]" />
                  <button type="button" onClick={async () => { if (await act(() => api.patch(`/ot/equipment/${e.id}`, { status: "Maintenance", note: noting.note.trim() }))) setNoting(null); }} className={`${btn.base} ${btn.solid} !h-[32px]`}>Take out of use</button>
                  <button type="button" onClick={() => setNoting(null)} className={`${btn.base} ${btn.ghost} !h-[32px]`}>Cancel</button>
                </div>
              )}
            </li>
          ))}
          {items.length === 0 && <li className="px-4 py-8 text-center text-[14px] text-[color:var(--ink-soft)]">No equipment yet.</li>}
        </ul>
        {canWrite && (
          <div className="flex items-center gap-2">
            <div className="flex-1"><FormInput placeholder="New equipment, e.g. Laser Unit" value={name} onChange={setName} /></div>
            <button disabled={loading || name.trim().length < 2} onClick={async () => { if (await act(() => api.post("/ot/equipment", { name: name.trim() }))) setName(""); }} className={`${btn.base} ${btn.solid} !h-[42px]`}><Plus size={14} /> Add</button>
          </div>
        )}
        {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
      </div>
    </Modal>
  );
}
