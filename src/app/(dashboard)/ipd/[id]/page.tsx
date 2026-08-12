"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import type { IpdRecordDTO, IpdNoteDTO, IpdMedicationDTO } from "@/types/api";
import { TabBar } from "@/components/shared/TabBar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Bed, Stethoscope, Calendar, ClipboardList, Trash2 } from "lucide-react";
import { formatDate, todayIso, toIsoDate } from "@/lib/dates";
import { FormRow, FormInput } from "@/components/shared/FormRow";





const TABS = [
  { id: "notes",      label: "Daily Notes" },
  { id: "medication", label: "Medication Chart" },
  { id: "diet",       label: "Diet Chart" },
  { id: "rounds",     label: "Doctor Rounds" },
  { id: "discharge",  label: "Discharge" },
];



/** Shared timeline for daily notes, doctor rounds and the diet chart. */
function NotesTab({
  admissionId, noteType, title, placeholder, searchable,
}: {
  admissionId: number;
  noteType: "Daily Note" | "Doctor Round" | "Diet";
  title: string;
  placeholder: string;
  searchable?: boolean;
}) {
  const { items: notes, reload } = useList<IpdNoteDTO>("/ipd/notes", {
    all: true, admission_id: admissionId, note_type: noteType,
  });
  const { run, loading } = useMutation();
  const [content, setContent] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  // Doctor Rounds are captured as two distinct fields rather than one free-text blob.
  const isRounds = noteType === "Doctor Round";
  const [findings, setFindings] = useState("");
  const [orders, setOrders] = useState("");
  const roundsEmpty = !findings.trim() && !orders.trim();

  const visible = search.trim()
    ? notes.filter(n =>
        n.content.toLowerCase().includes(search.toLowerCase()) ||
        n.author.toLowerCase().includes(search.toLowerCase()))
    : notes;

  async function add() {
    const combined = isRounds
      ? [findings.trim() && `Findings: ${findings.trim()}`, orders.trim() && `Orders: ${orders.trim()}`]
          .filter(Boolean).join("\n\n")
      : content.trim();
    if (!combined) return;
    await run(() => api.post("/ipd/notes", { admissionId, noteType, content: combined }));
    setContent(""); setFindings(""); setOrders("");
    reload();
  }
  async function saveEdit(id: number) {
    await run(() => api.patch(`/ipd/notes/${id}`, { content: editText }));
    setEditingId(null);
    reload();
  }
  async function remove(id: number) {
    await run(() => api.del(`/ipd/notes/${id}`));
    reload();
  }

  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-medium text-[#11111c]">{title}</h3>
        {searchable && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rounds by text or doctor…"
            className="h-[36px] w-[280px] bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-3 text-[13px] outline-none focus:border-[#009598]"
          />
        )}
      </div>

      {/* Add new entry */}
      <div className="border border-[#dedee1] rounded-[10px] p-4">
        {isRounds ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider block mb-1">Findings</label>
              <textarea
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
                placeholder="Clinical findings on this round…"
                className="w-full min-h-[64px] text-[13px] text-[#11111c] border border-[#dedee1] rounded-[8px] p-3 outline-none focus:border-[#009598] resize-y"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider block mb-1">Orders</label>
              <textarea
                value={orders}
                onChange={(e) => setOrders(e.target.value)}
                placeholder="Orders / instructions…"
                className="w-full min-h-[64px] text-[13px] text-[#11111c] border border-[#dedee1] rounded-[8px] p-3 outline-none focus:border-[#009598] resize-y"
              />
            </div>
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            className="w-full min-h-[72px] text-[13px] text-[#11111c] border border-[#dedee1] rounded-[8px] p-3 outline-none focus:border-[#009598] resize-y"
          />
        )}
        <div className="flex justify-end mt-2">
          <button onClick={add} disabled={loading || (isRounds ? roundsEmpty : !content.trim())}
            className="text-[13px] text-white bg-[#009598] px-4 py-[7px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
            {loading ? "Saving…" : `Add ${noteType === "Diet" ? "diet entry" : noteType.toLowerCase()}`}
          </button>
        </div>
      </div>

      {visible.length === 0 && (
        <p className="text-[13px] font-light text-[#57575f]">
          {search.trim() ? "No entries match that search." : "No entries recorded yet."}
        </p>
      )}

      {visible.map(n => (
        <div key={n.id} className="p-4 border border-[#dedee1] rounded-[10px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-medium text-[#11111c]">
              {formatDate(n.date)}{n.time ? ` · ${n.time}` : ""}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-light text-[#57575f]">By: {n.author}</span>
              {editingId === n.id ? (
                <button onClick={() => saveEdit(n.id)} className="text-[12px] text-[#009598] hover:underline">Save</button>
              ) : (
                <button onClick={() => { setEditingId(n.id); setEditText(n.content); }}
                  className="text-[12px] text-[#57575f] hover:text-[#11111c]">Edit</button>
              )}
              <button onClick={() => remove(n.id)} className="text-[#c8c8cc] hover:text-[#ff0004] transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          {editingId === n.id ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full min-h-[72px] text-[13px] border border-[#dedee1] rounded-[8px] p-3 outline-none focus:border-[#009598] resize-y"
            />
          ) : (
            <p className="text-[13px] font-normal text-[#57575f] leading-relaxed whitespace-pre-wrap">{n.content}</p>
          )}
        </div>
      ))}
    </div>
  );
}

