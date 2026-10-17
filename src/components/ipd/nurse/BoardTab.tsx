"use client";

/**
 * The board: alerts (worked out fresh from the ward's records — a nurse can only acknowledge or dismiss them),
 * this shift's tasks and reminders, and the patients on the ward with what each is waiting for.
 */
import { useState } from "react";
import Link from "next/link";
import { Check, Plus, Undo2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormRow, FormSelect } from "@/components/shared/FormRow";
import type { IpdAlertDTO, IpdAlertKind, IpdNursingTaskDTO, NurseBoardDTO } from "@/types/api";
import { btn, cardCls, Empty, sectionTitle, useAutoRefresh, when, type WardPatient, done } from "@/components/ipd/nurse/shared";

const KIND_STYLE: Record<IpdAlertKind, string> = {
  "Critical vitals": "border-[#f4a3ac] bg-[#ffe3e5] text-[#b3001b]",
  "Dose missed": "border-[#f3cf7d] bg-[#fff2d6] text-[#8a5300]",
  "Dose held": "border-[#f3cf7d] bg-[#fff2d6] text-[#8a5300]",
  "IV bottle": "border-[#f3cf7d] bg-[#fff2d6] text-[#8a5300]",
  "New order": "border-[#b9d3ff] bg-[#e8f1ff] text-[#0a5fc4]",
  "Nursing task": "border-[#f3cf7d] bg-[#fff2d6] text-[#8a5300]",
};

const chip = (active: boolean) =>
  `inline-flex items-center gap-[5px] h-[26px] px-3 rounded-full border text-[12px] whitespace-nowrap cursor-pointer transition-colors ${
    active ? "bg-[color:var(--ink)] border-[color:var(--ink)] text-[color:var(--surface)]" : "bg-[color:var(--surface)] border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"
  }`;

function AlertCard({ a, canWrite, onAct }: { a: IpdAlertDTO; canWrite: boolean; onAct: (key: string, action: "Acknowledged" | "Dismissed") => void }) {
  return (
    <div className={`rounded-[10px] border px-3 py-[10px] ${a.severity === "critical" ? "border-[#f4a3ac] border-l-4" : "border-[color:var(--line)]"} bg-[color:var(--surface)]`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`inline-flex items-center rounded-full border px-2 text-[11px] font-medium ${KIND_STYLE[a.kind]}`}>{a.kind}</span>
        <span className="font-mono text-[11px] text-[color:var(--ink-soft)] whitespace-nowrap">{when(a.at)}</span>
      </div>
      <p className="mt-1 text-[14px] font-semibold text-[color:var(--ink)] leading-[19px]">{a.title}</p>
      <p className="text-[12px] text-[color:var(--ink-soft)]">
        {a.patientName} <span className="font-mono">{a.patientCode}</span>
      </p>
      {a.detail && <p className="mt-[2px] text-[12px] text-[color:var(--ink)]">{a.detail}</p>}
      {canWrite && (
        <div className="mt-2 flex gap-2">
          <button onClick={() => onAct(a.key, "Acknowledged")} className={`${btn.base} ${btn.ghost}`}>Acknowledge</button>
          <button onClick={() => onAct(a.key, "Dismissed")} className="h-[30px] px-3 text-[12px] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] cursor-pointer">Dismiss</button>
        </div>
      )}
    </div>
  );
}

function TaskDialog({ open, onClose, patients }: { open: boolean; onClose: () => void; patients: WardPatient[] }) {
  const { run, loading, error, reset } = useMutation();
  const [title, setTitle] = useState("");
  const [patient, setPatient] = useState("");
  const [due, setDue] = useState("");
  const close = () => { reset(); onClose(); };
  async function save() {
    if (!(await done(run(() => api.post("/ipd/nurse/tasks", {
      title: title.trim(),
      admissionId: patient ? Number(patient) : undefined,
      dueAt: due ? new Date(due).toISOString() : undefined,
    }))))) return;
    setTitle(""); setPatient(""); setDue("");
    close();
  }
  return (
    <Modal open={open} onClose={close} title="Add a reminder" width={460}
      footer={<>
        <button onClick={close} className="text-[13px] text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
        <button onClick={save} disabled={loading || title.trim().length < 2} className="text-[13px] text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">{loading ? "Saving…" : "Add"}</button>
      </>}>
      <div className="flex flex-col gap-4">
        <FormRow label="What needs doing" required><FormInput placeholder="e.g. Change dressing, check the crash cart" value={title} onChange={setTitle} /></FormRow>
        <FormRow label="Patient" hint="Leave empty for a ward job"><FormSelect placeholder="No patient" value={patient} onChange={setPatient}
          options={[{ value: "", label: "No patient" }, ...patients.map((p) => ({ value: String(p.adm.id), label: `${p.adm.patientName}${p.adm.bed ? ` · ${p.adm.bed}` : ""}` }))]} /></FormRow>
        <FormRow label="Due" hint="Optional — a patient task past its time raises an alert"><FormInput type="datetime-local" value={due} onChange={setDue} /></FormRow>
        {error && <p role="alert" className="text-[12px] text-[#c8001a]">{error.message}</p>}
      </div>
    </Modal>
  );
}

