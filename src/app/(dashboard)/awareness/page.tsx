"use client";

/**
 * Awareness: programmes the hospital posts for patients (health camps, webinars, vaccination drives…). Published ones appear in the
 * patient portal's awareness section and as a notification there.
 */
import { useMemo, useState } from "react";
import { Eye, Megaphone, Plus, Trash2, Upload } from "lucide-react";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { useRowActions } from "@/lib/api/useRowActions";
import { PageHeader } from "@/components/shared/PageHeader";
import { TabBar } from "@/components/shared/TabBar";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Modal } from "@/components/shared/Modal";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import { FormInput, FormRow, FormSelect, FormTextarea } from "@/components/shared/FormRow";
import { AWARENESS_CATEGORIES, AWARENESS_MODES, type AwarenessDTO, type AwarenessInput } from "@/types/awareness";

const COLUMNS = [
  { label: "Programme", width: "minmax(220px,2.2fr)" },
  { label: "When", width: "minmax(150px,1fr)" },
  { label: "Where", width: "minmax(120px,1fr)" },
  { label: "Who sees it", width: "130px" },
  { label: "Status", width: "120px" },
  { label: "Opened", width: "80px", align: "right" as const },
  { label: "Action", width: "52px", align: "right" as const },
];

const BLANK = { title: "", category: "Health camp", summary: "", details: "", eventDate: "", eventTime: "", endDate: "", mode: "In person", venue: "", link: "", contact: "", audience: "all", image: "" };
type Form = typeof BLANK;

/** Shrinks a chosen picture to at most 900px wide and returns a JPEG data URL, small enough to keep. */
async function fileToImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That file isn't a picture.")); i.src = url; });
    const scale = Math.min(1, 900 / img.width);
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.82, 0.65, 0.5]) { const d = c.toDataURL("image/jpeg", q); if (d.length < 430_000) return d; }
    throw new Error("That picture is too large: try a smaller one.");
  } finally { URL.revokeObjectURL(url); }
}

const when = (a: AwarenessDTO) => {
  if (!a.eventDate) return "No fixed date";
  const day = a.endDate && a.endDate !== a.eventDate ? `${formatDate(a.eventDate)} – ${formatDate(a.endDate)}` : formatDate(a.eventDate);
  return a.eventTime ? `${day} · ${a.eventTime}` : day;
};

