"use client";

/** ID formats (the mask each numbered document uses) and clinical forms (custom assessments designed here, rendered in the consultation). */
import { useState } from "react";
import { ArrowDown, ArrowUp, Trash2, Wand2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import type { DepartmentDTO } from "@/types/api";
import { FORM_FIELD_TYPES, ID_RESETS, ID_SCOPES, LIVE_ID_FORMATS, formatIdPreview, maskProblem, type ClinicalFormField } from "@/types/setup";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import { DialogButtons, ErrorNote, outlineBtn, Pill, primaryBtn, softBtn } from "@/components/mrd/shared";
import { attempt } from "@/components/hr/shared";
import { SearchBox } from "@/components/setup/CatalogViews";
import { AddButton, EditIcon, FormDialog, Labelled, ListBox, ListHeader, Muted, Row, ToggleRow, num, str, useConfig, useSetup, type Rec } from "@/components/setup/ui";

const opt = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));

// ── ID formats ───────────────────────────────────────────────────────────────

export function IdFormatsView() {
  const formats = useSetup("id_format");
  const { item: hospital } = useConfig("hospital");
  const [editing, setEditing] = useState<Rec | null>(null);
  const [query, setQuery] = useState("");
  const fyStartMonth = num(hospital?.fyStartMonth) || 4;
  const q = query.trim().toLowerCase();
  const shown = formats.items.filter((f) => !q || f.name.toLowerCase().includes(q) || str(f.data.mask).toLowerCase().includes(q));
  const sample = (f: Rec) => formatIdPreview(str(f.data.mask), { prefix: str(f.data.prefix), luhn: f.data.luhn === true, fyStartMonth, seq: 1 });
  return (
    <div>
      <ListHeader title="ID formats" count={formats.items.length}><SearchBox value={query} onChange={setQuery} placeholder="Search formats..." /></ListHeader>
      <p role="note" className="mb-3 rounded-[8px] border border-[#f3e29a] bg-[#fffbe0] px-3 py-2 text-[13px] text-[#7a5a00]">Formats marked In use number new documents right away - issued numbers keep their old format and a changed mask starts a new series. Edit with care.</p>
      <ListBox>
        {shown.map((f) => (
          <Row key={f.id}>
            <span className="w-[190px] shrink-0 truncate text-[14px] font-medium">{f.name}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[color:var(--ink-soft)]">{str(f.data.mask)}</span>
            <span className="font-mono text-[12px]">{sample(f)}</span>
            <Pill tone="plain">{str(f.data.reset)}</Pill>
            {(LIVE_ID_FORMATS as readonly string[]).includes(f.code) ? <Pill tone="green">In use</Pill> : <Muted>Not issued yet</Muted>}
            {f.data.custom === true && <Pill tone="amber">Custom</Pill>}
            <EditIcon label={`Edit ${f.name} format`} onClick={() => setEditing(f)} />
          </Row>
        ))}
        {shown.length === 0 && <p className="px-4 py-8 text-center text-[14px] text-[color:var(--ink-soft)]">No formats match.</p>}
      </ListBox>
      {editing && (
        <FormDialog key={editing.id} width={500} title={`Edit ${editing.name} format`} subtitle="Tokens: {PREFIX} {FY} {FY2} {FYE} {FYP2} {YYYY} {YY} {MM} {SEQ:n} {GENDER} {CHECK}. Already-issued numbers never change."
          endpoint="/setup/id_format" id={editing.id} submitLabel="Save format"
          initial={{ mask: editing.data.mask, prefix: editing.data.prefix, reset: editing.data.reset, scope: editing.data.scope, luhn: editing.data.luhn === true, gender: editing.data.gender === true }}
          rows={[[{ key: "mask", label: "Mask", mono: true }], [{ key: "prefix", label: "Prefix (fills {PREFIX})", upper: true }],
            [{ key: "reset", label: "Counter resets", type: "select", options: opt(ID_RESETS) }, { key: "scope", label: "Series scope", type: "select", options: opt(ID_SCOPES) }],
            [{ key: "luhn", label: "Append a Luhn check digit", type: "toggle" }], [{ key: "gender", label: "Encode gender ({GENDER} token)", type: "toggle" }]]}
          disabled={(v) => maskProblem(str(v.mask)) !== null}
          onClose={() => { setEditing(null); formats.reload(); }}>
          {(v) => {
            const problem = maskProblem(str(v.mask));
            return (
              <div className="rounded-[8px] border border-[color:var(--line)] px-[14px] py-[10px]">
                <p className="text-[12px] text-[color:var(--ink-soft)]">Preview</p>
                {problem ? <p role="alert" className="text-[13px] text-[#c8001a]">{problem}</p> : <p className="font-mono text-[15px]">{formatIdPreview(str(v.mask), { prefix: str(v.prefix), luhn: v.luhn === true, gender: v.gender === true ? "F" : undefined, fyStartMonth })}</p>}
              </div>
            );
          }}
        </FormDialog>
      )}
    </div>
  );
}

