"use client";

/**
 * A patient's "Documents & consents" tab. Papers are filed in the hospital's standard folders (Registration, OPD Records,
 * Lab Reports, Consent & Undertakings…). They arrive by Upload (PDF / JPG / PNG / WebP, several at once) or by
 * Photo → PDF, which turns pictures of paper — taken with the camera or picked from the gallery, in the order you set —
 * into one PDF. Below the papers sit the patient's consent forms.
 */
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Download, FileText, Image as ImageIcon, Images, Pencil, Trash2, Upload, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { imagesToPdf } from "@/lib/image-pdf";
import { Modal } from "@/components/shared/Modal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import { ConsentsPanel } from "@/components/consents/ConsentsPanel";
import type { DocumentDTO, MrdFolderDTO } from "@/types/api";
import { cancelBtn, DialogButtons, ErrorNote, fieldLabel, outlineBtn, primaryBtn } from "@/components/mrd/shared";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "Sun, 20 Sept" */
const dayOf = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const size = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp,image/heic";
const SCANS = "scans";

async function postDocument(file: File, fields: Record<string, string>): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  for (const [k, v] of Object.entries(fields)) if (v) form.append(k, v);
  const res = await fetch("/api/documents", { method: "POST", body: form, credentials: "same-origin" });
  if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message ?? `${file.name} couldn't be uploaded`);
}

// ── Upload ───────────────────────────────────────────────────────────────────

