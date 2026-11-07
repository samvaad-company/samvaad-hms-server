"use client";

/** The loyalty screen's two dialogs: a member's whole picture, and adding or taking off points by hand. */
import { useState } from "react";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput } from "@/components/shared/FormRow";
import { LoyaltyCard } from "./LoyaltyCard";
import type { LoyaltyDetailDTO, LoyaltyProgram } from "@/types/loyalty";

const dmy = (s: string) => new Date(s.length > 10 ? s : `${s}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const REASONS = ["Referred a patient", "Family member joined", "Long-term association", "Fan of the hospital", "Ambassador of the hospital", "Correction"];

export function AdjustPointsModal({ patientId, name, points: current, presetPoints, presetReason, onClose, onSaved }: {
  patientId: number; name: string; points?: number; presetPoints?: number; presetReason?: string; onClose: () => void; onSaved: () => void;
}) {
  const { run, loading, error } = useMutation();
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState(String(presetPoints ?? 10));
  const [reason, setReason] = useState(presetReason ?? "");
  const n = Math.floor(Number(amount));
  const valid = Number.isFinite(n) && n > 0 && reason.trim().length >= 3;

  async function save() {
    await run(() => api.post(`/loyalty/members/${patientId}/adjust`, { points: sign * n, reason }));
    onSaved();
    onClose();
  }

  const btn = "text-[13px] px-5 py-[8px] rounded-full transition-colors cursor-pointer";
  return (
    <Modal
      open onClose={onClose} width={460} title={`Points — ${name}`} subtitle={`${current !== undefined ? `Now ${current} points. ` : ""}Every change is recorded with your name and the reason.`}
      footer={<>
        <button onClick={onClose} className={`${btn} border border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]`}>Cancel</button>
        <button onClick={save} disabled={!valid || loading} className={`${btn} bg-[color:var(--brand)] text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50`}>{loading ? "Saving…" : sign === 1 ? `Add ${valid ? n : ""} points` : `Remove ${valid ? n : ""} points`}</button>
      </>}
    >
      <div className="flex flex-col gap-4">
        <div className="inline-flex self-start rounded-full bg-[color:var(--subtle)] p-[3px]" role="group" aria-label="Add or remove">
          {([[1, "Add", Plus], [-1, "Remove", Minus]] as const).map(([v, label, Icon]) => (
            <button key={label} aria-pressed={sign === v} onClick={() => setSign(v)} className={`inline-flex h-[30px] items-center gap-1 rounded-full px-4 text-[13px] cursor-pointer ${sign === v ? "bg-[color:var(--surface)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}><Icon size={13} /> {label}</button>
          ))}
        </div>
        <FormRow label="Points">
          <FormInput type="number" min="1" value={amount} onChange={setAmount} />
        </FormRow>
        <div className="flex flex-wrap gap-2">
          {[5, 10, 25, 50, 100].map((p) => (
            <button key={p} type="button" onClick={() => setAmount(String(p))} className={`h-[28px] rounded-full border px-3 text-[12px] cursor-pointer ${amount === String(p) ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--brand)]" : "border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>{p}</button>
          ))}
        </div>
        <FormRow label="Reason" required hint="Shown in the patient's points history.">
          <FormInput value={reason} onChange={setReason} placeholder="e.g. Referred three patients this month" />
        </FormRow>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => <button key={r} type="button" onClick={() => setReason(r)} className="h-[26px] rounded-full bg-[color:var(--subtle)] px-3 text-[12px] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] cursor-pointer">{r}</button>)}
        </div>
        {error && <div className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#ff0004]">{error.message}</div>}
      </div>
    </Modal>
  );
}

export function MemberDetailModal({ patientId, onClose, onChanged }: { patientId: number; onClose: () => void; onChanged: () => void }) {
  const { item: m, reload } = useItem<LoyaltyDetailDTO>(`/loyalty/members/${patientId}`);
  const { item: program } = useItem<LoyaltyProgram>("/loyalty/program");
  const [adjusting, setAdjusting] = useState(false);
  const rank = program?.ranks.find((r) => r.key === m?.rankKey);

  return (
    <Modal
      open onClose={onClose} width={760} title={m ? m.name : "Loyalty"} subtitle={m ? `${m.patientCode} · ${m.phone}` : undefined}
      footer={m ? <>
        <Link href={`/patients/${m.patientId}`} className="mr-auto text-[13px] text-[color:var(--brand)] hover:underline">Open patient record</Link>
        <button onClick={() => setAdjusting(true)} className="rounded-full bg-[color:var(--brand)] px-5 py-[8px] text-[13px] text-white hover:bg-[color:var(--brand-hover)] cursor-pointer">Add or remove points</button>
      </> : undefined}
    >
      {!m ? <p className="py-10 text-center text-[13px] text-[color:var(--ink-soft)]">Loading…</p> : (
        <div className="grid gap-5 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <LoyaltyCard member={m} rank={rank} />
            {m.referredBy && <p className="text-[13px] text-[color:var(--ink-soft)]">Referred by <b className="font-medium text-[color:var(--ink)]">{m.referredBy.name}</b></p>}
            {m.familyOf && <p className="text-[13px] text-[color:var(--ink-soft)]">Family of <b className="font-medium text-[color:var(--ink)]">{m.familyOf.name}</b>{m.familyOf.relation ? ` (${m.familyOf.relation})` : ""}</p>}
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <section>
              <h3 className="mb-2 text-[13px] font-medium">How the points add up</h3>
              <ul className="flex flex-col gap-[6px] text-[13px]">
                {m.breakdown.map((l) => (
                  <li key={l.key} className="flex items-baseline justify-between gap-3"><span>{l.label} <span className="text-[12px] text-[color:var(--ink-soft)]">· {l.detail}</span></span><span className="font-mono text-[12px]">{l.points >= 0 ? "+" : ""}{l.points}{l.max !== null ? ` / ${l.max}` : ""}</span></li>
                ))}
                <li className="flex items-baseline justify-between gap-3 border-t border-[color:var(--line)] pt-2 font-medium"><span>Total</span><span className="font-mono">{m.points}</span></li>
              </ul>
            </section>
            <section>
              <h3 className="mb-2 text-[13px] font-medium">Patients they referred <span className="font-normal text-[12px] text-[color:var(--ink-soft)]">{m.referrals.length}</span></h3>
              {m.referrals.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">None recorded yet.</p> : (
                <ul className="flex flex-col gap-1 text-[13px]">{m.referrals.map((r) => <li key={r.patientId} className="flex justify-between gap-3"><Link href={`/patients/${r.patientId}`} className="text-[color:var(--ink)] hover:underline">{r.name}</Link><span className="text-[12px] text-[color:var(--ink-soft)]">{dmy(r.date)}</span></li>)}</ul>
              )}
            </section>
            <section>
              <h3 className="mb-2 text-[13px] font-medium">Family <span className="font-normal text-[12px] text-[color:var(--ink-soft)]">{m.family.length}</span></h3>
              {m.family.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">No family linked yet.</p> : (
                <ul className="flex flex-col gap-1 text-[13px]">{m.family.map((f) => <li key={f.patientId} className="flex justify-between gap-3"><Link href={`/patients/${f.patientId}`} className="text-[color:var(--ink)] hover:underline">{f.name}</Link><span className="text-[12px] text-[color:var(--ink-soft)]">{f.relation || "family"}</span></li>)}</ul>
              )}
            </section>
            <section>
              <h3 className="mb-2 text-[13px] font-medium">Points added by hand <span className="font-normal text-[12px] text-[color:var(--ink-soft)]">{m.adjustments.length}</span></h3>
              {m.adjustments.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">None.</p> : (
                <ul className="flex flex-col gap-2 text-[13px]">{m.adjustments.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3"><span className="min-w-0">{a.reason}<span className="block text-[11px] text-[color:var(--ink-soft)]">{a.by} · {dmy(a.at)}</span></span><span className={`shrink-0 font-mono text-[12px] ${a.points > 0 ? "text-[#00955c]" : "text-[#d4000a]"}`}>{a.points > 0 ? "+" : ""}{a.points}</span></li>
                ))}</ul>
              )}
            </section>
          </div>
        </div>
      )}
      {adjusting && m && <AdjustPointsModal patientId={m.patientId} name={m.name} points={m.points} onClose={() => setAdjusting(false)} onSaved={() => { reload(); onChanged(); }} />}
    </Modal>
  );
}