// ── Clinical forms ───────────────────────────────────────────────────────────

export function ClinicalFormsView() {
  const forms = useSetup("clinical_form");
  const specialties = useSetup("specialty");
  const [dialog, setDialog] = useState<null | { type: "new" | "assign" | "design"; rec?: Rec }>(null);
  return (
    <div>
      <ListHeader title="Clinical forms" note="Custom assessments and structured notes - designed here, rendered in the consultation."><AddButton primary label="New form" onClick={() => setDialog({ type: "new" })} /></ListHeader>
      <ListBox>
        {forms.items.map((f) => (
          <Row key={f.id}>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[14px] font-medium"><span className="truncate">{f.name}</span><Muted>v{num(f.data.version)}</Muted><Pill>{str(f.data.status)}</Pill></p>
              <p className="text-[12px] text-[color:var(--ink-soft)]">{str(f.data.specialty) || "Any specialty"} · {((f.data.fields as unknown[]) ?? []).length} fields</p>
            </div>
            <button onClick={() => setDialog({ type: "assign", rec: f })} className={outlineBtn + " !h-[32px]"}>Assign</button>
            <button onClick={() => setDialog({ type: "design", rec: f })} className={primaryBtn + " !h-[32px]"}><Wand2 size={14} /> Design</button>
          </Row>
        ))}
        {forms.items.length === 0 && <p className="px-4 py-10 text-center text-[14px] text-[color:var(--ink-soft)]">No clinical forms yet.</p>}
      </ListBox>
      {dialog?.type === "new" && (
        <FormDialog title="New clinical form" subtitle="Give the form a name; design its fields next." endpoint="/setup/clinical_form" submitLabel="Create form" initial={{}}
          rows={[[{ key: "name", label: "Form name", placeholder: "Cardiology - Hypertension Review" }], [{ key: "specialty", label: "Specialty", type: "select", options: [{ value: "", label: "Any specialty" }, ...specialties.items.map((s) => ({ value: s.name, label: s.name }))] }]]}
          onSaved={(r) => { const rec = r as Rec | null; if (rec?.id) setTimeout(() => setDialog({ type: "design", rec }), 0); }} onClose={() => { setDialog((d) => (d?.type === "design" ? d : null)); forms.reload(); }} />
      )}
      {dialog?.type === "assign" && dialog.rec && <AssignDialog form={dialog.rec} onClose={() => { setDialog(null); forms.reload(); }} />}
      {dialog?.type === "design" && dialog.rec && <DesignDialog form={dialog.rec} onClose={() => { setDialog(null); forms.reload(); }} />}
    </div>
  );
}

