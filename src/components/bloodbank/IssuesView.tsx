"use client";

/**
 * Issues: units handed over for a patient, from a compatible cross-match. Each is then transfused, or returned
 * (back on the shelf if still inside the cold-chain window, otherwise wasted). A transfusion reaction can be
 * recorded against any issue, before or after.
 */
import { useState } from "react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { usePagination } from "@/components/shared/Pagination";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import type { BloodTransfusionDTO } from "@/types/api";
import { btn, Empty, mono, REACTION_KINDS, SectionHead, stamp, td, th } from "@/components/bloodbank/shared";

async function attempt(p: Promise<unknown>) { try { await p; return true; } catch { return false; } }
const label = "text-[14px] font-medium text-[color:var(--ink)]";
const cancelBtn = "h-[36px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 text-[13px] font-medium text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer";

function ReactionDialog({ issue, onClose, onDone }: { issue: BloodTransfusionDTO | null; onClose: () => void; onDone: () => void }) {
  const { run, loading, error, reset } = useMutation();
  const [kind, setKind] = useState("");
  const [severity, setSeverity] = useState<"Mild" | "Moderate" | "Severe">("Mild");
  const [note, setNote] = useState("");
  const close = () => { reset(); setKind(""); setNote(""); setSeverity("Mild"); onClose(); };
  async function record() {
    if (!(await attempt(run(() => api.post(`/blood-bank/issues/${issue!.id}/reaction`, { kind, severity, note: note.trim() }))))) return;
    onDone(); close();
  }
  return (
    <Modal open={!!issue} onClose={close} width={460} title={issue ? `Transfusion reaction — ${issue.issueNo}` : ""}
      subtitle={issue ? `${issue.patientName} · ${issue.unitNo} ${issue.unitGroup}. Stop the transfusion first if it is still running.` : ""}
      footer={<>
        <button onClick={close} className={cancelBtn}>Cancel</button>
        <button onClick={record} disabled={loading || !kind || (kind === "Other" && !note.trim())} className="h-[36px] rounded-[8px] bg-[#c8001a] px-5 text-[13px] font-medium text-white hover:bg-[#a30015] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{loading ? "Saving…" : "Record reaction"}</button>
      </>}>
      <div className="flex flex-col gap-4">
        {issue && issue.reactions.length > 0 && (
          <ul className="rounded-[10px] border border-[color:var(--line)] divide-y divide-[color:var(--line)]">
            {issue.reactions.map((r, i) => (
              <li key={i} className="px-4 py-2 text-[13px]"><span className="font-medium">{r.kind}</span> · {r.severity} <span className="text-[color:var(--ink-soft)]">· {stamp(r.at)} · {r.by}</span>{r.note && <p className="text-[12px] text-[color:var(--ink-soft)]">{r.note}</p>}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2"><span className={label}>Reaction</span><FormSelect placeholder="Pick the kind" value={kind} onChange={setKind} options={REACTION_KINDS.map((k) => ({ value: k, label: k }))} /></div>
        <div className="flex flex-col gap-2"><span className={label}>Severity</span>
          <div className="flex gap-2" role="radiogroup" aria-label="Severity">
            {(["Mild", "Moderate", "Severe"] as const).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={severity === s} onClick={() => setSeverity(s)}
                className={`h-[30px] px-4 rounded-full border text-[13px] cursor-pointer ${severity === s ? (s === "Severe" ? "bg-[#ffe3e5] border-[#f4a3ac] text-[#b3001b] font-medium" : "bg-[color:var(--subtle-2)] border-[color:var(--line)] font-medium text-[color:var(--ink)]") : "bg-[color:var(--surface)] border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]"}`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2"><span className={label}>What happened {kind === "Other" ? "" : "(optional)"}</span><FormInput value={note} onChange={setNote} placeholder="Symptoms, vitals, what was done" /></div>
        {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
      </div>
    </Modal>
  );
}

function ReturnDialog({ issue, onClose, onDone }: { issue: BloodTransfusionDTO | null; onClose: () => void; onDone: () => void }) {
  const { run, loading, error, reset } = useMutation();
  const [restock, setRestock] = useState(true);
  const close = () => { reset(); onClose(); };
  async function giveBack() {
    if (!(await attempt(run(() => api.post(`/blood-bank/issues/${issue!.id}/return`, { restock }))))) return;
    onDone(); close();
  }
  // Taken once when the dialog opens for this issue (it is re-created per issue).
  const [minutes] = useState(() => (issue ? Math.round((Date.now() - new Date(issue.issuedAt).getTime()) / 60_000) : 0));
  return (
    <Modal open={!!issue} onClose={close} width={440} title={issue ? `Return ${issue.unitNo}` : ""} subtitle={issue ? `Left the blood bank ${minutes} min ago.` : ""}
      footer={<>
        <button onClick={close} className={cancelBtn}>Cancel</button>
        <button onClick={giveBack} disabled={loading} className="h-[36px] rounded-[8px] bg-[color:var(--brand)] px-5 text-[13px] font-medium text-white hover:bg-[color:var(--brand-hover)] cursor-pointer disabled:opacity-50">{loading ? "Saving…" : "Return"}</button>
      </>}>
      <div className="flex flex-col gap-2">
        {([[true, "Restock", "Intact and sealed, back inside 30 minutes — it goes back on the shelf."], [false, "Discard as wastage", "Opened, warm or out too long — it is discarded and goes on the wastage register."]] as const).map(([v, t, d]) => (
          <label key={t} className={`flex cursor-pointer gap-3 rounded-[10px] border px-4 py-3 ${restock === v ? "border-[color:var(--brand)] border-2" : "border-[color:var(--line)]"}`}>
            <input type="radio" name="disposition" checked={restock === v} onChange={() => setRestock(v)} />
            <span><span className="block text-[14px] font-medium text-[color:var(--ink)]">{t}</span><span className="block text-[12px] text-[color:var(--ink-soft)]">{d}</span></span>
          </label>
        ))}
        {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
      </div>
    </Modal>
  );
}

export function IssuesView({ canWrite }: { canWrite: boolean }) {
  const { items, reload, loading } = useList<BloodTransfusionDTO>("/blood-bank/issues", { all: true });
  const { run, error, reset } = useMutation();
  const [reactionFor, setReactionFor] = useState<BloodTransfusionDTO | null>(null);
  const [returnFor, setReturnFor] = useState<BloodTransfusionDTO | null>(null);
  const { rows, bar } = usePagination(items, "issues");

  return (
    <div>
      <SectionHead title="Issues" note="Issue from the cross-match worklist (a compatible result is required)" />
      {error && <p role="alert" className="mx-5 mb-3 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
      <div className="mx-5 mb-4 overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
        <table className="w-full min-w-[980px] text-left">
          <thead><tr className="border-b border-[color:var(--line)]">{["Issue", "Patient", "Unit", "Issued", "Transfusion", "Disposition", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((t) => {
              const open = !t.transfusedAt && !t.disposition;
              return (
                <tr key={t.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                  <td className={`${td} ${mono}`}>{t.issueNo}</td>
                  <td className={td}>{t.patientName}</td>
                  <td className={`${td} ${mono}`}>{t.unitNo} <span className="font-sans text-[color:var(--ink-soft)]">{t.unitGroup}</span></td>
                  <td className={`${td} ${mono}`}>{stamp(t.issuedAt)}</td>
                  <td className={`${td} ${mono}`}>{t.transfusedAt ? `done ${stamp(t.transfusedAt)}` : t.disposition ? "-" : "pending"}</td>
                  <td className={`${td} ${mono}`}>
                    {t.disposition || "-"}
                    {t.reactions.length > 0 && <span className="ml-2 rounded-full bg-[#ffe3e5] px-2 font-sans text-[11px] font-medium text-[#b3001b]" title={t.reactions.map((r) => `${r.kind} (${r.severity})`).join(", ")}>{t.reactions.length} reaction{t.reactions.length > 1 ? "s" : ""}</span>}
                  </td>
                  <td className={`${td} text-right`}>
                    {canWrite && (
                      <div className="flex justify-end gap-2">
                        {open && <button onClick={async () => { reset(); try { await run(() => api.post(`/blood-bank/issues/${t.id}/transfused`)); reload(); } catch { /* shown above */ } }} className={`${btn.base} ${btn.solid}`}>Transfused</button>}
                        {open && <button onClick={() => setReturnFor(t)} className={`${btn.base} ${btn.ghost}`}>Return</button>}
                        <button onClick={() => setReactionFor(t)} className={`${btn.base} ${btn.danger}`}>Reaction</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && items.length === 0 && <Empty>Nothing issued yet. Issue a unit from a compatible cross-match.</Empty>}
      </div>
      {bar}
      <ReactionDialog key={`r${reactionFor?.id}`} issue={reactionFor} onClose={() => setReactionFor(null)} onDone={reload} />
      <ReturnDialog key={`b${returnFor?.id}`} issue={returnFor} onClose={() => setReturnFor(null)} onDone={reload} />
    </div>
  );
}
