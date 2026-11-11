"use client";

/** Summary: what is happening on the ward for this patient, what is left to do, who is caring for them and the facts of the stay. */
import { useState } from "react";
import { ArrowRight, Check, Circle, Pill as PillIcon } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import type { StaffDTO } from "@/types/api";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import { Card, ChartCtx, ErrorLine, LinkButton, Pill, Stat, btn, dateTime, dayShort, done, inr, timeOf } from "@/components/ipd/patient/ui";

const PAYERS_FALLBACK = ["Self pay", "Insurance / TPA", "Corporate", "Government scheme"];

/** Ask about allergies: no known allergies, or what they are. Also reused from the header chip. */
export function AllergyDialog({ ctx, open, onClose }: { ctx: ChartCtx; open: boolean; onClose: () => void }) {
  const o = ctx.overview;
  const [status, setStatus] = useState<"" | "No known allergies" | "Has allergies">(o?.allergyStatus ?? "");
  const [text, setText] = useState(o?.allergies ?? "");
  const { run, loading, error, reset } = useMutation();
  async function save() {
    if (!status) return;
    if (!(await done(run(() => api.patch(`/ipd/${ctx.id}/stay`, { allergyStatus: status, allergies: status === "Has allergies" ? text.trim() : "" }))))) return;
    ctx.refresh();
    onClose();
  }
  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Allergies" subtitle="Ask the patient or family, and record the answer."
      footer={<>
        <button onClick={onClose} className={`${btn.base} ${btn.ghost}`}>Cancel</button>
        <button onClick={save} disabled={!status || loading || (status === "Has allergies" && !text.trim())} className={`${btn.base} ${btn.solid}`}>{loading ? "Saving…" : "Save"}</button>
      </>}>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          {(["No known allergies", "Has allergies"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={`${btn.base} ${status === s ? btn.solid : btn.ghost}`}>{s}</button>
          ))}
        </div>
        {status === "Has allergies" && <FormRow label="What is the patient allergic to?" required><FormInput placeholder="e.g. Penicillin — rash" value={text} onChange={setText} /></FormRow>}
        <ErrorLine error={error} />
      </div>
    </Modal>
  );
}

export function PayerDialog({ ctx, open, onClose }: { ctx: ChartCtx; open: boolean; onClose: () => void }) {
  const [payer, setPayer] = useState(ctx.overview?.payer ?? "Self pay");
  const { items: tpas } = useList<{ id: number; name: string }>("/tpa", { all: true });
  const { run, loading, error, reset } = useMutation();
  const options = [...new Set([...PAYERS_FALLBACK, ...tpas.map((t) => t.name), ctx.overview?.payer ?? ""])].filter(Boolean);
  async function save() {
    if (!(await done(run(() => api.patch(`/ipd/${ctx.id}/stay`, { payer }))))) return;
    ctx.refresh();
    onClose();
  }
  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Who is paying?" subtitle="Self pay, or the insurer / TPA the bill goes to."
      footer={<>
        <button onClick={onClose} className={`${btn.base} ${btn.ghost}`}>Cancel</button>
        <button onClick={save} disabled={loading} className={`${btn.base} ${btn.solid}`}>{loading ? "Saving…" : "Save"}</button>
      </>}>
      <div className="flex flex-col gap-3">
        <FormRow label="Paid by"><FormSelect value={payer} onChange={setPayer} options={options.map((p) => ({ value: p, label: p }))} /></FormRow>
        <ErrorLine error={error} />
      </div>
    </Modal>
  );
}

function NurseDialog({ ctx, open, onClose }: { ctx: ChartCtx; open: boolean; onClose: () => void }) {
  const { items: staff } = useList<StaffDTO>("/staff", { all: true });
  const nurses = staff.filter((s) => /nurse/i.test(s.role) && s.status === "Active");
  const [nurseId, setNurseId] = useState(ctx.record.primaryNurseId ? String(ctx.record.primaryNurseId) : "");
  const { run, loading, error, reset } = useMutation();
  async function save() {
    if (!(await done(run(() => api.patch(`/ipd/${ctx.id}`, { primaryNurseId: nurseId ? Number(nurseId) : null }))))) return;
    ctx.refresh();
    onClose();
  }
  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Primary nurse" subtitle="The nurse who looks after this patient on the ward."
      footer={<>
        <button onClick={onClose} className={`${btn.base} ${btn.ghost}`}>Cancel</button>
        <button onClick={save} disabled={loading} className={`${btn.base} ${btn.solid}`}>{loading ? "Saving…" : "Save"}</button>
      </>}>
      <div className="flex flex-col gap-3">
        <FormRow label="Nurse"><FormSelect value={nurseId} onChange={setNurseId} placeholder="No nurse assigned" options={[{ value: "", label: "No nurse assigned" }, ...nurses.map((n) => ({ value: String(n.id), label: n.name }))]} /></FormRow>
        <ErrorLine error={error} />
      </div>
    </Modal>
  );
}

