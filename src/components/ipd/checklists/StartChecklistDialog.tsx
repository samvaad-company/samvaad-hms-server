"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { FormRow } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import type { IpdChecklistDTO, IpdChecklistTemplateDTO, PatientDTO } from "@/types/api";
import { done } from "@/components/ipd/nurse/shared";

/** Pick a patient and a template; the checklist opens straight away, ready to tick. */
export function StartChecklistDialog({ open, onClose, onStarted }: { open: boolean; onClose: () => void; onStarted: (c: IpdChecklistDTO) => void }) {
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { items: templates } = useList<IpdChecklistTemplateDTO>("/ipd/checklist-templates");
  const { run, loading, error, reset } = useMutation();
  const [patientId, setPatientId] = useState("");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const usable = templates.filter((t) => t.active);

  const close = () => { reset(); onClose(); };
  async function start() {
    if (templateId == null) return;
    let started: IpdChecklistDTO | null = null;
    if (!(await done(run(async () => { started = await api.post<IpdChecklistDTO>("/ipd/checklists", { templateId, patientId: Number(patientId) }); return started; })))) return;
    setPatientId(""); setTemplateId(null);
    close();
    if (started) onStarted(started);
  }

  return (
    <Modal open={open} onClose={close} title="Start a checklist" subtitle="Every tick records who and when." width={520}
      footer={<>
        <button onClick={close} className="h-[36px] px-5 rounded-[8px] text-[13px] font-medium text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer transition-colors">Cancel</button>
        <button onClick={start} disabled={loading || !patientId || templateId == null} className="h-[36px] px-5 rounded-[8px] text-[13px] font-medium text-white bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{loading ? "Starting…" : "Start"}</button>
      </>}>
      <div className="flex flex-col gap-4">
        <FormRow label="Patient" required>
          <SearchSelect placeholder="Search patient…" value={patientId} onChange={setPatientId}
            options={patients.map((p) => ({ value: String(p.id), label: p.name, hint: `${p.patientId ?? ""} · ${p.phone}` }))} />
        </FormRow>
        <FormRow label="Checklist" required>
          <div className="flex flex-col gap-2 overflow-y-auto pr-1" style={{ maxHeight: 280 }} role="radiogroup" aria-label="Checklist template">
            {usable.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={templateId === t.id} onClick={() => setTemplateId(t.id)}
                className={`text-left rounded-[10px] border px-4 py-3 cursor-pointer transition-colors ${templateId === t.id ? "border-[color:var(--brand)] border-2 bg-[color:var(--brand-soft)]" : "border-[color:var(--line)] hover:bg-[color:var(--subtle)]"}`}>
                <p className="text-[14px] font-semibold text-[color:var(--ink)]">{t.name}</p>
                <p className="text-[12px] text-[color:var(--ink-soft)]">{t.lineCount} lines · {t.scope}{t.description ? ` · ${t.description}` : ""}</p>
              </button>
            ))}
            {usable.length === 0 && <p className="text-[13px] text-[color:var(--ink-soft)]">No checklist templates yet — add one under Templates.</p>}
          </div>
        </FormRow>
        {error && <p role="alert" className="text-[12px] text-[#c8001a]">{error.message}</p>}
      </div>
    </Modal>
  );
}
