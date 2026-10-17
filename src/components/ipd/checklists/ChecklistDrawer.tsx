"use client";

/**
 * One checklist, open: every line with a tick box (each tick records who and when), progress, and the buttons to
 * complete, cancel or print it. A heading with sub-lines is ticked through its sub-lines.
 */
import { useEffect, useRef, useState } from "react";
import { Check, Printer, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import { printElement } from "@/lib/print";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput } from "@/components/shared/FormRow";
import type { IpdChecklistDTO } from "@/types/api";
import { btn, done, when } from "@/components/ipd/nurse/shared";

export const STATUS_PILL: Record<IpdChecklistDTO["status"], string> = {
  "In progress": "bg-[#e8f1ff] text-[#0a5fc4]",
  Complete: "bg-[#dffff3] text-[#0b7a47]",
  Cancelled: "bg-[#ffe9e9] text-[#c8001a]",
};

function Box({ checked, disabled, onToggle, label }: { checked: boolean; disabled: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onToggle}
      className={`mt-[1px] flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${disabled ? "cursor-default" : "cursor-pointer"} ${checked ? "border-[color:var(--brand)] bg-[color:var(--brand)] text-white" : "border-[#b9bcc4] bg-[color:var(--surface)]"}`}>
      {checked && <Check size={13} strokeWidth={3} />}
    </button>
  );
}