export function SummaryTab({ ctx }: { ctx: ChartCtx }) {
  const o = ctx.overview;
  const [nurseOpen, setNurseOpen] = useState(false);
  const [payerOpen, setPayerOpen] = useState(false);
  const [allergyOpen, setAllergyOpen] = useState(false);
  if (!o) return <p className="py-10 text-center text-[13px] text-[color:var(--ink-soft)]">Loading the summary…</p>;
  const a = ctx.record;
  const lv = o.lastVitals;

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Doses due now" value={o.stats.dosesDue} sub={o.live?.dosesMissed ? `${o.live.dosesMissed} missed` : "none overdue"} tone={o.stats.dosesDue ? "warn" : undefined} />
        <Stat label="IV running" value={o.stats.ivRunning || "None"} sub={o.stats.ivRunning ? "bottles" : "nothing on the drip"} />
        <Stat label="Doctor visits today" value={o.stats.doctorVisitsToday} sub={o.live?.lastRoundBy ? `last by ${o.live.lastRoundBy}` : "none logged yet"} tone={o.stats.doctorVisitsToday ? "ok" : undefined} />
        <Stat label="Open orders" value={o.stats.openOrders} sub="not yet acted on" tone={o.stats.openOrders ? "warn" : undefined} />
        <Stat label="Balance due" value={inr(o.stats.balanceDue)} sub={o.stats.billed ? `${inr(o.stats.billed)} billed` : "nothing billed yet"} tone={o.stats.balanceDue ? "bad" : "ok"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card title="On the ward" hint="Last 24 hours — who did what, newest first">
            {o.onWard.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[color:var(--ink-soft)]">Nothing in the last 24 hours.</p>
            ) : (
              <ul className="flex flex-col">
                {o.onWard.map((e, i) => (
                  <li key={i} className="flex items-start gap-3 border-t border-[color:var(--subtle-2)] py-[8px] first:border-t-0">
                    <span className="w-[68px] shrink-0 text-[12px] text-[color:var(--ink-soft)]">{timeOf(e.at)}<br /><span className="text-[11px]">{dayShort(e.at)}</span></span>
                    <PillIcon size={14} className="mt-[3px] shrink-0 text-[color:var(--ink-soft)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-[color:var(--ink)]">{e.medicineName} <span className={e.state === "missed" ? "font-medium text-[#b3001b]" : e.state === "held" ? "font-medium text-[#a35a00]" : "text-[#0b7a47]"}>— {e.state}</span></p>
                      <p className="text-[12px] text-[color:var(--ink-soft)]">{[e.dosage, e.route].filter(Boolean).join(" · ")}{e.by ? ` · by ${e.by}` : ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {o.consents.total > 0 || o.preauth.total > 0 ? (
            <Card title="Paperwork">
              <div className="flex flex-wrap gap-2 text-[12px]">
                <Pill tone={o.consents.signed ? "ok" : "neutral"}>{o.consents.signed} of {o.consents.total} consents signed</Pill>
                <Pill tone={o.preauth.ready ? "ok" : "neutral"}>{o.preauth.ready} of {o.preauth.total} pre-auth forms ready</Pill>
              </div>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <Card title={`To do for this patient${o.todo.length ? ` · ${o.todo.length}` : ""}`}>
            {o.todo.length === 0 ? (
              <p className="flex items-center gap-2 text-[13px] text-[#0b7a47]"><Check size={14} /> Nothing outstanding.</p>
            ) : (
              <ul className="flex flex-col">
                {o.todo.map((t) => (
                  <li key={t.key}>
                    <button type="button" onClick={() => (t.key === "allergy" ? setAllergyOpen(true) : t.key === "nurse" ? setNurseOpen(true) : ctx.go(t.tab))}
                      className="group flex w-full cursor-pointer items-center gap-2 border-t border-[color:var(--subtle-2)] py-[8px] text-left text-[13px] text-[color:var(--ink)] first:border-t-0 hover:text-[color:var(--brand)]">
                      <Circle size={7} className="shrink-0 fill-[#e0a000] text-[#e0a000]" />
                      <span className="flex-1">{t.text}</span>
                      <ArrowRight size={13} className="opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Care team" action={ctx.canWrite && !ctx.discharged ? <LinkButton onClick={() => setNurseOpen(true)}>{a.primaryNurse ? "Change" : "Assign"}</LinkButton> : undefined}>
            <div className="flex flex-col gap-2 text-[13px]">
              <div><p className="font-medium text-[color:var(--ink)]">{a.doctor || "No doctor"}</p><p className="text-[12px] text-[color:var(--ink-soft)]">Admitting consultant</p></div>
              <div>{a.primaryNurse ? <p className="font-medium text-[color:var(--ink)]">{a.primaryNurse}</p> : <p className="text-[color:var(--ink-soft)]">No nurse assigned yet.</p>}<p className="text-[12px] text-[color:var(--ink-soft)]">Primary nurse</p></div>
            </div>
          </Card>

          <Card title="This stay">
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-[10px] text-[13px]">
              <dt className="text-[color:var(--ink-soft)]">Admitted</dt>
              <dd className="text-[color:var(--ink)]">{dayShort(a.admissionDate)}, {new Date(a.admissionDate).getFullYear()} {o.live ? <Pill tone="neutral" className="ml-1">Day {o.live.stayDay}</Pill> : null}</dd>
              <dt className="text-[color:var(--ink-soft)]">Type</dt>
              <dd><Pill tone="info">{a.admissionType}</Pill></dd>
              <dt className="text-[color:var(--ink-soft)]">Diagnosis</dt>
              <dd className="text-[color:var(--ink)]">{a.diagnosis || "—"}</dd>
              <dt className="text-[color:var(--ink-soft)]">Allergies</dt>
              <dd className="flex items-center gap-2">
                {o.allergyStatus === "" ? <Pill tone="warn">Not assessed</Pill> : o.allergyStatus === "Has allergies" ? <Pill tone="bad">{o.allergies || "Has allergies"}</Pill> : <Pill tone="ok">No known allergies</Pill>}
                {ctx.canWrite && !ctx.discharged && <LinkButton onClick={() => setAllergyOpen(true)}>{o.allergyStatus ? "Change" : "Record"}</LinkButton>}
              </dd>
              <dt className="text-[color:var(--ink-soft)]">Paid by</dt>
              <dd className="flex items-center gap-2"><span className="text-[color:var(--ink)]">{o.payer}</span>{ctx.canWrite && !ctx.discharged && <LinkButton onClick={() => setPayerOpen(true)}>Change</LinkButton>}</dd>
              <dt className="text-[color:var(--ink-soft)]">Last vitals</dt>
              <dd className="text-[color:var(--ink)]">
                {lv ? <><span className="font-mono text-[12px]">{lv.tempC ?? "–"}° · P {lv.pulse ?? "–"} · BP {lv.bpSystolic ?? "–"}/{lv.bpDiastolic ?? "–"} · SpO₂ {lv.spo2 ?? "–"}</span><br /><span className="text-[12px] text-[color:var(--ink-soft)]">{dateTime(lv.recordedAt)}{o.live?.vitalsDue ? " · due again" : ""}</span></> : <span className="text-[color:var(--ink-soft)]">None yet</span>}
              </dd>
              <dt className="text-[color:var(--ink-soft)]">Consents</dt>
              <dd className="flex items-center gap-2"><span className="text-[color:var(--ink)]">{o.consents.total ? `${o.consents.signed} of ${o.consents.total} signed` : "None yet"}</span><LinkButton onClick={() => ctx.go("consents")}>Open</LinkButton></dd>
              <dt className="text-[color:var(--ink-soft)]">Discharge</dt>
              <dd className="flex items-center gap-2"><span className="text-[color:var(--ink)]">{ctx.discharged ? "Discharged" : o.dischargeStage || (o.plannedDischargeDate ? `Planned ${dayShort(o.plannedDischargeDate)}` : "Not started")}</span><LinkButton onClick={() => ctx.go("discharge")}>Open</LinkButton></dd>
            </dl>
          </Card>
        </div>
      </div>

      {nurseOpen && <NurseDialog ctx={ctx} open onClose={() => setNurseOpen(false)} />}
      {payerOpen && <PayerDialog ctx={ctx} open onClose={() => setPayerOpen(false)} />}
      {allergyOpen && <AllergyDialog ctx={ctx} open onClose={() => setAllergyOpen(false)} />}
    </div>
  );
}