function UploadDialog({ patientId, folders, onClose, onDone }: { patientId: number; folders: MrdFolderDTO[]; onClose: () => void; onDone: () => void }) {
  const [folderId, setFolderId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  async function go() {
    setError(null);
    const failed: File[] = [];
    let lastError = "";
    for (let i = 0; i < files.length; i++) {
      setBusy(`Uploading ${i + 1} of ${files.length}…`);
      try { await postDocument(files[i], { ownerType: "patient", ownerId: String(patientId), folderId }); }
      catch (e) { failed.push(files[i]); lastError = e instanceof Error ? e.message : "Upload failed"; }
    }
    setBusy(null);
    onDone();
    if (failed.length === 0) onClose();
    else { setFiles(failed); setError(`${failed.length} of ${files.length} didn't upload: ${lastError}`); }
  }

  return (
    <Modal open onClose={onClose} width={520} title="Upload documents" subtitle="PDF, JPG, PNG, or WebP. You can select several at once."
      footer={<><button onClick={onClose} className={cancelBtn}>Cancel</button><button onClick={go} disabled={files.length === 0 || busy !== null} className={primaryBtn}>{busy ?? `Upload ${files.length > 1 ? `${files.length} files` : "files"}`}</button></>}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Folder</span>
          <FormSelect value={folderId} onChange={setFolderId} options={[{ value: "", label: "No folder" }, ...folders.map((f) => ({ value: String(f.id), label: f.name }))]} />
        </div>
        <input ref={ref} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { setFiles((x) => [...x, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
        <button onClick={() => ref.current?.click()} className="flex h-[110px] flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-[color:var(--line)] text-[14px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer">
          <Upload size={22} /> Click to choose files
        </button>
        {files.length > 0 && (
          <ul className="flex flex-col gap-1">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-[8px] bg-[color:var(--subtle)] px-3 py-[6px] text-[14px]">
                <span className="truncate">{f.name} <span className="text-[12px] text-[color:var(--ink-soft)]">{size(f.size)}</span></span>
                <button onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="text-[color:var(--ink-soft)] hover:text-[#c8001a] cursor-pointer"><X size={14} /></button>
              </li>
            ))}
          </ul>
        )}
        <ErrorNote message={error} />
      </div>
    </Modal>
  );
}

// ── Photo → PDF ──────────────────────────────────────────────────────────────

function Thumb({ file, page, count, onMove, onRemove }: { file: File; page: number; count: number; onMove: (to: number) => void; onRemove: () => void }) {
  const [url] = useState(() => URL.createObjectURL(file));
  return (
    <li draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", String(page))} onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const from = Number(e.dataTransfer.getData("text/plain")); if (Number.isInteger(from)) onMove(from); }}
      className="group relative overflow-hidden rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)]" style={{ cursor: "grab" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`Page ${page + 1}`} className="h-[120px] w-full object-cover" onLoad={() => undefined} />
      <span className="absolute left-1 top-1 rounded bg-black/70 px-[6px] text-[11px] text-white">{page + 1}</span>
      <div className="flex items-center justify-between border-t border-[color:var(--line)] bg-[color:var(--surface)] px-1 py-[2px]">
        <button disabled={page === 0} onClick={() => onMove(page - 1)} aria-label={`Move page ${page + 1} earlier`} className="p-1 text-[color:var(--ink-soft)] disabled:opacity-30 cursor-pointer"><ArrowLeft size={13} /></button>
        <button onClick={onRemove} aria-label={`Remove page ${page + 1}`} className="p-1 text-[color:var(--ink-soft)] hover:text-[#c8001a] cursor-pointer"><Trash2 size={13} /></button>
        <button disabled={page === count - 1} onClick={() => onMove(page + 1)} aria-label={`Move page ${page + 1} later`} className="p-1 text-[color:var(--ink-soft)] disabled:opacity-30 cursor-pointer"><ArrowRight size={13} /></button>
      </div>
    </li>
  );
}

function PhotoPdfDialog({ patientId, folders, onClose, onDone }: { patientId: number; folders: MrdFolderDTO[]; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("Case paper");
  const [category, setCategory] = useState(SCANS);
  const [photos, setPhotos] = useState<{ id: number; file: File }[]>([]);
  const [busy, setBusy] = useState(false);
  const { error, run, reset } = useMutation();
  const pick = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const next = useRef(0);
  const add = (list: FileList | null) => { if (list) setPhotos((x) => [...x, ...Array.from(list).map((file) => ({ id: next.current++, file }))]); };
  const move = (from: number, to: number) => setPhotos((x) => { if (to < 0 || to >= x.length || from === to) return x; const a = [...x]; const [m] = a.splice(from, 1); a.splice(to, 0, m); return a; });

  async function generate() {
    reset(); setBusy(true);
    try {
      await run(async () => {
        const pdf = await imagesToPdf(photos.map((p) => p.file));
        const name = `${title.trim() || "Case paper"}.pdf`;
        await postDocument(new File([pdf], name, { type: "application/pdf" }), {
          ownerType: "patient", ownerId: String(patientId), title: title.trim(), folderId: category === SCANS ? "" : category, category: category === SCANS ? "Scans" : "",
        });
      });
      onDone(); onClose();
    } catch { /* shown below */ } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} width={640} title="Build a PDF from photos" subtitle="Capture or pick case-paper photos, drag to reorder, then generate one PDF."
      footer={<><button onClick={onClose} className={cancelBtn}>Cancel</button><button onClick={generate} disabled={busy || photos.length === 0 || title.trim().length < 2} className={primaryBtn}>{busy ? "Generating…" : `Generate PDF (${photos.length} ${photos.length === 1 ? "page" : "pages"})`}</button></>}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-3" style={{ gridTemplateColumns: "minmax(0,1fr) 180px" }}>
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Title</span><FormInput value={title} onChange={setTitle} /></div>
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Category</span>
            <FormSelect value={category} onChange={setCategory} options={[{ value: SCANS, label: "Scans" }, ...folders.map((f) => ({ value: String(f.id), label: f.name }))]} />
          </div>
        </div>
        <input ref={pick} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => pick.current?.click()} className="flex h-[48px] items-center justify-center gap-2 rounded-[10px] border border-dashed border-[color:var(--line)] text-[14px] hover:bg-[color:var(--subtle)] cursor-pointer"><Images size={16} /> Choose images</button>
          <button onClick={() => cam.current?.click()} className="flex h-[48px] items-center justify-center gap-2 rounded-[10px] border border-dashed border-[color:var(--line)] text-[14px] hover:bg-[color:var(--subtle)] cursor-pointer"><Camera size={16} /> Take photo</button>
        </div>
        {photos.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-[color:var(--ink-soft)]">No photos yet. Choose images or take a photo to begin.</p>
        ) : (
          <ul className="grid grid-cols-4 gap-3">
            {photos.map((p, i) => <Thumb key={p.id} file={p.file} page={i} count={photos.length} onMove={(to) => move(i, to)} onRemove={() => setPhotos((x) => x.filter((y) => y.id !== p.id))} />)}
          </ul>
        )}
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

// ── Edit ─────────────────────────────────────────────────────────────────────

function EditDialog({ doc, folders, onClose, onDone }: { doc: DocumentDTO; folders: MrdFolderDTO[]; onClose: () => void; onDone: () => void }) {
  const { run, loading, error, reset } = useMutation();
  const [title, setTitle] = useState(doc.title);
  const [folderId, setFolderId] = useState(doc.folderId ? String(doc.folderId) : "");
  const [ref, setRef] = useState(doc.referenceNo);
  const close = () => { reset(); onClose(); };
  async function save() {
    try { await run(() => api.patch(`/documents/${doc.id}`, { title: title.trim(), referenceNo: ref.trim(), folderId: folderId ? Number(folderId) : null })); onDone(); close(); } catch { /* shown below */ }
  }
  return (
    <Modal open onClose={close} width={460} title="Edit document" subtitle={doc.fileName}
      footer={<DialogButtons onCancel={close} onConfirm={save} label="Save" loading={loading} disabled={title.trim().length < 1} />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Title</span><FormInput value={title} onChange={setTitle} /></div>
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Folder</span>
          <FormSelect value={folderId} onChange={setFolderId} options={[{ value: "", label: "No folder" }, ...folders.map((f) => ({ value: String(f.id), label: f.name }))]} />
        </div>
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Reference number (optional)</span><FormInput value={ref} onChange={setRef} placeholder="e.g. CERT/2026/0009" /></div>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

// ── The tab ──────────────────────────────────────────────────────────────────

export function PatientDocuments({ patient }: { patient: { id: number; name: string; language?: string | null } }) {
  const { can } = useAuth();
  const canDocs = can("documents", "write");
  const canConsents = can("consents", "write");
  const { items, reload } = useList<DocumentDTO>("/documents", { all: true, owner_type: "patient", owner_id: patient.id });
  const { items: folders } = useList<MrdFolderDTO>("/documents/folders");
  const mine = items.filter((d) => d.ownerId === patient.id);
  const [folder, setFolder] = useState<"all" | "unfiled" | number>("all");
  const [term, setTerm] = useState("");
  const [dialog, setDialog] = useState<"upload" | "photo" | null>(null);
  const [editing, setEditing] = useState<DocumentDTO | null>(null);
  const [deleting, setDeleting] = useState<DocumentDTO | null>(null);
  const { run, error, reset } = useMutation();

  const countOf = (id: number) => mine.filter((d) => d.folderId === id).length;
  const unfiled = mine.filter((d) => d.folderId == null).length;
  const q = term.trim().toLowerCase();
  const shown = mine.filter((d) =>
    (folder === "all" || (folder === "unfiled" ? d.folderId == null : d.folderId === folder)) &&
    (!q || `${d.title} ${d.fileName} ${d.referenceNo} ${d.folderName} ${d.category}`.toLowerCase().includes(q)));

  const chip = (active: boolean) => `h-[26px] whitespace-nowrap rounded-full border px-3 text-[12px] cursor-pointer transition-colors ${active ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-white" : "border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`;

  async function remove() {
    if (!deleting) return;
    reset();
    try { await run(() => api.del(`/documents/${deleting.id}`)); setDeleting(null); reload(); } catch { /* shown below */ }
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <button onClick={() => setFolder("all")} className={chip(folder === "all")}>All</button>
          {folders.map((f) => (
            <button key={f.id} onClick={() => setFolder(f.id)} className={chip(folder === f.id)}>{f.name}{countOf(f.id) > 0 ? ` ${countOf(f.id)}` : ""}</button>
          ))}
          <button onClick={() => setFolder("unfiled")} className={chip(folder === "unfiled")}>Unfiled{unfiled > 0 ? ` ${unfiled}` : ""}</button>
        </div>
        {canDocs && (
          <div className="flex shrink-0 gap-2">
            <button onClick={() => setDialog("photo")} className={outlineBtn + " !h-[36px]"}><Images size={15} /> Photo → PDF</button>
            <button onClick={() => setDialog("upload")} className={primaryBtn}><Upload size={15} /> Upload</button>
          </div>
        )}
      </div>

      <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search documents..." aria-label="Search documents"
        className="h-[44px] w-full rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 text-[14px] placeholder:text-[color:var(--ink-soft)] focus:border-[color:var(--brand)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ring)]" />
      <ErrorNote message={error?.message} />

      <ul className="flex flex-col gap-3">
        {shown.map((d) => (
          <li key={d.id} className="flex items-center gap-3 rounded-[10px] border border-[color:var(--line)] px-4 py-3">
            <span className="text-[color:var(--ink-soft)]">{d.mimeType.startsWith("image/") ? <ImageIcon size={18} /> : <FileText size={18} />}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-[color:var(--ink)]">{d.title}</p>
              <p className="truncate text-[12px] text-[color:var(--ink-soft)]">{[d.folderName || d.category, dayOf(d.createdAt), size(d.sizeBytes), d.referenceNo].filter(Boolean).join(" · ")}</p>
            </div>
            <a href={d.url} target="_blank" rel="noreferrer" aria-label={`Download ${d.title}`} title="Download" className="grid h-8 w-8 place-items-center rounded-[8px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]"><Download size={16} /></a>
            {canDocs && <button onClick={() => setEditing(d)} aria-label={`Edit ${d.title}`} title="Edit" className="grid h-8 w-8 place-items-center rounded-[8px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer"><Pencil size={16} /></button>}
            {canDocs && <button onClick={() => { reset(); setDeleting(d); }} aria-label={`Delete ${d.title}`} title="Delete" className="grid h-8 w-8 place-items-center rounded-[8px] text-[#c8001a] hover:bg-[#ffe9e9] cursor-pointer"><Trash2 size={16} /></button>}
          </li>
        ))}
        {shown.length === 0 && <li className="py-8 text-center text-[14px] text-[color:var(--ink-soft)]">{mine.length === 0 ? "No documents uploaded yet." : "No documents match."}</li>}
      </ul>

      <ConsentsPanel patient={patient} canWrite={canConsents} />

      {dialog === "upload" && <UploadDialog patientId={patient.id} folders={folders} onClose={() => setDialog(null)} onDone={reload} />}
      {dialog === "photo" && <PhotoPdfDialog patientId={patient.id} folders={folders} onClose={() => setDialog(null)} onDone={reload} />}
      {editing && <EditDialog key={editing.id} doc={editing} folders={folders} onClose={() => setEditing(null)} onDone={reload} />}
      <ConfirmDialog open={!!deleting} title="Delete document" message={deleting ? `Delete “${deleting.title}”? This can't be undone.` : ""} confirmLabel="Delete" onConfirm={remove} onCancel={() => setDeleting(null)} />
    </div>
  );
}