const MED_STATUS_CLR: Record<string, string> = {
  Active:    "bg-[#dffff3] text-[#00955c]",
  Stopped:   "bg-[#ffe9e9] text-[#ff0004]",
  Completed: "bg-[#f0f0f0] text-[#57575f]",
};

/** Editable medication chart for an admission. */
function MedicationTab({ admissionId }: { admissionId: number }) {
  const { items: meds, reload } = useList<IpdMedicationDTO>("/ipd/medications", {
    all: true, admission_id: admissionId,
  });
  const { run, loading } = useMutation();
  const [form, setForm] = useState({ medicineName: "", dosage: "", frequency: "", route: "Oral" });
  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function add() {
    if (!form.medicineName.trim()) return;
    await run(() => api.post("/ipd/medications", { admissionId, ...form }));
    setForm({ medicineName: "", dosage: "", frequency: "", route: "Oral" });
    reload();
  }
  async function update(id: number, patch: Record<string, unknown>) {
    await run(() => api.patch(`/ipd/medications/${id}`, patch));
    reload();
  }
  async function remove(id: number) {
    await run(() => api.del(`/ipd/medications/${id}`));
    reload();
  }

  return (
    <div className="p-5 flex flex-col gap-4">
      <h3 className="text-[14px] font-medium text-[#11111c]">Medication Chart</h3>

      <div className="border border-[#dedee1] rounded-[10px] p-4 grid gap-2" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr auto" }}>
        <input value={form.medicineName} onChange={(e) => set("medicineName", e.target.value)} placeholder="Medicine"
          className="text-[13px] bg-[#f6f6f6] border border-transparent rounded-[8px] px-3 py-2 outline-none focus:border-[#009598] focus:bg-white" />
        <input value={form.dosage} onChange={(e) => set("dosage", e.target.value)} placeholder="Dosage (500mg)"
          className="text-[13px] bg-[#f6f6f6] border border-transparent rounded-[8px] px-3 py-2 outline-none focus:border-[#009598] focus:bg-white" />
        <input value={form.frequency} onChange={(e) => set("frequency", e.target.value)} placeholder="Frequency (1-0-1)"
          className="text-[13px] bg-[#f6f6f6] border border-transparent rounded-[8px] px-3 py-2 outline-none focus:border-[#009598] focus:bg-white" />
        <select value={form.route} onChange={(e) => set("route", e.target.value)}
          className="text-[13px] bg-[#f6f6f6] border border-transparent rounded-[8px] px-3 py-2 outline-none focus:border-[#009598] focus:bg-white">
          {["Oral", "IV", "IM", "SC", "Topical", "Inhaled"].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={add} disabled={loading || !form.medicineName.trim()}
          className="text-[13px] text-white bg-[#009598] px-4 rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50 whitespace-nowrap">
          Add
        </button>
      </div>

      <div className="border border-[#dedee1] rounded-[10px] overflow-hidden">
        <div className="grid items-center px-4 h-10 bg-[#f2f3f3] text-[12px] font-medium text-[#11111c]"
          style={{ gridTemplateColumns: "1.8fr 1fr 1fr 0.8fr 1.4fr 1fr auto" }}>
          <span>Medicine</span><span>Dosage</span><span>Frequency</span><span>Route</span>
          <span>Last given</span><span>Status</span><span></span>
        </div>
        {meds.length === 0 && (
          <div className="py-8 text-center text-[13px] text-[#57575f]">No medicines charted yet.</div>
        )}
        {meds.map(m => (
          <div key={m.id} className="grid items-center px-4 h-[54px] border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa] transition-colors"
            style={{ gridTemplateColumns: "1.8fr 1fr 1fr 0.8fr 1.4fr 1fr auto" }}>
            <span className="text-[13px] font-medium text-[#11111c] truncate">{m.medicineName}</span>
            <span className="text-[13px] text-[#57575f]">{m.dosage || "—"}</span>
            <span className="text-[13px] text-[#57575f]">{m.frequency || "—"}</span>
            <span className="text-[13px] text-[#57575f]">{m.route}</span>
            <span className="text-[12px] text-[#57575f]">{m.lastGivenAt || "—"}</span>
            <select
              value={m.status}
              onChange={(e) => update(m.id, { status: e.target.value })}
              className={`text-[11px] w-fit rounded-full px-[8px] py-[3px] outline-none border-0 ${MED_STATUS_CLR[m.status] ?? ""}`}
            >
              {["Active", "Stopped", "Completed"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex items-center gap-2 justify-end">
              <button onClick={() => update(m.id, { markGiven: true })}
                className="text-[11px] text-[#009598] border border-[#009598] px-2 py-[3px] rounded-full hover:bg-[#e8f7f7] transition-colors whitespace-nowrap">
                Mark given
              </button>
              <button onClick={() => remove(m.id)} className="text-[#c8c8cc] hover:text-[#ff0004] transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Discharge summary — persists the summary and frees the bed. */
function DischargeTab({ record, onDischarged }: { record: IpdRecordDTO; onDischarged: () => void }) {
  const { run, loading, error } = useMutation();
  const discharged = record.status === "Discharged";
  const [form, setForm] = useState({
    dischargeDate: todayIso(),
    condition: "",
    summary: "",
    followUp: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function confirm() {
    // The summary is kept as a Daily Note so it stays on the admission record.
    if (form.summary.trim() || form.condition.trim()) {
      await run(() => api.post("/ipd/notes", {
        admissionId: record.id,
        noteType: "Daily Note",
        date: form.dischargeDate,
        content:
          `DISCHARGE SUMMARY
Condition at discharge: ${form.condition || "—"}
` +
          `${form.summary}
${form.followUp ? `Follow-up: ${form.followUp}` : ""}`.trim(),
      }));
    }
    await run(() => api.post(`/ipd/${record.id}/discharge`));
    onDischarged();
  }

  return (
    <div className="p-5 flex flex-col gap-4" style={{ maxWidth: 720 }}>
      <h3 className="text-[14px] font-medium text-[#11111c]">Discharge</h3>

      <div className="grid grid-cols-2 gap-4">
        <FormRow label="Discharge Date">
          <input
            type="date"
            value={form.dischargeDate}
            min={toIsoDate(record.admissionDate) || undefined}
            onChange={(e) => set("dischargeDate", e.target.value)}
            disabled={discharged}
            className="h-[42px] w-full bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-[14px] text-[14px] outline-none focus:border-[#009598] disabled:opacity-50"
          />
        </FormRow>
        <FormRow label="Condition at Discharge">
          <FormInput value={form.condition} onChange={v => set("condition", v)} placeholder="Stable / Improved / LAMA" />
        </FormRow>
      </div>

      <FormRow label="Discharge Summary">
        <textarea
          value={form.summary}
          onChange={(e) => set("summary", e.target.value)}
          disabled={discharged}
          placeholder="Course in hospital, procedures, medications on discharge…"
          className="w-full min-h-[120px] text-[13px] border border-[#dedee1] rounded-[8px] p-3 outline-none focus:border-[#009598] resize-y disabled:opacity-50"
        />
      </FormRow>

      <FormRow label="Follow-up Advice">
        <FormInput value={form.followUp} onChange={v => set("followUp", v)} placeholder="Review after 7 days with reports" />
      </FormRow>

      {error && <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}

      <div className="flex justify-end">
        <button onClick={confirm} disabled={loading || discharged}
          className="text-[14px] text-white bg-[#009598] px-6 py-[10px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
          {discharged ? "Discharged" : loading ? "Discharging…" : "Confirm Discharge"}
        </button>
      </div>
    </div>
  );
}

export default function IpdDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState("notes");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { item: record, loading, reload } = useItem<IpdRecordDTO>(`/ipd/${id}`);
  useBreadcrumb("/ipd", "IPD", record?.patientName ?? "Admission");
  const { run, loading: acting } = useMutation();

  async function discharge() {
    await run(() => api.post(`/ipd/${id}/discharge`));
    setConfirmOpen(false);
    reload();
  }

  if (loading) {
    return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] font-normal text-[#57575f]">Loading…</p></div>;
  }
  if (!record) {
    return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] font-normal text-[#57575f]">IPD record not found.</p></div>;
  }

  const days = 4;

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        title="Discharge patient"
        message={`Discharge ${record.patientName} and free bed ${record.bed}?`}
        confirmLabel="Discharge"
        danger={false}
        loading={acting}
        onConfirm={discharge}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Admission banner */}
      <div className={`${tw.gutterX} mb-5`}>
        <div className={`${tw.surface.card} ${tw.radius.card} p-5`}>
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#e8f7f7] rounded-full flex items-center justify-center text-[18px] font-medium text-[#009598]">
                  {record.patientName.split(" ").map((n:string) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="text-[18px] font-medium text-[#11111c]">{record.patientName}</p>
                  <p className="text-[13px] font-light text-[#57575f]">{record.patientId} · {record.patientAge} yrs</p>
                </div>
                <StatusBadge status={record.status} />
              </div>
              <div className="flex items-center gap-6 flex-wrap">
                {[
                  { icon: Stethoscope, label: "Doctor",       value: record.doctor },
                  { icon: Bed,         label: "Ward / Bed",   value: `${record.ward} · ${record.bed}` },
                  { icon: Calendar,    label: "Admission",    value: formatDate(record.admissionDate) },
                  { icon: ClipboardList,label:"Diagnosis",     value: record.diagnosis },
                ].map(f => (
                  <div key={f.label} className="flex items-center gap-2">
                    <f.icon size={14} className="text-[#57575f]" strokeWidth={1.5} />
                    <span className="text-[12px] font-normal text-[#57575f]">{f.label}:</span>
                    <span className="text-[13px] font-medium text-[#11111c]">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className="text-[12px] font-normal text-[#57575f]">Day {days} of admission</span>
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={record.status === "Discharged"}
                className="text-[12px] font-normal text-[#ff9000] border border-[#ff9000] px-4 py-[6px] rounded-full hover:bg-[#fff2e0] transition-colors disabled:opacity-40">
                {record.status === "Discharged" ? "Discharged" : "Initiate Discharge"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 500 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />

          {tab === "notes"      && <NotesTab admissionId={record.id} noteType="Daily Note" title="Daily Nursing Notes" placeholder="Vitals, intake/output, observations…" />}
          {tab === "medication" && <MedicationTab admissionId={record.id} />}
          {tab === "diet"       && <NotesTab admissionId={record.id} noteType="Diet" title="Diet Chart" placeholder="Diet plan for the day — e.g. Diabetic diet, low salt, soft foods…" />}
          {tab === "rounds"     && <NotesTab admissionId={record.id} noteType="Doctor Round" title="Doctor Rounds" placeholder="Findings, plan, orders…" searchable />}
          {tab === "discharge"  && <DischargeTab record={record} onDischarged={reload} />}
        </div>
      </div>
    </>
  );
}
