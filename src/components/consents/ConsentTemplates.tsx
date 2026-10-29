"use client";

/**
 * Consent templates: the forms every patient's consent is made from. The built-in forms are read-only (Duplicate one to
 * start from its wording); the hospital's own can be written, edited, switched off or deleted. Each language is optional
 * except English, and a patient is only offered the languages a form has. `{{patient_name}}`, `{{age}}` and `{{date}}`
 * are filled in when a consent is made; a consent keeps the wording it was made with if the template changes later.
 */
import { useRef, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormInput } from "@/components/shared/FormRow";
import { CONSENT_LANGUAGES, LANGUAGE_NAME, LANGUAGE_TAG, type ConsentLanguage } from "@/types/consent-catalog";
import type { ConsentTemplateDTO } from "@/types/api";
import { attempt, DialogButtons, Empty, ErrorNote, fieldLabel, outlineBtn, primaryBtn } from "@/components/mrd/shared";

const PLACEHOLDERS = [
  { token: "{{patient_name}}", hint: "the patient's name" },
  { token: "{{age}}", hint: "their age" },
  { token: "{{date}}", hint: "the date it is made" },
];

type Draft = { titles: Record<string, string>; bodies: Record<string, string>; active: boolean };
const blank = (): Draft => ({ titles: {}, bodies: {}, active: true });