export default function AwarenessPage() {
  const { can } = useAuth();
  const canWrite = can("awareness", "write");
  const [tab, setTab] = useState("all");
  const [editing, setEditing] = useState<AwarenessDTO | "new" | null>(null);
  const { item, reload } = useItem<AwarenessDTO[]>("/awareness");
  const rows = item ?? [];
  const actions = useRowActions("awareness", reload);

  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const TABS = [
    { id: "all", label: "All", count: rows.length },
    { id: "Draft", label: "Drafts", count: count("Draft") },
    { id: "Published", label: "Published", count: count("Published") },
    { id: "Cancelled", label: "Cancelled", count: count("Cancelled") },
  ];
  const shown = tab === "all" ? rows : rows.filter((r) => r.status === tab);

  const menu = (a: AwarenessDTO): RowAction[] => !canWrite ? [] : [
    { label: "Edit", onClick: () => setEditing(a) },
    ...(a.status !== "Published" ? [{ label: "Publish to patients", onClick: () => actions.ask({ title: "Publish", message: `Publish "${a.title}"? Patients in the portal will be notified.`, confirmLabel: "Publish", action: () => api.post(`/awareness/${a.id}/publish`) }) }] : []),
    ...(a.status === "Published" ? [{ label: "Cancel programme", danger: true, onClick: () => actions.ask({ title: "Cancel programme", message: `Cancel "${a.title}"? Patients who were told about it will see it is cancelled.`, confirmLabel: "Cancel programme", danger: true, action: () => api.post(`/awareness/${a.id}/cancel`) }) }] : []),
    { label: "Delete", danger: true, onClick: () => actions.remove(a.id, a.title) },
  ];

  return (
    <>
      {actions.dialog}
      {editing && <AwarenessModal initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      <PageHeader title="Awareness" subtitle="Health camps, webinars and drives you post for patients. Published ones reach the patient portal."
        stats={[{ icon: Megaphone, value: String(count("Published")), label: "Published" }]} dateRange={false}
        action={canWrite ? { label: "New programme", icon: Plus, onClick: () => setEditing("new") } : undefined} />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 360 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
          <DataTable columns={COLUMNS} minWidth={900}>
            {shown.length === 0 ? (
              <div className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">{rows.length === 0 ? "No programmes yet. Post the first one." : "Nothing here."}</div>
            ) : shown.map((a) => (
              <div key={a.id} className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
                <div className="min-w-0">
                  <button onClick={() => canWrite && setEditing(a)} className="block max-w-full cursor-pointer truncate text-left text-[13px] font-medium text-[color:var(--ink)] hover:underline">{a.title}</button>
                  <span className="text-[12px] text-[color:var(--ink-soft)]">{a.category}</span>
                </div>
                <span className="text-[13px] text-[color:var(--ink)]">{when(a)}</span>
                <span className="truncate text-[13px] text-[color:var(--ink)]">{a.mode === "Online" ? "Online" : a.venue || "In person"}</span>
                <span className="text-[13px] text-[color:var(--ink-soft)]">{a.audience === "all" ? "All patients" : "Our patients"}</span>
                <span><StatusBadge status={a.status} /></span>
                <span className="inline-flex items-center justify-end gap-1 text-[13px] text-[color:var(--ink-soft)]"><Eye size={13} /> {a.reads}</span>
                <div className="flex justify-end"><RowMenu actions={menu(a)} /></div>
              </div>
            ))}
          </DataTable>
        </div>
      </div>
    </>
  );
}

function AwarenessModal({ initial, onClose, onSaved }: { initial: AwarenessDTO | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Form>(() => initial ? { title: initial.title, category: initial.category, summary: initial.summary, details: initial.details, eventDate: initial.eventDate, eventTime: initial.eventTime, endDate: initial.endDate, mode: initial.mode, venue: initial.venue, link: initial.link, contact: initial.contact, audience: initial.audience, image: initial.image } : BLANK);
  const set = (k: keyof Form) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const { run, loading, error } = useMutation();
  const [pictureError, setPictureError] = useState("");
  const published = initial?.status === "Published";

  const body = useMemo<AwarenessInput>(() => ({ ...f } as AwarenessInput), [f]);
  async function save(publish: boolean) {
    try {
      await run(() => (initial ? api.put(`/awareness/${initial.id}`, body).then(async (x) => (publish ? api.post(`/awareness/${initial.id}/publish`) : x)) : api.post("/awareness", { ...body, publish })));
      onSaved();
    } catch { /* the error is shown in the form */ }
  }
  async function pick(file: File | undefined) {
    if (!file) return;
    setPictureError("");
    try { set("image")(await fileToImage(file)); } catch (e) { setPictureError(e instanceof Error ? e.message : "Couldn't read that picture."); }
  }
  const fe = error?.fieldErrors ?? {};

  return (
    <Modal open onClose={onClose} title={initial ? "Edit programme" : "New programme"} width={720} subtitle="Patients see the title, summary, date, place and details. Publish to send it to the patient portal."
      footer={<>
        <button onClick={onClose} className="rounded-full border border-[color:var(--line)] px-5 py-[8px] text-[13px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer">Close</button>
        {published
          ? <button onClick={() => save(false)} disabled={loading} className="rounded-full bg-[color:var(--brand)] px-5 py-[8px] text-[13px] text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">{loading ? "Saving…" : "Save changes"}</button>
          : <>
              <button onClick={() => save(false)} disabled={loading} className="rounded-full border border-[color:var(--brand)] px-5 py-[8px] text-[13px] text-[color:var(--brand)] hover:bg-[color:var(--brand-soft)] disabled:opacity-50 cursor-pointer">{loading ? "Saving…" : "Save draft"}</button>
              <button onClick={() => save(true)} disabled={loading} className="rounded-full bg-[color:var(--brand)] px-5 py-[8px] text-[13px] text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">Publish to patients</button>
            </>}
      </>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><FormRow label="Title *" error={fe.title}><FormInput placeholder="Free diabetes screening camp" value={f.title} onChange={set("title")} /></FormRow></div>
        <FormRow label="Type *" error={fe.category}><FormSelect value={f.category} onChange={set("category")} options={AWARENESS_CATEGORIES.map((c) => ({ value: c, label: c }))} /></FormRow>
        <FormRow label="Who should see it" error={fe.audience}><FormSelect value={f.audience} onChange={set("audience")} options={[{ value: "all", label: "All patients on the portal" }, { value: "hospital", label: "Only our hospital's patients" }]} /></FormRow>
        <div className="sm:col-span-2"><FormRow label="Short summary *" hint="One or two lines: it is the card text and the notification." error={fe.summary}><FormTextarea rows={2} placeholder="Free blood sugar and BP checks for everyone this Saturday." value={f.summary} onChange={set("summary")} /></FormRow></div>
        <div className="sm:col-span-2"><FormRow label="Details" error={fe.details}><FormTextarea rows={5} placeholder="What to bring, who it is for, how to register…" value={f.details} onChange={set("details")} /></FormRow></div>
        <FormRow label="Date" error={fe.eventDate}><FormInput type="date" value={f.eventDate} onChange={set("eventDate")} /></FormRow>
        <FormRow label="Time" error={fe.eventTime}><FormInput type="time" value={f.eventTime} onChange={set("eventTime")} /></FormRow>
        <FormRow label="Ends on (if more than a day)" error={fe.endDate}><FormInput type="date" value={f.endDate} onChange={set("endDate")} /></FormRow>
        <FormRow label="How" error={fe.mode}><FormSelect value={f.mode} onChange={set("mode")} options={AWARENESS_MODES.map((m) => ({ value: m, label: m }))} /></FormRow>
        <FormRow label={f.mode === "Online" ? "Place (optional)" : "Venue"} error={fe.venue}><FormInput placeholder="Main lobby, Block A" value={f.venue} onChange={set("venue")} /></FormRow>
        <FormRow label={f.mode === "Online" ? "Joining link" : "Registration link (optional)"} error={fe.link}><FormInput placeholder="https://…" value={f.link} onChange={set("link")} /></FormRow>
        <div className="sm:col-span-2"><FormRow label="Contact" error={fe.contact}><FormInput placeholder="Phone or email for questions" value={f.contact} onChange={set("contact")} /></FormRow></div>
        <div className="sm:col-span-2">
          <FormRow label="Picture (optional)" error={fe.image || pictureError}>
            <div className="flex flex-wrap items-center gap-3">
              {f.image && <img src={f.image} alt="" className="h-[64px] w-[110px] rounded-[8px] object-cover" />}
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[color:var(--line)] px-4 py-[6px] text-[13px] hover:bg-[color:var(--subtle)]">
                <Upload size={13} /> {f.image ? "Replace" : "Upload"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {f.image && <button type="button" onClick={() => set("image")("")} className="inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-[6px] text-[13px] text-[#c8001a] hover:bg-[#ffe9e9]"><Trash2 size={13} /> Remove</button>}
            </div>
          </FormRow>
        </div>
        {error && Object.keys(fe).length === 0 && <p className="sm:col-span-2 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#ff0004]">{error.message}</p>}
        {Object.keys(fe).length > 0 && <p className="sm:col-span-2 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#ff0004]">Please fix the highlighted details.</p>}
      </div>
    </Modal>
  );
}