function AssignDialog({ form, onClose }: { form: Rec; onClose: () => void }) {
  const { items: depts } = useDepartments();
  const [picked, setPicked] = useState<number[]>(((form.data.assignedDepartments as number[]) ?? []).map(Number));
  const { run, loading, error } = useMutation();
  async function save() { if (await attempt(run(() => api.patch(`/setup/clinical_form/${form.id}`, { assignedDepartments: picked })))) onClose(); }
  return (
    <Modal open onClose={onClose} width={440} title="Assign form" subtitle={`${form.name} is offered in these departments' consultations.`} footer={<DialogButtons onCancel={onClose} onConfirm={save} label="Save" loading={loading} />}>
      <div className="flex flex-col gap-2">
        {depts.map((d) => (
          <label key={d.id} className="flex cursor-pointer items-center gap-3 rounded-[8px] border border-[color:var(--line)] px-3 py-2 text-[14px]">
            <input type="checkbox" checked={picked.includes(d.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, d.id] : picked.filter((x) => x !== d.id))} />{d.name}
          </label>
        ))}
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

function useDepartments() { return useList<DepartmentDTO>("/departments"); }

function DesignDialog({ form, onClose }: { form: Rec; onClose: () => void }) {
  const [fields, setFields] = useState<ClinicalFormField[]>(((form.data.fields as ClinicalFormField[]) ?? []).map((f) => ({ ...f, options: f.options ?? [] })));
  const [name, setName] = useState(form.name);
  const { run, loading, error, reset } = useMutation();
  const patch = (i: number, p: Partial<ClinicalFormField>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const move = (i: number, d: number) => setFields((fs) => { const next = [...fs]; const j = i + d; if (j < 0 || j >= next.length) return fs; [next[i], next[j]] = [next[j], next[i]]; return next; });
  const add = () => setFields((fs) => [...fs, { id: `f${Date.now().toString(36)}`, label: "", type: "Short text", required: false, options: [] }]);
  async function save(publish: boolean) {
    reset();
    if (await attempt(run(() => api.patch(`/setup/clinical_form/${form.id}`, { name, fields, ...(publish ? { status: "Published" } : {}) })))) onClose();
  }
  return (
    <Modal open onClose={onClose} width={720} title="Design form" subtitle="Fields appear in this order in the consultation. Publishing makes a new version." footer={(
      <>
        <button onClick={onClose} className={outlineBtn + " !h-[36px]"}>Cancel</button>
        <button onClick={() => save(false)} disabled={loading || !name.trim()} className={softBtn + " !h-[36px]"}>Save draft</button>
        <button onClick={() => save(true)} disabled={loading || !name.trim() || fields.length === 0} className={primaryBtn}>{loading ? "Saving…" : "Publish"}</button>
      </>
    )}>
      <div className="flex flex-col gap-3">
        <Labelled label="Form name"><FormInput value={name} onChange={setName} /></Labelled>
        {fields.map((f, i) => (
          <div key={f.id} className="rounded-[10px] border border-[color:var(--line)] p-3">
            <div className="grid items-end gap-2" style={{ gridTemplateColumns: "1fr 170px auto" }}>
              <Labelled label={f.type === "Section heading" ? "Heading" : "Question"}><FormInput value={f.label} onChange={(v) => patch(i, { label: v })} placeholder="e.g. Blood pressure" /></Labelled>
              <Labelled label="Type"><FormSelect value={f.type} onChange={(v) => patch(i, { type: v as ClinicalFormField["type"] })} options={opt(FORM_FIELD_TYPES)} /></Labelled>
              <div className="mb-[2px] flex items-center">
                <button aria-label="Move up" onClick={() => move(i, -1)} className="p-2 text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] cursor-pointer"><ArrowUp size={15} /></button>
                <button aria-label="Move down" onClick={() => move(i, 1)} className="p-2 text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] cursor-pointer"><ArrowDown size={15} /></button>
                <button aria-label="Remove field" onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))} className="p-2 text-[color:var(--ink-soft)] hover:text-[#c8001a] cursor-pointer"><Trash2 size={15} /></button>
              </div>
            </div>
            {(f.type === "Choice" || f.type === "Multiple choice") && (
              <div className="mt-2"><Labelled label="Options (one per line)"><textarea rows={3} value={f.options.join("\n")} onChange={(e) => patch(i, { options: e.target.value.split("\n") })} className="w-full resize-y rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] px-3 py-2 text-[14px] focus:outline-none" /></Labelled></div>
            )}
            {f.type !== "Section heading" && <div className="mt-2"><ToggleRow label="Required" checked={f.required} onChange={(v) => patch(i, { required: v })} /></div>}
          </div>
        ))}
        {fields.length === 0 && <p className="rounded-[8px] border border-dashed border-[color:var(--line)] py-6 text-center text-[13px] text-[color:var(--ink-soft)]">No fields yet.</p>}
        <div><AddButton label="Add field" onClick={add} /></div>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}
