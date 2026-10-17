"use client";

/** Diet: each patient's diet instruction, editable in place, beside the latest diet note from their chart. */
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { btn, Empty, inputCls, PatientCell, type WardPatient, done } from "@/components/ipd/nurse/shared";

interface DietRow {
  admissionId: number;
  diet: string;
  note: { content: string; at: string; author: string } | null;
}

function Row({ p, row, canWrite, onSaved }: { p: WardPatient; row: DietRow | undefined; canWrite: boolean; onSaved: () => void }) {
  const saved = row?.diet ?? p.adm.diet ?? "";
  const [text, setText] = useState<string | null>(null);
  const value = text ?? saved;
  const { run, loading, error } = useMutation();
  async function save() {
    if (!(await done(run(() => api.patch(`/ipd/${p.adm.id}`, { diet: value.trim() }))))) return;
    setText(null);
    onSaved();
  }
  return (
    <div className="flex items-start gap-4 px-4 py-[10px] border-b border-[color:var(--line)] last:border-b-0 bg-[color:var(--surface)]">
      <div className="w-[220px] shrink-0"><PatientCell adm={p.adm} /></div>
      <div className="flex-1 min-w-0">
        {canWrite ? (
          <div className="flex gap-2">
            <input value={value} onChange={(e) => setText(e.target.value)} placeholder="No diet instruction yet — e.g. Soft diet, low salt" aria-label={`Diet for ${p.adm.patientName}`} className={inputCls} />
            <button onClick={save} disabled={loading || value.trim() === saved.trim()} className={`${btn.base} ${btn.solid}`}>{loading ? "Saving…" : "Save"}</button>
          </div>
        ) : <p className="text-[13px] text-[color:var(--ink)]">{saved || "—"}</p>}
        {error && <p role="alert" className="mt-1 text-[12px] text-[#c8001a]">{error.message}</p>}
      </div>
      <p className="w-[260px] shrink-0 text-[12px] text-[color:var(--ink-soft)] leading-[17px]">
        {row?.note ? <>“{row.note.content}” <span className="block text-[11px]">{row.note.author} · {row.note.at}</span></> : "No diet note on the chart"}
      </p>
    </div>
  );
}

export function DietTab({ patients, canWrite }: { patients: WardPatient[]; canWrite: boolean }) {
  const { items, reload } = useList<DietRow>("/ipd/nurse/diet");
  const byId = new Map(items.map((d) => [d.admissionId, d]));
  return (
    <div className="p-5">
      {patients.length === 0 ? <Empty>No patients in this view.</Empty> : (
        <div className="rounded-[10px] border border-[color:var(--line)] overflow-hidden">
          {patients.map((p) => <Row key={`${p.adm.id}:${byId.get(p.adm.id)?.diet ?? ""}`} p={p} row={byId.get(p.adm.id)} canWrite={canWrite} onSaved={reload} />)}
        </div>
      )}
    </div>
  );
}
