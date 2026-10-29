"use client";

/** Theatres: add one, rename it, change its kind, switch it off (it then drops out of the Book dialog), delete an unused one. */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import type { OtCategory, OtRoomDTO } from "@/types/api";
import { btn } from "@/components/ot/shared";

const KINDS: OtCategory[] = ["Major", "Minor", "Daycare"];

export function RoomsDialog({ open, onClose, canWrite }: { open: boolean; onClose: () => void; canWrite: boolean }) {
  const { items: rooms, reload } = useList<OtRoomDTO>("/ot/rooms");
  const { run, loading, error, reset } = useMutation();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<OtCategory>("Major");
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);

  async function act(fn: () => Promise<unknown>): Promise<boolean> {
    reset();
    try { await run(fn); } catch { return false; }
    reload();
    return true;
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Theatres" subtitle="A theatre that is switched off can't be booked; one with surgeries on record can't be deleted." width={560}>
      <div className="flex flex-col gap-4">
        <ul className="rounded-[10px] border border-[color:var(--line)] overflow-hidden">
          {rooms.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-b border-[color:var(--line)] last:border-b-0 px-4 py-[10px]">
              <div className="min-w-0 flex-1">
                {editing?.id === r.id ? (
                  <input autoFocus value={editing.name} onChange={(e) => setEditing({ id: r.id, name: e.target.value })}
                    onKeyDown={async (e) => { if (e.key === "Enter" && (await act(() => api.patch(`/ot/rooms/${r.id}`, { name: editing.name.trim() })))) setEditing(null); if (e.key === "Escape") setEditing(null); }}
                    onBlur={() => setEditing(null)} aria-label={`Rename ${r.name}`}
                    className="h-[30px] w-full rounded-[6px] border border-[color:var(--brand)] bg-[color:var(--surface)] px-2 text-[14px] text-[color:var(--ink)] focus:outline-none" />
                ) : (
                  <button type="button" disabled={!canWrite} onClick={() => setEditing({ id: r.id, name: r.name })} title={canWrite ? "Click to rename" : undefined}
                    className={`text-left text-[14px] font-medium ${r.active ? "text-[color:var(--ink)]" : "text-[color:var(--ink-soft)] line-through"} ${canWrite ? "cursor-text hover:underline" : ""}`}>{r.name}</button>
                )}
                <p className="text-[12px] text-[color:var(--ink-soft)]">{r.bookings} {r.bookings === 1 ? "surgery" : "surgeries"} on record</p>
              </div>
              {canWrite ? (
                <>
                  <select value={r.kind} onChange={(e) => act(() => api.patch(`/ot/rooms/${r.id}`, { kind: e.target.value }))} aria-label={`Kind of ${r.name}`}
                    className="h-[30px] rounded-[6px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 text-[13px] text-[color:var(--ink)] cursor-pointer">
                    {KINDS.map((k) => <option key={k}>{k}</option>)}
                  </select>
                  <button type="button" role="switch" aria-checked={r.active} aria-label={`${r.name} in use`} onClick={() => act(() => api.patch(`/ot/rooms/${r.id}`, { active: !r.active }))}
                    className={`relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors cursor-pointer ${r.active ? "bg-[color:var(--brand)]" : "bg-[color:var(--subtle-2)]"}`}>
                    <span className={`absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${r.active ? "translate-x-[18px]" : ""}`} />
                  </button>
                  <button type="button" aria-label={`Delete ${r.name}`} onClick={() => act(() => api.del(`/ot/rooms/${r.id}`))} className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--ink-soft)] hover:bg-[#ffe9e9] hover:text-[#c8001a] cursor-pointer"><Trash2 size={14} /></button>
                </>
              ) : <span className="text-[12px] text-[color:var(--ink-soft)]">{r.kind}{r.active ? "" : " · off"}</span>}
            </li>
          ))}
          {rooms.length === 0 && <li className="px-4 py-8 text-center text-[14px] text-[color:var(--ink-soft)]">No theatres yet.</li>}
        </ul>

        {canWrite && (
          <div className="flex items-center gap-2">
            <div className="flex-1"><FormInput placeholder="New theatre, e.g. Major OT-4" value={name} onChange={setName} /></div>
            <div className="w-[130px]"><FormSelect value={kind} onChange={(v) => setKind(v as OtCategory)} options={KINDS.map((k) => ({ value: k, label: k }))} /></div>
            <button disabled={loading || name.trim().length < 2} onClick={async () => { if (await act(() => api.post("/ot/rooms", { name: name.trim(), kind }))) setName(""); }} className={`${btn.base} ${btn.solid} !h-[42px]`}><Plus size={14} /> Add</button>
          </div>
        )}
        {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
      </div>
    </Modal>
  );
}
