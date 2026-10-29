"use client";

/** File tracking → Locations. The named homes a file can live in: racks, archive rooms, nurse stations, cabins. */
import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import { MRD_LOCATION_KINDS, type MrdLocationDTO } from "@/types/api";
import { attempt, DialogButtons, Empty, ErrorNote, fieldLabel, mono, primaryBtn, td, th } from "@/components/mrd/shared";

function LocationDialog({ open, location, onClose }: { open: boolean; location: MrdLocationDTO | null; onClose: () => void }) {
  const { run, loading, error, reset } = useMutation();
  const [name, setName] = useState(location?.name ?? "");
  const [kind, setKind] = useState<string>(location?.kind ?? "MRD rack");
  const [code, setCode] = useState(location?.code ?? "");
  const [active, setActive] = useState(location?.active ?? true);
  const close = () => { reset(); onClose(); };
  async function submit() {
    const body = { name: name.trim(), kind, code: code.trim(), ...(location ? { active } : {}) };
    const ok = await attempt(run(() => (location ? api.patch(`/mrd/locations/${location.id}`, body) : api.post("/mrd/locations", body))));
    if (ok) close();
  }
  return (
    <Modal open={open} onClose={close} width={420} title={location ? "Edit location" : "Add location"} subtitle="Named homes a file can live, for the board + pickers."
      footer={<DialogButtons onCancel={close} onConfirm={submit} label={location ? "Save" : "Add"} loading={loading} disabled={name.trim().length < 2} />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Name</span><FormInput value={name} onChange={setName} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Type</span><FormSelect value={kind} onChange={setKind} options={MRD_LOCATION_KINDS.map((k) => ({ value: k, label: k }))} /></div>
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Code (optional)</span><FormInput value={code} onChange={setCode} /></div>
        </div>
        {location && (
          <label className="flex items-center gap-2 text-[14px] text-[color:var(--ink)] cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[color:var(--brand)]" /> Active — files can be sent here
          </label>
        )}
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function LocationsView({ canWrite }: { canWrite: boolean }) {
  const { items, loading } = useList<MrdLocationDTO>("/mrd/locations");
  const [editing, setEditing] = useState<MrdLocationDTO | "new" | null>(null);
  return (
    <div className="px-5 pb-5 pt-4">
      <div className="mb-3 flex justify-end">
        {canWrite && <button onClick={() => setEditing("new")} className={primaryBtn}><Plus size={15} /> Add location</button>}
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
        <table className="w-full min-w-[640px] text-left">
          <thead><tr className="border-b border-[color:var(--line)]">{["Name", "Type", "Code", "Active", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                <td className={td}>{l.name}</td>
                <td className={td}>{l.kind}</td>
                <td className={`${td} ${mono}`}>{l.code || "-"}</td>
                <td className={td}>{l.active ? "Yes" : "No"}</td>
                <td className={`${td} text-right`}>{canWrite && <button onClick={() => setEditing(l)} className="text-[13px] text-[color:var(--ink)] hover:underline cursor-pointer">Edit</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <Empty>No locations yet.</Empty>}
      </div>
      {editing && <LocationDialog key={editing === "new" ? "new" : editing.id} open location={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