function Editor({ template, seed, onClose }: { template: ConsentTemplateDTO | null; seed: Draft | null; onClose: () => void }) {
  const { run, loading, error, reset } = useMutation();
  const [d, setD] = useState<Draft>(() => seed ?? (template ? { titles: { ...template.titles }, bodies: { ...template.bodies }, active: template.active } : blank()));
  const focused = useRef<ConsentLanguage>("English");
  const areas = useRef<Partial<Record<ConsentLanguage, HTMLTextAreaElement | null>>>({});
  const close = () => { reset(); onClose(); };

  const setTitle = (l: ConsentLanguage, v: string) => setD((x) => ({ ...x, titles: { ...x.titles, [l]: v } }));
  const setBody = (l: ConsentLanguage, v: string) => setD((x) => ({ ...x, bodies: { ...x.bodies, [l]: v } }));
  /** Put a placeholder where the cursor is in the text box last used. */
  function insert(token: string) {
    const l = focused.current;
    const el = areas.current[l];
    const cur = d.bodies[l] ?? "";
    const at = el?.selectionStart ?? cur.length;
    setBody(l, cur.slice(0, at) + token + cur.slice(el?.selectionEnd ?? at));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + token.length, at + token.length); });
  }

  async function save() {
    const body = { titles: d.titles, bodies: d.bodies, active: d.active };
    if (await attempt(run(() => (template ? api.patch(`/consents/templates/${template.id}`, body) : api.post("/consents/templates", body))))) close();
  }
  const ready = (d.titles.English ?? "").trim().length >= 3 && (d.bodies.English ?? "").trim().length >= 20;

  return (
    <Modal open onClose={close} width={760} title={template ? "Edit template" : "New consent template"}
      subtitle="Write it once; use it for any patient. English is required — add Hindi and Gujarati so patients can read it in their own language."
      footer={<DialogButtons onCancel={close} onConfirm={save} label={template ? "Save changes" : "Create template"} loading={loading} disabled={!ready} />}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-[color:var(--subtle)] px-3 py-2 text-[13px] text-[color:var(--ink-soft)]">
          <span>Fill in automatically:</span>
          {PLACEHOLDERS.map((p) => (
            <button key={p.token} onClick={() => insert(p.token)} title={`Insert ${p.hint}`} className="rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-2 py-[1px] font-mono text-[12px] text-[color:var(--ink)] hover:bg-[color:var(--brand-soft)] cursor-pointer">{p.token}</button>
          ))}
        </div>
        {CONSENT_LANGUAGES.map((l) => (
          <section key={l} className="flex flex-col gap-2">
            <h3 className="text-[14px] font-semibold text-[color:var(--ink)]">{LANGUAGE_NAME[l]}{l === "English" ? " *" : <span className="font-normal text-[color:var(--ink-soft)]"> (optional)</span>}</h3>
            <div className="flex flex-col gap-1"><span className={fieldLabel}>Title</span><FormInput value={d.titles[l] ?? ""} onChange={(v) => setTitle(l, v)} /></div>
            <div className="flex flex-col gap-1"><span className={fieldLabel}>Text the patient reads</span>
              <textarea ref={(el) => { areas.current[l] = el; }} value={d.bodies[l] ?? ""} onChange={(e) => setBody(l, e.target.value)} onFocus={() => { focused.current = l; }} rows={5} maxLength={4000} lang={LANGUAGE_TAG[l]}
                className="w-full resize-y rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] px-[14px] py-[10px] text-[14px] leading-[22px] text-[color:var(--ink)] focus:border-[color:var(--brand)] focus:bg-[color:var(--surface)] focus:outline-none" />
            </div>
          </section>
        ))}
        <label className="flex items-center gap-2 text-[14px] cursor-pointer"><input type="checkbox" checked={d.active} onChange={(e) => setD((x) => ({ ...x, active: e.target.checked }))} className="h-4 w-4 accent-[color:var(--brand)]" /> Active — offered when making a consent</label>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function ConsentTemplates({ canWrite }: { canWrite: boolean }) {
  const { items, loading } = useList<ConsentTemplateDTO>("/consents/templates");
  const { run, error, reset } = useMutation();
  const [editing, setEditing] = useState<{ template: ConsentTemplateDTO | null; seed: Draft | null } | null>(null);
  const [deleting, setDeleting] = useState<ConsentTemplateDTO | null>(null);

  const duplicate = (t: ConsentTemplateDTO) => setEditing({ template: null, seed: { titles: { ...t.titles, English: `${t.titles.English} (copy)` }, bodies: { ...t.bodies }, active: true } });
  async function toggle(t: ConsentTemplateDTO) { reset(); await attempt(run(() => api.patch(`/consents/templates/${t.id}`, { active: !t.active }))); }
  async function remove() {
    if (!deleting) return;
    reset();
    if (await attempt(run(() => api.del(`/consents/templates/${deleting.id}`)))) setDeleting(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--line)] px-5 py-3">
        <p className="min-w-0 flex-1 text-[13px] text-[color:var(--ink-soft)]">The forms a consent is made from. Your own templates appear next to the built-in ones when you make a consent for any patient.</p>
        {canWrite && <button onClick={() => setEditing({ template: null, seed: null })} className={primaryBtn}><Plus size={15} /> New template</button>}
      </div>
      <div className="px-5 pt-3"><ErrorNote message={error?.message} /></div>
      <ul className="divide-y divide-[color:var(--line)]">
        {items.map((t) => (
          <li key={t.key} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-[color:var(--ink)]">{t.titles.English}
                <span className={`ml-2 rounded-full px-2 py-[1px] align-middle text-[11px] font-normal ${t.builtIn ? "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]" : "bg-[color:var(--brand-soft)] text-[color:var(--brand)]"}`}>{t.builtIn ? "Built in" : "Your template"}</span>
                {!t.active && <span className="ml-2 rounded-full bg-[#fff2d6] px-2 py-[1px] align-middle text-[11px] font-normal text-[#8a5300]">Switched off</span>}
              </p>
              <p className="mt-[2px] line-clamp-1 text-[13px] text-[color:var(--ink-soft)]">{t.bodies.English}</p>
              <p className="mt-1 text-[12px] text-[color:var(--ink-soft)]">{CONSENT_LANGUAGES.filter((l) => t.languages.includes(l)).map((l) => LANGUAGE_NAME[l]).join(" · ")}</p>
            </div>
            {canWrite && (
              <div className="flex items-center gap-2">
                <button onClick={() => duplicate(t)} className={outlineBtn} title="Start a new template from this wording"><Copy size={14} /> Duplicate</button>
                {!t.builtIn && <button onClick={() => setEditing({ template: t, seed: null })} className={outlineBtn}>Edit</button>}
                {!t.builtIn && <button onClick={() => toggle(t)} className={outlineBtn}>{t.active ? "Switch off" : "Switch on"}</button>}
                {!t.builtIn && <button onClick={() => { reset(); setDeleting(t); }} aria-label={`Delete ${t.titles.English}`} className="grid h-[30px] w-[30px] place-items-center rounded-[8px] text-[#c8001a] hover:bg-[#ffe9e9] cursor-pointer"><Trash2 size={15} /></button>}
              </div>
            )}
          </li>
        ))}
      </ul>
      {!loading && items.length === 0 && <Empty>No templates.</Empty>}
      {editing && <Editor key={editing.template?.key ?? "new"} template={editing.template} seed={editing.seed} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!deleting} title="Delete template" message={deleting ? `Delete “${deleting.titles.English}”? Consents already made from it keep their wording.` : ""} confirmLabel="Delete" onConfirm={remove} onCancel={() => setDeleting(null)} />
    </div>
  );
}
