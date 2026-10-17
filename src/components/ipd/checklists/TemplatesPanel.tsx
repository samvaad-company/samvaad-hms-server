"use client";

/**
 * Checklist templates. Each is edited as plain lines: end a line with * to make it required, start one with ">"
 * to make it a sub-line of the line above. Changing a template never alters a checklist already started.
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { useRowActions } from "@/lib/api/useRowActions";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormRow, FormSelect, FormTextarea } from "@/components/shared/FormRow";
import { RowMenu } from "@/components/shared/RowMenu";
import type { IpdChecklistTemplateDTO } from "@/types/api";
import { btn, done, Empty } from "@/components/ipd/nurse/shared";

type Template = IpdChecklistTemplateDTO & { lines: string[] };
const SCOPES = ["Inpatient (IPD)", "OPD"];
const BLANK = { name: "", scope: "Inpatient (IPD)", description: "", lines: "", active: true };

export function TemplatesPanel({ canWrite }: { canWrite: boolean }) {
  const { items, reload } = useList<Template>("/ipd/checklist-templates");
  const { dialog, remove, mutate } = useRowActions("ipd/checklist-templates", reload);
  const { run, loading, error, reset } = useMutation();
  const [editing, setEditing] = useState<{ id: number | null; form: typeof BLANK } | null>(null);

  function openNew() { reset(); setEditing({ id: null, form: BLANK }); }
  function openEdit(t: Template) { reset(); setEditing({ id: t.id, form: { name: t.name, scope: t.scope, description: t.description, lines: t.lines.join("\n"), active: t.active } }); }
  const set = <K extends keyof typeof BLANK>(k: K, v: (typeof BLANK)[K]) => setEditing((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e));

  async function save() {
    if (!editing) return;
    const f = editing.form;
    const body = { name: f.name.trim(), scope: f.scope, description: f.description.trim(), active: f.active, lines: f.lines.split("\n") };
    if (!(await done(run(() => (editing.id == null ? api.post("/ipd/checklist-templates", body) : api.put(`/ipd/checklist-templates/${editing.id}`, body)))))) return;
    setEditing(null);
    reload();
  }

  return (
    <div className="p-5">
      {dialog}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-[color:var(--ink-soft)]">{items.length} templates</p>
        {canWrite && <button onClick={openNew} className={`${btn.base} ${btn.solid}`}><Plus size={13} /> New template</button>}
      </div>
      {items.length === 0 ? <Empty>No templates yet.</Empty> : (
        <div className="rounded-[10px] border border-[color:var(--line)] overflow-hidden">
          {items.map((t) => (
            <div key={t.id} className="flex items-center gap-4 px-4 py-3 border-b border-[color:var(--line)] last:border-b-0 bg-[color:var(--surface)]">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[color:var(--ink)]">{t.name}</p>
                <p className="text-[12px] text-[color:var(--ink-soft)]">{t.lineCount} lines · {t.scope}{t.description ? ` · ${t.description}` : ""}</p>
              </div>
              {!t.active && <span className="rounded-full border border-[color:var(--line)] px-2 text-[11px] text-[color:var(--ink-soft)]">Off</span>}
              {canWrite && (
                <RowMenu compact actions={[
                  { label: "Edit", onClick: () => openEdit(t) },
                  { label: t.active ? "Switch off" : "Switch on", onClick: () => mutate(() => api.put(`/ipd/checklist-templates/${t.id}`, { name: t.name, scope: t.scope, description: t.description, active: !t.active })) },
                  { label: "Delete", danger: true, onClick: () => remove(t.id, t.name) },
                ]} />
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id == null ? "New template" : "Edit template"} width={560}
        footer={<>
          <button onClick={() => setEditing(null)} className="text-[13px] text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
          <button onClick={save} disabled={loading || !editing || editing.form.name.trim().length < 2 || !editing.form.lines.trim()} className="text-[13px] text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">{loading ? "Saving…" : "Save"}</button>
        </>}>
        {editing && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormRow label="Name" required><FormInput value={editing.form.name} onChange={(v) => set("name", v)} placeholder="e.g. Falls risk check" /></FormRow>
              <FormRow label="Used in"><FormSelect value={editing.form.scope} onChange={(v) => set("scope", v)} options={SCOPES.map((s) => ({ value: s, label: s }))} /></FormRow>
            </div>
            <FormRow label="Description"><FormInput value={editing.form.description} onChange={(v) => set("description", v)} placeholder="When is it used?" /></FormRow>
            <FormRow label="Lines" required hint="One line each. End with * for required. Start with > for a sub-line of the line above.">
              <FormTextarea rows={9} value={editing.form.lines} onChange={(v) => set("lines", v)} placeholder={"Identity band checked*\nConsents signed*\n> Surgery consent\n> Anaesthesia consent\nSite marked"} />
            </FormRow>
            <label className="flex items-center gap-2 text-[13px] text-[color:var(--ink)] cursor-pointer">
              <input type="checkbox" checked={editing.form.active} onChange={(e) => set("active", e.target.checked)} /> Available to start
            </label>
            {error && <p role="alert" className="text-[12px] text-[#c8001a]">{error.message}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
