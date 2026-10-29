"use client";

/**
 * MRD → Documents. The retention queue (documents past their keep-until date, to extend or dispose of), the retention
 * policies behind it, and the folders documents are filed in.
 */
import { useRef, useState } from "react";
import { Download, FolderPlus, Plus, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import {
  MRD_DOC_CLASSES, type MrdFolderDocumentDTO, type MrdFolderDTO, type MrdRetentionPolicyDTO, type MrdRetentionQueueDTO, type MrdRetentionItemDTO, type PatientDTO,
} from "@/types/api";
import { attempt, DialogButtons, dmy, Empty, ErrorNote, fieldLabel, mono, outlineBtn, Pill, plusDays, primaryBtn, StatCard, StatGrid, td, th } from "@/components/mrd/shared";

// ── Retention queue ──────────────────────────────────────────────────────────

function ReviewDialog({ item, mode, onClose }: { item: MrdRetentionItemDTO | null; mode: "extend" | "dispose"; onClose: () => void }) {
  const { run, loading, error, reset } = useMutation();
  const [until, setUntil] = useState(plusDays(365));
  const [note, setNote] = useState("");
  if (!item) return null;
  const close = () => { reset(); onClose(); };
  async function submit() {
    const body = mode === "extend" ? { until, note: note.trim() } : { note: note.trim() };
    if (await attempt(run(() => api.post(`/mrd/retention/${item!.id}/${mode}`, body)))) close();
  }
  return (
    <Modal open onClose={close} width={440} title={mode === "extend" ? "Keep this document longer" : "Dispose of this document"} subtitle={`${item.fileName} · ${item.class} · due ${dmy(item.dueOn)}`}
      footer={<DialogButtons onCancel={close} onConfirm={submit} label={mode === "extend" ? "Extend" : "Dispose"} loading={loading} disabled={note.trim().length < 3} danger={mode === "dispose"} />}>
      <div className="flex flex-col gap-4">
        {mode === "dispose" && <p className="rounded-[8px] bg-[#fff2d6] px-3 py-2 text-[13px] text-[#8a5300]">The stored file is deleted and can&apos;t be brought back. The audit log keeps its name, owner and your reason.</p>}
        {mode === "extend" && <div className="flex flex-col gap-2"><span className={fieldLabel}>Keep until</span><FormInput type="date" value={until} onChange={setUntil} min={plusDays(1)} /></div>}
        <div className="flex flex-col gap-2"><span className={fieldLabel}>{mode === "extend" ? "Why keep it?" : "Reason / approval"}</span><FormInput value={note} onChange={setNote} placeholder={mode === "extend" ? "e.g. Medico-legal case open" : "e.g. Past 10 years, approved by the MRD head"} /></div>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function RetentionView({ canWrite }: { canWrite: boolean }) {
  const { item: q } = useItem<MrdRetentionQueueDTO>("/mrd/retention");
  const [review, setReview] = useState<{ item: MrdRetentionItemDTO; mode: "extend" | "dispose" } | null>(null);
  const v = (n: number | undefined) => (q ? n ?? 0 : "–");
  return (
    <div>
      <StatGrid cols={4}>
        <StatCard mono label="Clinical due" value={v(q?.clinicalDue)} />
        <StatCard mono label="Financial due" value={v(q?.financialDue)} />
        <StatCard mono label="KYC due" value={v(q?.kycDue)} />
        <StatCard mono label="Statutory due" value={v(q?.statutoryDue)} />
      </StatGrid>
      <div className="px-5 pb-5">
        {q && q.items.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[color:var(--line)] py-12 text-center text-[14px] text-[color:var(--ink-soft)]">Nothing awaiting review. The nightly sweep flags documents that pass their retention period.</div>
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
            <table className="w-full min-w-[900px] text-left">
              <thead><tr className="border-b border-[color:var(--line)]">{["Document", "Class", "Belongs to", "Folder", "Uploaded", "Was due", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {q?.items.map((i) => (
                  <tr key={i.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                    <td className={td}>{i.fileName}<span className="block text-[12px] text-[color:var(--ink-soft)]">{i.category} · {i.policyName}</span></td>
                    <td className={td}><Pill tone="red">{i.class}</Pill></td>
                    <td className={td}>{i.patientName || `${i.ownerType} #${i.ownerId}`}</td>
                    <td className={td}>{i.folderName || "—"}</td>
                    <td className={`${td} ${mono}`}>{dmy(i.uploadedOn)}</td>
                    <td className={`${td} ${mono} text-[#c8001a]`}>{dmy(i.dueOn)}</td>
                    <td className={`${td} text-right`}>
                      {canWrite && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setReview({ item: i, mode: "extend" })} className={outlineBtn}>Extend</button>
                          <button onClick={() => setReview({ item: i, mode: "dispose" })} className={`${outlineBtn} !text-[#c8001a]`}>Dispose</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ReviewDialog key={`${review?.item.id}-${review?.mode}`} item={review?.item ?? null} mode={review?.mode ?? "extend"} onClose={() => setReview(null)} />
    </div>
  );
}

// ── Policies ─────────────────────────────────────────────────────────────────

function PolicyDialog({ policy, onClose }: { policy: MrdRetentionPolicyDTO | "new"; onClose: () => void }) {
  const p = policy === "new" ? null : policy;
  const { run, loading, error, reset } = useMutation();
  const [name, setName] = useState(p?.name ?? "");
  const [cls, setCls] = useState<string>(p?.class ?? "Clinical");
  const [years, setYears] = useState(String(p?.retentionYears ?? 10));
  const [cats, setCats] = useState((p?.categories ?? []).join(", "));
  const [after, setAfter] = useState<string>(p?.actionAfter ?? "Review");
  const [active, setActive] = useState(p?.active ?? true);
  const close = () => { reset(); onClose(); };
  async function submit() {
    const body = { name: name.trim(), class: cls, retentionYears: Number(years), categories: cats, actionAfter: after, active };
    if (await attempt(run(() => (p ? api.patch(`/mrd/policies/${p.id}`, body) : api.post("/mrd/policies", body))))) close();
  }
  return (
    <Modal open onClose={close} width={460} title={p ? "Edit retention policy" : "Add retention policy"} subtitle="How long a class of documents is kept before it is flagged for review."
      footer={<DialogButtons onCancel={close} onConfirm={submit} label={p ? "Save" : "Add"} loading={loading} disabled={name.trim().length < 2 || !(Number(years) >= 1)} />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Name</span><FormInput value={name} onChange={setName} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Class</span><FormSelect value={cls} onChange={setCls} options={MRD_DOC_CLASSES.map((c) => ({ value: c, label: c }))} /></div>
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Keep for (years)</span><FormInput type="number" value={years} onChange={setYears} min="1" /></div>
        </div>
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Document categories it covers</span><FormInput value={cats} onChange={setCats} placeholder="Report, Consent Form, ID Proof…" /></div>
        <div className="flex flex-col gap-2"><span className={fieldLabel}>When due</span><FormSelect value={after} onChange={setAfter} options={[{ value: "Review", label: "Review" }, { value: "Destroy", label: "Destroy" }]} /></div>
        {p && <label className="flex items-center gap-2 text-[14px] cursor-pointer"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[color:var(--brand)]" /> Active</label>}
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function PoliciesView({ canWrite }: { canWrite: boolean }) {
  const { items, loading } = useList<MrdRetentionPolicyDTO>("/mrd/policies");
  const [editing, setEditing] = useState<MrdRetentionPolicyDTO | "new" | null>(null);
  return (
    <div className="px-5 pb-5 pt-4">
      <div className="mb-3 flex justify-end">{canWrite && <button onClick={() => setEditing("new")} className={primaryBtn}><Plus size={15} /> Add policy</button>}</div>
      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
        <table className="w-full min-w-[820px] text-left">
          <thead><tr className="border-b border-[color:var(--line)]">{["Policy", "Class", "Keep for", "Covers", "When due", "Active", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                <td className={td}>{p.name}</td>
                <td className={td}>{p.class}</td>
                <td className={`${td} ${mono}`}>{p.retentionYears} {p.retentionYears === 1 ? "year" : "years"}</td>
                <td className={`${td} text-[color:var(--ink-soft)]`}>{p.categories.length ? p.categories.join(", ") : "by owner type"}</td>
                <td className={td}>{p.actionAfter}</td>
                <td className={td}>{p.active ? "Yes" : "No"}</td>
                <td className={`${td} text-right`}>{canWrite && <button onClick={() => setEditing(p)} className="text-[13px] hover:underline cursor-pointer">Edit</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <Empty>No retention policies.</Empty>}
      </div>
      {editing && <PolicyDialog key={editing === "new" ? "new" : editing.id} policy={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ── Folders ──────────────────────────────────────────────────────────────────

const humanSize = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const UPLOAD_CATEGORIES = ["Report", "Medical History", "Consent Form", "Discharge summary", "Insurance", "ID Proof", "Other"];

function FolderDialog({ folder, onClose }: { folder: MrdFolderDTO | "new"; onClose: () => void }) {
  const f = folder === "new" ? null : folder;
  const { run, loading, error, reset } = useMutation();
  const [name, setName] = useState(f?.name ?? "");
  const [cls, setCls] = useState<string>(f?.class ?? "General");
  const [desc, setDesc] = useState(f?.description ?? "");
  const close = () => { reset(); onClose(); };
  async function submit() {
    const body = { name: name.trim(), class: cls, description: desc.trim() };
    if (await attempt(run(() => (f ? api.patch(`/mrd/folders/${f.id}`, body) : api.post("/mrd/folders", body))))) close();
  }
  return (
    <Modal open onClose={close} width={440} title={f ? "Edit folder" : "New folder"}
      footer={<DialogButtons onCancel={close} onConfirm={submit} label={f ? "Save" : "Create"} loading={loading} disabled={name.trim().length < 2} />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Name</span><FormInput value={name} onChange={setName} /></div>
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Class</span><FormSelect value={cls} onChange={setCls} options={[...MRD_DOC_CLASSES, "General"].map((c) => ({ value: c, label: c }))} /></div>
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Description (optional)</span><FormInput value={desc} onChange={setDesc} /></div>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

function FolderContents({ folder, canWrite, onClose }: { folder: MrdFolderDTO; canWrite: boolean; onClose: () => void }) {
  const { items: docs, loading, reload } = useList<MrdFolderDocumentDTO>(`/mrd/folders/${folder.id}/documents`);
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const [patientId, setPatientId] = useState("");
  const [category, setCategory] = useState(UPLOAD_CATEGORIES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.append("file", file); form.append("patientId", patientId); form.append("category", category);
      const res = await fetch(`/api/mrd/folders/${folder.id}/upload`, { method: "POST", body: form, credentials: "same-origin" });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message ?? "Upload failed");
      reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <Modal open onClose={onClose} width={780} title={folder.name} subtitle={`${folder.class} · ${folder.description || "no description"}`}
      footer={<button onClick={onClose} className="h-[36px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 text-[13px] font-medium cursor-pointer hover:bg-[color:var(--subtle)]">Close</button>}>
      <div className="flex flex-col gap-4">
        {canWrite && (
          <div className="grid items-end gap-3" style={{ gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr) auto" }}>
            <div className="flex flex-col gap-2"><span className={fieldLabel}>File for patient</span>
              <SearchSelect placeholder="Search a patient…" value={patientId} onChange={setPatientId} options={patients.map((p) => ({ value: String(p.id), label: p.name, hint: p.patientId }))} />
            </div>
            <div className="flex flex-col gap-2"><span className={fieldLabel}>Category</span><FormSelect value={category} onChange={setCategory} options={UPLOAD_CATEGORIES.map((c) => ({ value: c, label: c }))} /></div>
            <div>
              <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp,image/heic" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <button onClick={() => fileRef.current?.click()} disabled={!patientId || busy} className={primaryBtn}><Upload size={14} /> {busy ? "Uploading…" : "Upload"}</button>
            </div>
          </div>
        )}
        <ErrorNote message={error} />
        <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
          <table className="w-full min-w-[620px] text-left">
            <thead><tr className="border-b border-[color:var(--line)]">{["Document", "Patient", "Size", "Uploaded", "Retention", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-b border-[color:var(--line)] last:border-b-0">
                  <td className={td}>{d.fileName}<span className="block text-[12px] text-[color:var(--ink-soft)]">{d.category}</span></td>
                  <td className={td}>{d.patientName || "—"}</td>
                  <td className={`${td} ${mono}`}>{humanSize(d.sizeBytes)}</td>
                  <td className={td}><span className={mono}>{dmy(d.uploadedOn)}</span><span className="block text-[12px] text-[color:var(--ink-soft)]">{d.uploadedBy}</span></td>
                  <td className={td}><Pill>{d.retentionState}</Pill></td>
                  <td className={`${td} text-right`}><a href={`/api/documents/${d.id}/download`} className="inline-flex items-center gap-1 text-[13px] text-[color:var(--brand)] hover:underline"><Download size={14} /> Open</a></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && docs.length === 0 && <Empty>Nothing filed here yet.</Empty>}
        </div>
      </div>
    </Modal>
  );
}

export function FoldersView({ canWrite }: { canWrite: boolean }) {
  const { items, loading } = useList<MrdFolderDTO>("/mrd/folders");
  const { run, error, reset } = useMutation();
  const [editing, setEditing] = useState<MrdFolderDTO | "new" | null>(null);
  const [open, setOpen] = useState<MrdFolderDTO | null>(null);
  const [deleting, setDeleting] = useState<MrdFolderDTO | null>(null);
  async function remove() {
    if (!deleting) return;
    reset();
    if (await attempt(run(() => api.del(`/mrd/folders/${deleting.id}`)))) setDeleting(null);
  }
  return (
    <div className="px-5 pb-5 pt-4">
      <div className="mb-3 flex items-center gap-3">
        <ErrorNote message={error?.message} />
        {canWrite && <button onClick={() => setEditing("new")} className={`${primaryBtn} ml-auto`}><FolderPlus size={15} /> New folder</button>}
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
        <table className="w-full min-w-[700px] text-left">
          <thead><tr className="border-b border-[color:var(--line)]">{["Folder", "Class", "Documents", "Description", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((f) => (
              <tr key={f.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                <td className={td}><button onClick={() => setOpen(f)} className="text-left font-medium text-[color:var(--brand)] hover:underline cursor-pointer">{f.name}</button></td>
                <td className={td}>{f.class}</td>
                <td className={`${td} ${mono}`}>{f.documentCount}</td>
                <td className={`${td} text-[color:var(--ink-soft)]`}>{f.description || "—"}</td>
                <td className={`${td} text-right`}>
                  {canWrite && (
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => setEditing(f)} className="text-[13px] hover:underline cursor-pointer">Edit</button>
                      <button onClick={() => { reset(); setDeleting(f); }} aria-label={`Delete ${f.name}`} className="text-[#c8001a] cursor-pointer"><Trash2 size={15} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <Empty>No folders yet.</Empty>}
      </div>
      {editing && <FolderDialog key={editing === "new" ? "new" : editing.id} folder={editing} onClose={() => setEditing(null)} />}
      {open && <FolderContents key={open.id} folder={open} canWrite={canWrite} onClose={() => setOpen(null)} />}
      <ConfirmDialog open={!!deleting} title="Delete folder" message={deleting ? `Delete "${deleting.name}"? A folder that still holds documents can't be deleted.` : ""} confirmLabel="Delete" onConfirm={remove} onCancel={() => setDeleting(null)} />
    </div>
  );
}
