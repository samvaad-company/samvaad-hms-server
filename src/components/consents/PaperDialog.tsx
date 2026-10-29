"use client";

/**
 * "Signed on paper": the printed form was signed by hand. Record who signed (and their relation), the witness, the date,
 * and attach the scan or a photo of the signed page — it is filed under the patient's Consent & Undertakings.
 */
import { useRef, useState } from "react";
import { Camera, Paperclip, X } from "lucide-react";
import { useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import { CONSENT_LANGUAGES, RELATIONS, SIGN_STRINGS, type ConsentLanguage } from "@/types/consent-catalog";
import type { ConsentDTO } from "@/types/api";
import { attempt, DialogButtons, ErrorNote, fieldLabel, outlineBtn, todayLocal } from "@/components/mrd/shared";

export function PaperDialog({ consent, onClose, onDone }: { consent: ConsentDTO; onClose: () => void; onDone: () => void }) {
  const { run, loading, error, reset } = useMutation();
  const [name, setName] = useState(consent.patientName);
  const [relation, setRelation] = useState<string>("Self");
  const [witness, setWitness] = useState("");
  const [signedOn, setSignedOn] = useState(todayLocal());
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const lang = (CONSENT_LANGUAGES as readonly string[]).includes(consent.language) ? (consent.language as ConsentLanguage) : "English";
  const close = () => { reset(); onClose(); };

  async function submit() {
    const form = new FormData();
    form.set("name", name.trim()); form.set("relation", relation); form.set("witness", witness.trim()); form.set("signedOn", signedOn);
    if (file) form.set("file", file);
    const ok = await attempt(run(async () => {
      const res = await fetch(`/api/consents/${consent.id}/paper`, { method: "POST", body: form, credentials: "same-origin" });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message ?? "Couldn't record the signature");
    }));
    if (ok) { onDone(); close(); }
  }

  return (
    <Modal open onClose={close} width={500} title="Signed on paper" subtitle={`${consent.formTitle} for ${consent.patientName}`}
      footer={<DialogButtons onCancel={close} onConfirm={submit} label="Record signature" loading={loading} disabled={name.trim().length < 2 || !signedOn} />}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Who signed?</span><FormInput value={name} onChange={setName} /></div>
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Relation to the patient</span>
            <FormSelect value={relation} onChange={setRelation} options={RELATIONS.map((r) => ({ value: r, label: SIGN_STRINGS[lang].relation[r] === r ? r : `${r} · ${SIGN_STRINGS[lang].relation[r]}` }))} />
          </div>
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Witness (optional)</span><FormInput value={witness} onChange={setWitness} /></div>
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Signed on</span><FormInput type="date" value={signedOn} onChange={setSignedOn} max={todayLocal()} /></div>
        </div>
        <div className="flex flex-col gap-2">
          <span className={fieldLabel}>Scanned copy <span className="font-normal text-[color:var(--ink-soft)]">(recommended)</span></span>
          <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp,image/heic" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          {file ? (
            <div className="flex items-center justify-between gap-2 rounded-[8px] bg-[color:var(--subtle)] px-3 py-2 text-[14px]"><span className="truncate">{file.name}</span><button onClick={() => setFile(null)} aria-label="Remove the file" className="text-[color:var(--ink-soft)] hover:text-[#c8001a] cursor-pointer"><X size={15} /></button></div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => fileRef.current?.click()} className={outlineBtn + " !h-[40px] flex-1"}><Paperclip size={14} /> Choose a file</button>
              <button onClick={() => cameraRef.current?.click()} className={outlineBtn + " !h-[40px] flex-1"}><Camera size={14} /> Take photo</button>
            </div>
          )}
        </div>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}