export function ChecklistDrawer({ id, canWrite, onClose }: { id: number; canWrite: boolean; onClose: () => void }) {
  const { item: c, reload } = useItem<IpdChecklistDTO>(`/ipd/checklists/${id}`);
  const { run, loading, error, reset } = useMutation();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !cancelling) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, cancelling]);

  const open = c?.status === "In progress";
  const editable = open && canWrite;

  async function tick(key: string, next: boolean) {
    if (!(await done(run(() => api.post(`/ipd/checklists/${id}/tick`, { key, done: next }))))) return;
    reload();
  }
  async function complete() {
    if (!(await done(run(() => api.post(`/ipd/checklists/${id}/complete`))))) return;
    reload();
  }
  async function cancel() {
    if (!(await done(run(() => api.post(`/ipd/checklists/${id}/cancel`, { reason: reason.trim() }))))) return;
    setCancelling(false); setReason("");
    reload();
  }

  return (
    <div className="fixed inset-0 z-[55] flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={c?.name ?? "Checklist"} className="relative flex h-full w-[576px] max-w-full flex-col bg-[color:var(--surface)] shadow-2xl">
        <header className="flex items-start justify-between gap-3 px-6 pt-5 pb-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[color:var(--ink)]">{c?.name ?? "…"}</h2>
            {c && <p className="text-[13px] text-[color:var(--ink-soft)]">{c.patientName} · <span className="font-mono">{c.patientCode}</span></p>}
          </div>
          <div className="flex items-center gap-3">
            {c && <span className={`rounded-full px-3 py-[2px] text-[12px] font-medium ${STATUS_PILL[c.status]}`}>{c.status}</span>}
            <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer"><X size={18} /></button>
          </div>
        </header>

        {c && (
          <>
            <div className="flex items-center gap-3 px-6 pb-3">
              <div className="h-[6px] flex-1 rounded-full bg-[color:var(--subtle-2)] overflow-hidden"><div className="h-full bg-[color:var(--brand)]" style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }} /></div>
              <span className="font-mono text-[12px] text-[color:var(--ink)] whitespace-nowrap">{c.done} of {c.total}</span>
            </div>
            <div ref={printRef} className="min-h-0 flex-1 overflow-y-auto border-t border-[color:var(--line)] px-3 py-2">
              <div className="hidden print:block px-3 pb-2"><b>{c.name}</b> — {c.patientName} {c.patientCode} — {c.status}</div>
              {c.items.map((it) => {
                const kids = it.children ?? [];
                const tk = (k: string) => c.ticks[k];
                if (kids.length === 0) {
                  const t = tk(it.key);
                  return (
                    <div key={it.key} className="flex items-start gap-3 rounded-[8px] px-3 py-[10px] border-b border-[color:var(--line)] last:border-b-0">
                      <Box checked={Boolean(t?.done)} disabled={!editable || loading} onToggle={() => tick(it.key, !t?.done)} label={it.label} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] leading-[20px] text-[color:var(--ink)]">{it.label}{it.required && <span className="ml-[3px] text-[#e0001b]">*</span>}</p>
                        {t?.done && t.by && <p className="text-[11px] text-[color:var(--ink-soft)]">{t.by}{t.at ? ` · ${when(t.at)}` : ""}</p>}
                      </div>
                    </div>
                  );
                }
                const doneKids = kids.filter((k) => tk(k.key)?.done).length;
                return (
                  <div key={it.key} className="border-b border-[color:var(--line)] last:border-b-0">
                    <p className="px-3 pt-[10px] pb-1 text-[14px] font-semibold text-[color:var(--ink)]">
                      {it.label}{it.required && <span className="ml-[3px] text-[#e0001b]">*</span>} <span className="ml-1 font-mono text-[12px] font-normal text-[color:var(--ink-soft)]">{doneKids}/{kids.length}</span>
                    </p>
                    {kids.map((k) => {
                      const t = tk(k.key);
                      return (
                        <div key={k.key} className="flex items-start gap-3 rounded-[8px] pl-8 pr-3 py-[8px]">
                          <Box checked={Boolean(t?.done)} disabled={!editable || loading} onToggle={() => tick(k.key, !t?.done)} label={k.label} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] leading-[20px] text-[color:var(--ink)]">{k.label}</p>
                            {t?.done && t.by && <p className="text-[11px] text-[color:var(--ink-soft)]">{t.by}{t.at ? ` · ${when(t.at)}` : ""}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <p className="px-3 pt-3 pb-1 text-[12px] text-[color:var(--ink-soft)]">
                Started by {c.startedBy} · {when(c.startedAt)}
                {open && ` · ${c.requiredLeft} required left`}
                {c.status === "Complete" && c.completedBy && ` · completed by ${c.completedBy}${c.completedAt ? `, ${when(c.completedAt)}` : ""}`}
                {c.status === "Cancelled" && ` · cancelled${c.cancelledReason ? `: ${c.cancelledReason}` : ""}`}
              </p>
            </div>
            {error && <p role="alert" className="px-6 py-2 text-[12px] text-[#c8001a]">{error.message}</p>}
            <footer className="flex items-center justify-between gap-3 border-t border-[color:var(--line)] px-6 py-3">
              {editable ? (
                <button onClick={() => { setCancelling(true); reset(); }} className="inline-flex items-center gap-2 text-[13px] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] cursor-pointer">Cancel checklist</button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <button onClick={() => printElement(printRef.current, c.name)} className={`${btn.base} ${btn.ghost} !h-[36px] !px-4 !text-[13px]`}><Printer size={14} /> Print</button>
                {editable && (
                  <button onClick={complete} disabled={loading || c.requiredLeft > 0} title={c.requiredLeft > 0 ? `${c.requiredLeft} required lines are not done yet` : undefined}
                    className={`${btn.base} ${btn.solid} !h-[36px] !px-4 !text-[13px]`}><Check size={14} /> Mark complete</button>
                )}
              </div>
            </footer>
          </>
        )}
      </aside>

      <Modal open={cancelling} onClose={() => setCancelling(false)} title="Cancel this checklist?" width={440}
        footer={<>
          <button onClick={() => setCancelling(false)} className="text-[13px] text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Keep it</button>
          <button onClick={cancel} disabled={loading} className="text-[13px] text-white bg-[#c8001a] px-5 py-[8px] rounded-full hover:bg-[#a30015] transition-colors disabled:opacity-50">{loading ? "Cancelling…" : "Cancel checklist"}</button>
        </>}>
        <FormRow label="Reason" hint="Optional — e.g. started on the wrong patient"><FormInput value={reason} onChange={setReason} placeholder="Why is it being cancelled?" /></FormRow>
      </Modal>
    </div>
  );
}
