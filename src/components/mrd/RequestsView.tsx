"use client";

/**
 * File tracking → Requests. Wards and doctors ask MRD for a file; MRD dispatches it (the file goes in transit to the
 * requester) and marks it returned when it comes back. A file has at most one open request.
 */
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import type { MrdFileDTO, MrdFileRequestDTO, MrdLocationDTO } from "@/types/api";
import { attempt, DialogButtons, Empty, ErrorNote, fieldLabel, mono, outlineBtn, Pill, plusDays, primaryBtn, td, th, todayLocal } from "@/components/mrd/shared";

const RANK: Record<string, number> = { Pending: 0, Dispatched: 1, Returned: 2, Cancelled: 3 };

function RequestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items: files } = useList<MrdFileDTO>(open ? "/mrd/files" : null, { all: true });
  const { items: locations } = useList<MrdLocationDTO>(open ? "/mrd/locations" : null);
  const { run, loading, error, reset } = useMutation();
  const [fileId, setFileId] = useState("");
  const [urgency, setUrgency] = useState("Routine");
  const [forWho, setForWho] = useState("");
  const [dest, setDest] = useState("");
  const [note, setNote] = useState("");
  const close = () => { reset(); onClose(); };
  async function submit() {
    const ok = await attempt(run(() => api.post("/mrd/requests", {
      fileId: Number(fileId), urgency, requestedFor: forWho.trim() || undefined, destinationId: dest ? Number(dest) : undefined, note: note.trim() || undefined,
    })));
    if (!ok) return;
    setFileId(""); setForWho(""); setDest(""); setNote(""); setUrgency("Routine"); close();
  }
  return (
    <Modal open={open} onClose={close} width={460} title="Request a file" subtitle="MRD dispatches it to the person or place you name."
      footer={<DialogButtons onCancel={close} onConfirm={submit} label="Request" loading={loading} disabled={!fileId} />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={fieldLabel}>File</span>
          <SearchSelect placeholder="Search by file number or patient…" value={fileId} onChange={setFileId}
            options={files.filter((f) => f.status !== "Archived").map((f) => ({ value: String(f.id), label: `${f.fileNo} — ${f.patientName}`, hint: f.patientCode }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Urgency</span><FormSelect value={urgency} onChange={setUrgency} options={[{ value: "Routine", label: "Routine" }, { value: "Urgent", label: "Urgent" }]} /></div>
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Needed by</span><FormInput value={forWho} onChange={setForWho} placeholder="Doctor / ward / desk" /></div>
        </div>
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Send to (optional)</span>
          <FormSelect value={dest} onChange={setDest} placeholder="Choose a location" options={locations.filter((l) => l.active && l.kind !== "Archive room").map((l) => ({ value: String(l.id), label: l.name }))} />
        </div>
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Note (optional)</span><FormInput value={note} onChange={setNote} /></div>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

function DispatchDialog({ request, onClose }: { request: MrdFileRequestDTO | null; onClose: () => void }) {
  const { run, loading, error, reset } = useMutation();
  const [due, setDue] = useState(request?.urgency === "Urgent" ? plusDays(2) : plusDays(7));
  if (!request) return null;
  const close = () => { reset(); onClose(); };
  async function submit() { if (await attempt(run(() => api.post(`/mrd/requests/${request!.id}/dispatch`, { dueOn: due })))) close(); }
  return (
    <Modal open onClose={close} width={420} title={`Dispatch ${request.fileNo}`} subtitle={`${request.patientName} → ${request.destinationName || request.requestedFor || request.requestedBy}`}
      footer={<DialogButtons onCancel={close} onConfirm={submit} label="Dispatch" loading={loading} disabled={!due} />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Due back</span><FormInput type="date" value={due} onChange={setDue} min={todayLocal()} /></div>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

export function RequestsView({ canWrite }: { canWrite: boolean }) {
  const { items, loading } = useList<MrdFileRequestDTO>("/mrd/requests", { all: true });
  const { run, error, reset } = useMutation();
  const [asking, setAsking] = useState(false);
  const [dispatching, setDispatching] = useState<MrdFileRequestDTO | null>(null);
  const rows = useMemo(() => [...items].sort((a, b) => (RANK[a.status] - RANK[b.status]) || (a.requestedOn < b.requestedOn ? 1 : a.requestedOn > b.requestedOn ? -1 : b.id - a.id)), [items]);

  async function act(id: number, what: "cancel" | "return") { reset(); await attempt(run(() => api.post(`/mrd/requests/${id}/${what}`))); }

  return (
    <div className="px-5 pb-5 pt-4">
      <div className="mb-3 flex items-center gap-3">
        <ErrorNote message={error?.message} />
        {canWrite && <button onClick={() => setAsking(true)} className={`${primaryBtn} ml-auto`}><Plus size={15} /> Request file</button>}
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
        <table className="w-full min-w-[820px] text-left">
          <thead><tr className="border-b border-[color:var(--line)]">{["File no", "Patient", "Urgency", "Status", "Requested", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                <td className={`${td} ${mono}`}>{r.fileNo}</td>
                <td className={td}>{r.patientName}{r.requestedFor && <span className="block text-[12px] text-[color:var(--ink-soft)]">for {r.requestedFor}{r.destinationName ? ` · ${r.destinationName}` : ""}</span>}</td>
                <td className={td}><Pill>{r.urgency}</Pill></td>
                <td className={td}><Pill>{r.status}</Pill></td>
                <td className={`${td} ${mono}`}>{r.requestedOn}</td>
                <td className={`${td} text-right`}>
                  {canWrite && r.status === "Pending" && (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { reset(); setDispatching(r); }} className={outlineBtn}>Dispatch</button>
                      <button onClick={() => act(r.id, "cancel")} className="h-[30px] px-2 text-[13px] text-[color:var(--ink)] hover:underline cursor-pointer">Cancel</button>
                    </div>
                  )}
                  {canWrite && r.status === "Dispatched" && <button onClick={() => act(r.id, "return")} className={outlineBtn}>Mark returned</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <Empty>No file requests yet.</Empty>}
      </div>
      <RequestDialog open={asking} onClose={() => setAsking(false)} />
      <DispatchDialog key={dispatching?.id} request={dispatching} onClose={() => setDispatching(null)} />
    </div>
  );
}