export function BoardTab({ patients, canWrite }: { patients: WardPatient[]; canWrite: boolean }) {
  const { item: board, reload } = useItem<NurseBoardDTO>("/ipd/nurse/board");
  const [taskView, setTaskView] = useState<"To do" | "Done">("To do");
  const { items: finishedTasks, reload: reloadDone } = useList<IpdNursingTaskDTO>("/ipd/nurse/tasks", { status: "Done" });
  const [kind, setKind] = useState<IpdAlertKind | "All">("All");
  const [adding, setAdding] = useState(false);
  const { run } = useMutation();
  const refresh = () => { reload(); reloadDone(); };
  useAutoRefresh(refresh);

  const ids = new Set(patients.map((p) => p.adm.id));
  const byId = new Map(patients.map((p) => [p.adm.id, p.adm]));
  const alerts = (board?.alerts ?? []).filter((a) => ids.has(a.admissionId));
  const kinds = [...new Set(alerts.map((a) => a.kind))];
  const shown = kind === "All" ? alerts : alerts.filter((a) => a.kind === kind);
  const bulk = shown.filter((a) => a.severity !== "critical");
  const tasks = (taskView === "To do" ? board?.tasks ?? [] : finishedTasks).filter((t) => t.admissionId == null || ids.has(t.admissionId));

  async function ack(keys: string[], action: "Acknowledged" | "Dismissed") {
    if (!(await done(run(() => api.post("/ipd/nurse/alerts/ack", { keys, action }))))) return;
    refresh();
  }
  async function toggleTask(t: IpdNursingTaskDTO) {
    if (!(await done(run(() => api.post(`/ipd/nurse/tasks/${t.id}/done`, t.status === "Done" ? { undo: true } : {}))))) return;
    refresh();
  }

  return (
    <div className="grid gap-5 p-5 items-start" style={{ gridTemplateColumns: "minmax(0,1.25fr) minmax(0,1fr) minmax(0,1fr)" }}>
      {/* Alerts */}
      <section className="min-w-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className={sectionTitle}>Alerts <span className="font-mono text-[12px] text-[color:var(--ink-soft)]">({alerts.length})</span></h2>
          {canWrite && bulk.length > 0 && (
            <button onClick={() => ack(bulk.map((a) => a.key), "Acknowledged")} className="text-[12px] font-medium text-[color:var(--ink)] hover:underline cursor-pointer">
              OK all {bulk.length} shown
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <button onClick={() => setKind("All")} className={chip(kind === "All")}>All <span className="font-mono text-[11px] opacity-70">{alerts.length}</span></button>
          {kinds.map((k) => (
            <button key={k} onClick={() => setKind(k)} className={chip(kind === k)}>{k} <span className="font-mono text-[11px] opacity-70">{alerts.filter((a) => a.kind === k).length}</span></button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {shown.length === 0 ? <Empty>All clear — nothing needs you right now.</Empty> : shown.map((a) => (
            <AlertCard key={a.key} a={a} canWrite={canWrite} onAct={(k, act) => ack([k], act)} />
          ))}
        </div>
      </section>

      {/* This shift */}
      <section className="min-w-0">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className={sectionTitle}>This shift</h2>
          <div className="flex items-center gap-2">
            <div role="group" aria-label="Task status" className="inline-flex p-[3px] rounded-[8px] bg-[color:var(--subtle)]">
              {(["To do", "Done"] as const).map((v) => (
                <button key={v} onClick={() => setTaskView(v)} aria-pressed={taskView === v}
                  className={`h-[26px] px-3 rounded-[6px] text-[12px] cursor-pointer ${taskView === v ? "bg-[color:var(--surface)] text-[color:var(--ink)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>{v}</button>
              ))}
            </div>
            {canWrite && <button onClick={() => setAdding(true)} className={`${btn.base} ${btn.ghost}`}><Plus size={13} /> Reminder</button>}
          </div>
        </div>
        {tasks.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[color:var(--line)] py-8 text-center text-[13px] text-[color:var(--ink-soft)]">
            {taskView === "To do" ? "Nothing to do right now." : "Nothing finished yet this shift."}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((t) => {
              const adm = t.admissionId != null ? byId.get(t.admissionId) : undefined;
              return (
                <li key={t.id} className={`${cardCls} flex items-start gap-3 px-3 py-[10px]`}>
                  {canWrite && (
                    <button onClick={() => toggleTask(t)} aria-label={t.status === "Done" ? "Put back on the list" : "Mark done"}
                      className={`mt-[1px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border cursor-pointer ${t.status === "Done" ? "border-[#0b7a47] bg-[#dffff3] text-[#0b7a47]" : "border-[color:var(--line)] text-transparent hover:text-[color:var(--ink-soft)]"}`}>
                      {t.status === "Done" ? <Undo2 size={12} /> : <Check size={12} />}
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-[14px] leading-[19px] ${t.status === "Done" ? "text-[color:var(--ink-soft)] line-through" : "text-[color:var(--ink)]"}`}>{t.title}</p>
                    <p className="text-[12px] text-[color:var(--ink-soft)]">
                      {adm ? `${adm.patientName}${adm.bed ? ` · ${adm.bed}` : ""}` : "Ward"}
                      {t.dueAt && <span className={t.overdue ? "text-[#c8001a] font-medium" : ""}> · {t.overdue ? "was due " : "due "}{when(t.dueAt)}</span>}
                      {t.status === "Done" && t.doneBy && <> · {t.doneBy}</>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Patients */}
      <section className="min-w-0">
        <h2 className={`${sectionTitle} mb-3`}>Patients <span className="font-mono text-[12px] text-[color:var(--ink-soft)]">({patients.length})</span></h2>
        {patients.length === 0 ? <Empty>No patients in this view.</Empty> : (
          <ul className="flex flex-col gap-2">
            {patients.map(({ adm, live }) => (
              <li key={adm.id} className={`${cardCls} px-3 py-[10px]`}>
                <Link href={`/ipd/${adm.id}`} className="block">
                  <p className="text-[12px] text-[color:var(--ink-soft)]"><span className="font-mono">{adm.ward}{adm.bed ? ` / ${adm.bed}` : ""}</span></p>
                  <p className="text-[14px] font-semibold text-[color:var(--ink)] leading-[19px]">{adm.patientName} <span className="font-mono text-[12px] font-normal text-[color:var(--ink-soft)]">{adm.patientId}</span></p>
                  <p className="text-[12px] text-[color:var(--ink-soft)]">{adm.doctor || "No doctor yet"}</p>
                </Link>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {!adm.primaryNurse && <span className="text-[12px] text-[color:var(--ink-soft)]">No nurse assigned</span>}
                  {adm.primaryNurse && <span className="text-[12px] text-[color:var(--ink-soft)]">{adm.primaryNurse}</span>}
                  {live && live.newOrders > 0 && <span className="rounded-full border border-[#b9d3ff] bg-[#e8f1ff] px-2 text-[11px] font-medium text-[#0a5fc4]">{live.newOrders} new {live.newOrders === 1 ? "order" : "orders"}</span>}
                  {live && live.dosesMissed > 0 && <span className="rounded-full border border-[#f3cf7d] bg-[#fff2d6] px-2 text-[11px] font-medium text-[#8a5300]">{live.dosesMissed} missed</span>}
                  {live?.vitalsDue && <span className="rounded-full border border-[color:var(--line)] px-2 text-[11px] text-[color:var(--ink)]">Vitals due</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <TaskDialog open={adding} onClose={() => setAdding(false)} patients={patients} />
    </div>
  );
}
