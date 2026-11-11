"use client";

/** Treatment sheet: one day of the stay — the plan, the medicines and what was given, instructions, when to call the doctor, and the doctor's sign-off. */
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import type { DoseSlotDTO, IpdCallLimitsDTO, IpdHandoverDTO, IpdIoSummaryDTO, IpdMedicationDTO, IpdNoteDTO, IpdSheetDTO, IpdVitalDTO } from "@/types/api";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect, FormTextarea } from "@/components/shared/FormRow";
import { Card, ChartCtx, ErrorLine, LinkButton, Notice, Pill, btn, dateTime, dayName, done, inputCls, timeOf } from "@/components/ipd/patient/ui";
import { todayIso } from "@/lib/dates";

const addDays = (d: string, n: number) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)).toISOString().slice(0, 10);
const ROUTES = ["Oral", "IV", "IM", "SC", "Topical", "Inhaled"];

/** Reads "inj ceftriaxone 1 g iv bd" the way a doctor writes it into a name, dose, route and frequency. */
export function parseOrder(text: string): { medicineName: string; dosage: string; frequency: string; route: string } {
  let rest = ` ${text.trim()} `;
  const take = (re: RegExp) => { const m = re.exec(rest); if (!m) return ""; rest = rest.replace(m[0], " "); return m[0].trim(); };
  const dosage = take(/\s\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|iu|units?|%)\b/i);
  const frequency = take(/\s(?:\d\s?-\s?\d\s?-\s?\d(?:\s?-\s?\d)?|od|bd|bid|tds|tid|qid|hs|sos|prn|stat|nocte|q\d+h)\b/i);
  const routeWord = take(/\s(?:iv|im|sc|po|oral|topical|inhaled|sl)\b/i).toLowerCase();
  const route = routeWord === "iv" ? "IV" : routeWord === "im" ? "IM" : routeWord === "sc" ? "SC" : routeWord === "topical" ? "Topical" : routeWord === "inhaled" ? "Inhaled" : routeWord ? "Oral" : "Oral";
  return { medicineName: rest.replace(/\s+/g, " ").trim(), dosage, frequency: frequency.toUpperCase(), route };
}

export function OrderDialog({ ctx, open, initial, onClose, onSaved }: { ctx: ChartCtx; open: boolean; initial?: string; onClose: () => void; onSaved: () => void }) {
  const first = initial ? parseOrder(initial) : { medicineName: "", dosage: "", frequency: "", route: "Oral" };
  const [f, setF] = useState(first);
  const { run, loading, error, reset } = useMutation();
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    if (!(await done(run(() => api.post("/ipd/medications", { admissionId: ctx.id, ...f }))))) return;
    onSaved();
    onClose();
  }
  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Order a medicine or IV fluid" subtitle="It appears on the drug chart with its doses."
      footer={<>
        <button onClick={onClose} className={`${btn.base} ${btn.ghost}`}>Cancel</button>
        <button onClick={save} disabled={loading || !f.medicineName.trim()} className={`${btn.base} ${btn.solid}`}>{loading ? "Saving…" : "Order"}</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><FormRow label="Medicine / fluid" required><FormInput placeholder="e.g. Inj. Ceftriaxone" value={f.medicineName} onChange={set("medicineName")} /></FormRow></div>
        <FormRow label="Dose"><FormInput placeholder="1 g" value={f.dosage} onChange={set("dosage")} /></FormRow>
        <FormRow label="Frequency"><FormInput placeholder="BD, TDS, 1-0-1, SOS" value={f.frequency} onChange={set("frequency")} /></FormRow>
        <FormRow label="Route"><FormSelect value={f.route} onChange={set("route")} options={ROUTES.map((r) => ({ value: r, label: r }))} /></FormRow>
        <div className="col-span-2"><ErrorLine error={error} /></div>
      </div>
    </Modal>
  );
}

const LIMIT_LABELS: [keyof IpdCallLimitsDTO, string][] = [
  ["spo2Below", "SpO₂ <"], ["sbpBelow", "Systolic BP <"], ["sbpAbove", "Systolic BP >"], ["pulseAbove", "Pulse >"], ["pulseBelow", "Pulse <"],
  ["respAbove", "Resp. rate >"], ["tempFAbove", "Temp >"], ["grbsBelow", "GRBS <"], ["grbsAbove", "GRBS >"],
];
const LIMIT_UNIT: Partial<Record<keyof IpdCallLimitsDTO, string>> = { spo2Below: " %", tempFAbove: " °F", grbsBelow: " mg/dL", grbsAbove: " mg/dL" };

function CallDialog({ sheet, ctx, open, onClose, onSaved }: { sheet: IpdSheetDTO; ctx: ChartCtx; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [limits, setLimits] = useState<Record<string, string>>(Object.fromEntries(LIMIT_LABELS.map(([k]) => [k, sheet.callDoctor.limits[k] == null ? "" : String(sheet.callDoctor.limits[k])])));
  const [other, setOther] = useState(sheet.callDoctor.other.join("\n"));
  const { run, loading, error, reset } = useMutation();
  async function save() {
    const body = { date: sheet.date, callDoctor: { limits: Object.fromEntries(LIMIT_LABELS.map(([k]) => [k, limits[k].trim() === "" ? null : Number(limits[k])])), other: other.split("\n").map((x) => x.trim()).filter(Boolean) } };
    if (!(await done(run(() => api.put(`/ipd/${ctx.id}/sheet`, body))))) return;
    onSaved();
    onClose();
  }
  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Call the doctor immediately if" subtitle="Limits the nurses watch for. Leave a box empty to turn that limit off." width={640}
      footer={<>
        <button onClick={onClose} className={`${btn.base} ${btn.ghost}`}>Cancel</button>
        <button onClick={save} disabled={loading} className={`${btn.base} ${btn.solid}`}>{loading ? "Saving…" : "Save"}</button>
      </>}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {LIMIT_LABELS.map(([k, label]) => (
            <FormRow key={k} label={label.replace(/[<>]/, "").trim() + (label.includes("<") ? " (below)" : " (above)")}>
              <FormInput type="number" value={limits[k]} onChange={(v) => setLimits((x) => ({ ...x, [k]: v }))} />
            </FormRow>
          ))}
        </div>
        <FormRow label="Other reasons (one per line)"><FormTextarea value={other} onChange={setOther} rows={5} /></FormRow>
        <ErrorLine error={error} />
      </div>
    </Modal>
  );
}

function ListEditor({ title, subtitle, items, onSave, open, onClose, loading, error }: { title: string; subtitle: string; items: string[]; onSave: (items: string[]) => void; open: boolean; onClose: () => void; loading: boolean; error: { message: string } | null }) {
  const [text, setText] = useState(items.join("\n"));
  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle}
      footer={<>
        <button onClick={onClose} className={`${btn.base} ${btn.ghost}`}>Cancel</button>
        <button onClick={() => onSave(text.split("\n").map((x) => x.trim()).filter(Boolean))} disabled={loading} className={`${btn.base} ${btn.solid}`}>{loading ? "Saving…" : "Save"}</button>
      </>}>
      <div className="flex flex-col gap-3"><FormTextarea value={text} onChange={setText} rows={6} placeholder="One per line" /><ErrorLine error={error} /></div>
    </Modal>
  );
}

export function SheetTab({ ctx }: { ctx: ChartCtx }) {
  const today = todayIso();
  const [date, setDate] = useState(today);
  const { item: sheet, reload } = useItem<IpdSheetDTO>(`/ipd/${ctx.id}/sheet?date=${date}`);
  const { items: meds, reload: reloadMeds } = useList<IpdMedicationDTO>("/ipd/medications", { all: true, admission_id: ctx.id });
  const { items: allDoses, reload: reloadDoses } = useList<DoseSlotDTO>("/ipd/nurse/doses", { date });
  const { items: notes, reload: reloadNotes } = useList<IpdNoteDTO>("/ipd/notes", { all: true, admission_id: ctx.id });
  const { item: io } = useItem<IpdIoSummaryDTO>(`/ipd/${ctx.id}/io`);
  const { items: vitals } = useList<IpdVitalDTO>("/ipd/nurse/vitals", { admissionId: ctx.id });
  const { run, loading, error } = useMutation();
  const [quick, setQuick] = useState("");
  const [order, setOrder] = useState<string | null>(null);
  const [planEdit, setPlanEdit] = useState<string | null>(null);
  const [callOpen, setCallOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [instrAdd, setInstrAdd] = useState<{ text: string; kind: "Nursing" | "Diet" } | null>(null);
  const [noteText, setNoteText] = useState<string | null>(null);
  const [shift, setShift] = useState<"" | "Morning" | "Evening" | "Night">("");
  const [hold, setHold] = useState<DoseSlotDTO | null>(null);
  const [holdWhy, setHoldWhy] = useState("");
  const [handover, setHandover] = useState<string | null>(null);

  const editable = ctx.canNurse && !ctx.discharged;
  const doses = useMemo(() => allDoses.filter((d) => d.admissionId === ctx.id), [allDoses, ctx.id]);
  const activeMeds = meds.filter((m) => m.status === "Active");
  const dayNotes = notes.filter((n) => n.date === date && n.noteType !== "Diet");
  const dayVitals = vitals.filter((v) => v.recordedAt.slice(0, 10) === date);
  const dayIo = (io?.entries ?? []).filter((e) => e.recordedAt.slice(0, 10) === date);
  const intake = dayIo.filter((e) => e.kind === "In").reduce((n, e) => n + e.amountMl, 0);
  const output = dayIo.filter((e) => e.kind === "Out").reduce((n, e) => n + e.amountMl, 0);
  const stayDay = Math.max(1, Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${ctx.record.admissionDate.slice(0, 10)}T00:00:00Z`)) / 86_400_000) + 1);

  const hrOf = (iso: string) => new Date(iso).getHours();
  const inShift = (iso: string) => !shift || (shift === "Morning" ? hrOf(iso) >= 6 && hrOf(iso) < 14 : shift === "Evening" ? hrOf(iso) >= 14 && hrOf(iso) < 22 : hrOf(iso) >= 22 || hrOf(iso) < 6);

  const reloadAll = () => { reload(); reloadMeds(); reloadDoses(); reloadNotes(); ctx.refresh(); };
  const saveSheet = async (patch: Record<string, unknown>) => done(run(() => api.put(`/ipd/${ctx.id}/sheet`, { date, ...patch }).then(() => reload())));

  async function give(d: DoseSlotDTO, status: "Given" | "Held", note = "") {
    if (!(await done(run(() => api.post("/ipd/nurse/doses", { medicationId: d.medicationId, scheduledAt: d.scheduledAt, status, note }))))) return;
    reloadDoses();
    ctx.refresh();
  }
  async function quickOrder() {
    if (!quick.trim()) return;
    const p = parseOrder(quick);
    if (!p.medicineName) return;
    if (!(await done(run(() => api.post("/ipd/medications", { admissionId: ctx.id, ...p }))))) return;
    setQuick("");
    reloadMeds();
    ctx.refresh();
  }
  async function review() {
    if (!(await done(run(() => api.post(`/ipd/${ctx.id}/sheet/sign`, { date }))))) return;
    reload();
  }

  if (!sheet) return <p className="py-10 text-center text-[13px] text-[color:var(--ink-soft)]">Loading the treatment sheet…</p>;
  const checks = (ctx.overview?.todo ?? []).filter((t) => ["allergy", "missed"].includes(t.key));
  const lim = sheet.callDoctor.limits;

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))} className={`${btn.base} ${btn.ghost} !px-2`}><ChevronLeft size={14} /></button>
          <div>
            <p className="text-[16px] font-semibold text-[color:var(--ink)]">{date === today ? "Today, " : ""}{dayName(`${date}T12:00:00`)}</p>
            <p className="text-[12px] text-[color:var(--ink-soft)]">Day {stayDay} of stay</p>
          </div>
          <button type="button" aria-label="Next day" disabled={date >= today} onClick={() => setDate(addDays(date, 1))} className={`${btn.base} ${btn.ghost} !px-2`}><ChevronRight size={14} /></button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sheet.signedAt ? <Pill tone="ok">Signed by {sheet.signedBy} · {timeOf(sheet.signedAt)}</Pill> : <Pill tone="warn">Not signed by a doctor</Pill>}
          {(["Morning", "Evening", "Night"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setShift(shift === s ? "" : s)} className={`${btn.base} ${shift === s ? btn.solid : btn.ghost}`}>{s}</button>
          ))}
          <button type="button" onClick={() => window.print()} className={`${btn.base} ${btn.ghost}`}><Printer size={13} /> Print</button>
        </div>
      </div>
      <ErrorLine error={error} />

      <Card title="Diagnosis & plan of the day" action={editable ? <LinkButton onClick={() => setPlanEdit(sheet.plan)}><Pencil size={11} className="mr-1 inline" />{sheet.plan ? "Edit plan" : "Write today's plan"}</LinkButton> : undefined}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><p className="text-[11px] text-[color:var(--ink-soft)]">Working diagnosis</p><p className="text-[14px] font-medium text-[color:var(--ink)]">{sheet.diagnosis || "—"}</p></div>
          <div>
            <p className="text-[11px] text-[color:var(--ink-soft)]">Plan of the day{sheet.carriedFrom ? ` · carried from ${dayName(`${sheet.carriedFrom}T12:00:00`)}` : ""}</p>
            {planEdit !== null ? (
              <div className="flex flex-col gap-2">
                <FormTextarea value={planEdit} onChange={setPlanEdit} rows={3} />
                <div className="flex gap-2"><button className={`${btn.base} ${btn.solid}`} disabled={loading} onClick={async () => { if (await saveSheet({ plan: planEdit })) setPlanEdit(null); }}>Save plan</button><button className={`${btn.base} ${btn.ghost}`} onClick={() => setPlanEdit(null)}>Cancel</button></div>
              </div>
            ) : sheet.plan ? <p className="whitespace-pre-wrap text-[13px] text-[color:var(--ink)]">{sheet.plan}</p> : <p className="text-[13px] text-[color:var(--ink-soft)]">No plan written for this day yet.</p>}
          </div>
        </div>
      </Card>

      <Card title="Medicines & IV fluids" action={editable ? <LinkButton onClick={() => setOrder("")}>Full order form</LinkButton> : undefined}>
        {editable && (
          <div className="mb-3 flex gap-2">
            <input value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void quickOrder(); }} placeholder="Add a medicine, IV fluid or instruction — type it the way you write it, e.g. inj ceftriaxone 1 g iv bd" className={inputCls} />
            <button onClick={quickOrder} disabled={loading || !quick.trim()} className={`${btn.base} ${btn.solid}`}>Add</button>
          </div>
        )}
        {activeMeds.length === 0 ? <p className="py-4 text-center text-[13px] text-[color:var(--ink-soft)]">No medicines ordered yet.</p> : (
          <div className="overflow-hidden rounded-[8px] border border-[color:var(--line)]">
            {activeMeds.map((m) => {
              const mine = doses.filter((d) => d.medicationId === m.id && inShift(d.scheduledAt));
              return (
                <div key={m.id} className="grid grid-cols-[minmax(160px,1fr)_2fr] gap-3 border-b border-[color:var(--subtle-2)] px-3 py-[10px] last:border-b-0 max-sm:grid-cols-1">
                  <div><p className="text-[13px] font-medium text-[color:var(--ink)]">{m.medicineName}</p><p className="text-[12px] text-[color:var(--ink-soft)]">{[m.dosage, m.route, m.frequency].filter(Boolean).join(" · ")}</p></div>
                  <div className="flex flex-wrap items-center gap-2">
                    {mine.length === 0 ? <span className="text-[12px] text-[color:var(--ink-soft)]">No fixed doses{date === today ? " — give when needed" : ""}</span> : mine.map((d) => (
                      <span key={d.key} className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] px-[8px] py-[2px] text-[12px]">
                        <span className="font-mono">{timeOf(d.scheduledAt)}</span>
                        {d.state === "given" ? <span className="text-[#0b7a47]">given{d.givenBy ? ` · ${d.givenBy}` : ""}</span>
                          : d.state === "held" ? <span className="text-[#a35a00]">held</span>
                          : d.state === "missed" ? <span className="text-[#b3001b]">missed</span>
                          : editable && date === today ? <><button className="cursor-pointer text-[color:var(--brand)] hover:underline" onClick={() => give(d, "Given")}>Give</button><button className="cursor-pointer text-[color:var(--ink-soft)] hover:underline" onClick={() => { setHold(d); setHoldWhy(""); }}>Hold</button></>
                          : <span className="text-[color:var(--ink-soft)]">{d.state === "due" ? "due" : "later"}</span>}
                      </span>
                    ))}
                    {editable && date === today && <button className="cursor-pointer text-[12px] text-[color:var(--brand)] hover:underline" onClick={async () => { const at = new Date().toISOString(); if (await done(run(() => api.post("/ipd/nurse/doses", { medicationId: m.id, scheduledAt: at, status: "Given" })))) { reloadDoses(); ctx.refresh(); } }}>+ Give a dose now</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Nursing & diet instructions" hint={dayVitals.length ? `${dayVitals.length} ${dayVitals.length === 1 ? "set" : "sets"} of vitals charted` : "No vitals charted on this sheet yet"} action={editable ? <LinkButton onClick={() => setInstrAdd({ text: "", kind: "Nursing" })}><Plus size={11} className="mr-1 inline" />Add</LinkButton> : undefined}>
          <p className="mb-2 text-[12px] text-[color:var(--ink-soft)]">Intake {intake} mL · Output {output} mL</p>
          {sheet.instructions.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">No instructions.</p> : (
            <ul className="flex flex-col">
              {sheet.instructions.map((i) => (
                <li key={i.id} className="flex items-start gap-2 border-t border-[color:var(--subtle-2)] py-[8px] text-[13px] first:border-t-0">
                  <Pill tone={i.kind === "Diet" ? "info" : "neutral"}>{i.kind}</Pill>
                  <span className="flex-1 text-[color:var(--ink)]">{i.text}</span>
                  {i.seenAt ? <span className="text-[11px] text-[#0b7a47]">Seen{i.seenBy ? ` · ${i.seenBy}` : ""}</span> : editable ? <LinkButton onClick={() => saveSheet({ instructions: sheet.instructions.map((x) => (x.id === i.id ? { ...x, seenAt: new Date().toISOString() } : x)) })}>Mark as seen</LinkButton> : null}
                  {ctx.canWrite && !ctx.discharged && <button aria-label="Remove instruction" className="cursor-pointer text-[#c8c8cc] hover:text-[#ff0004]" onClick={() => saveSheet({ instructions: sheet.instructions.filter((x) => x.id !== i.id) })}><Trash2 size={13} /></button>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Call the doctor immediately if" action={ctx.canWrite && !ctx.discharged ? <LinkButton onClick={() => setCallOpen(true)}><Pencil size={11} className="mr-1 inline" />Edit</LinkButton> : undefined}>
          <div className="mb-3 flex flex-wrap gap-2">
            {LIMIT_LABELS.filter(([k]) => lim[k] != null).map(([k, label]) => <span key={k} className="rounded-[6px] border border-[color:var(--line)] px-2 py-[2px] font-mono text-[12px]">{label} {lim[k]}{LIMIT_UNIT[k] ?? ""}</span>)}
          </div>
          <ul className="list-disc pl-5 text-[13px] text-[color:var(--ink)]">{sheet.callDoctor.other.map((x) => <li key={x}>{x}</li>)}</ul>
        </Card>
      </div>

      <Card title="Investigations" action={ctx.canWrite && !ctx.discharged ? <LinkButton onClick={() => setInvOpen(true)}><Pencil size={11} className="mr-1 inline" />Edit</LinkButton> : undefined}>
        {sheet.investigations.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">None ordered.</p> : <ul className="list-disc pl-5 text-[13px] text-[color:var(--ink)]">{sheet.investigations.map((x) => <li key={x}>{x}</li>)}</ul>}
      </Card>

      <Card title="Doctor's notes" action={ctx.canWrite && !ctx.discharged ? <LinkButton onClick={() => setNoteText("")}><Plus size={11} className="mr-1 inline" />Write a note</LinkButton> : undefined}>
        {noteText !== null && (
          <div className="mb-3 flex flex-col gap-2">
            <FormTextarea value={noteText} onChange={setNoteText} rows={3} placeholder="Findings, plan, orders…" />
            <div className="flex gap-2"><button className={`${btn.base} ${btn.solid}`} disabled={loading || !noteText.trim()} onClick={async () => { if (await done(run(() => api.post("/ipd/notes", { admissionId: ctx.id, noteType: "Doctor Round", content: noteText.trim() })))) { setNoteText(null); reloadNotes(); ctx.refresh(); } }}>Save note</button><button className={`${btn.base} ${btn.ghost}`} onClick={() => setNoteText(null)}>Cancel</button></div>
          </div>
        )}
        {dayNotes.length === 0 ? <p className="text-[13px] text-[color:var(--ink-soft)]">No notes written on this day.</p> : dayNotes.map((n) => (
          <div key={n.id} className="border-t border-[color:var(--subtle-2)] py-2 first:border-t-0"><p className="whitespace-pre-wrap text-[13px] text-[color:var(--ink)]">{n.content}</p><p className="text-[11px] text-[color:var(--ink-soft)]">{n.noteType} · {n.author} · {n.time}</p></div>
        ))}
      </Card>

      <HandoverCard ctx={ctx} date={date} editable={editable} adding={handover} setAdding={setHandover} />

      <Card title="Doctor's review & signature">
        {sheet.signedAt ? <p className="text-[13px] text-[#0b7a47]">Reviewed and signed by {sheet.signedBy} on {dateTime(sheet.signedAt)}. Changing the sheet takes the signature off.</p> : (
          <div className="flex flex-col gap-3">
            <Notice tone="warn">Not reviewed and signed by a doctor for this day yet.</Notice>
            {checks.length > 0 && <div className="text-[12px] text-[color:var(--ink-soft)]"><p className="mb-1 font-medium text-[color:var(--ink)]">{checks.length} {checks.length === 1 ? "thing" : "things"} to check before signing</p>{checks.map((c) => <p key={c.key}>• {c.text}</p>)}</div>}
            {ctx.isDoctor && !ctx.discharged && date === today ? <div><button onClick={review} disabled={loading} className={`${btn.base} ${btn.solid}`}>Review & sign today</button></div> : <p className="text-[12px] text-[color:var(--ink-soft)]">Only a doctor can sign the sheet{date !== today ? ", and only today's" : ""}.</p>}
          </div>
        )}
      </Card>

      {order !== null && <OrderDialog ctx={ctx} open initial={order} onClose={() => setOrder(null)} onSaved={reloadAll} />}
      {callOpen && <CallDialog sheet={sheet} ctx={ctx} open onClose={() => setCallOpen(false)} onSaved={reload} />}
      {invOpen && <ListEditor title="Investigations" subtitle="Tests and scans to get for this patient, one per line." items={sheet.investigations} open onClose={() => setInvOpen(false)} loading={loading} error={error} onSave={async (items) => { if (await saveSheet({ investigations: items })) setInvOpen(false); }} />}
      <Modal open={instrAdd !== null} onClose={() => setInstrAdd(null)} title="Add an instruction" subtitle="Nursing care or diet — nurses mark each as seen."
        footer={<><button onClick={() => setInstrAdd(null)} className={`${btn.base} ${btn.ghost}`}>Cancel</button><button disabled={loading || !instrAdd?.text.trim()} className={`${btn.base} ${btn.solid}`} onClick={async () => { if (instrAdd && (await saveSheet({ instructions: [...sheet.instructions, { id: "", text: instrAdd.text, kind: instrAdd.kind, seenBy: null, seenAt: null }] }))) setInstrAdd(null); }}>Add</button></>}>
        <div className="flex flex-col gap-3">
          <FormRow label="Kind"><FormSelect value={instrAdd?.kind ?? "Nursing"} onChange={(v) => setInstrAdd((x) => (x ? { ...x, kind: v as "Nursing" | "Diet" } : x))} options={[{ value: "Nursing", label: "Nursing" }, { value: "Diet", label: "Diet" }]} /></FormRow>
          <FormRow label="Instruction" required><FormTextarea value={instrAdd?.text ?? ""} onChange={(v) => setInstrAdd((x) => (x ? { ...x, text: v } : x))} rows={3} placeholder="e.g. Strict input/output charting every shift" /></FormRow>
        </div>
      </Modal>
      <Modal open={hold !== null} onClose={() => setHold(null)} title="Hold this dose" subtitle={hold ? `${hold.medicineName} · ${timeOf(hold.scheduledAt)}` : ""}
        footer={<><button onClick={() => setHold(null)} className={`${btn.base} ${btn.ghost}`}>Cancel</button><button disabled={loading || !holdWhy.trim()} className={`${btn.base} ${btn.solid}`} onClick={async () => { if (hold) { await give(hold, "Held", holdWhy.trim()); setHold(null); } }}>Hold dose</button></>}>
        <FormRow label="Why is it being held?" required><FormInput value={holdWhy} onChange={setHoldWhy} placeholder="e.g. Patient vomiting, refused" /></FormRow>
      </Modal>
    </div>
  );
}

function HandoverCard({ ctx, date, editable, adding, setAdding }: { ctx: ChartCtx; date: string; editable: boolean; adding: string | null; setAdding: (v: string | null) => void }) {
  const q = (shift: string) => `/ipd/nurse/handover?shift=${shift}&date=${date}`;
  const m = useItem<{ notes: IpdHandoverDTO[] }>(q("Morning"));
  const e = useItem<{ notes: IpdHandoverDTO[] }>(q("Evening"));
  const n = useItem<{ notes: IpdHandoverDTO[] }>(q("Night"));
  const { run, loading, error } = useMutation();
  const cols = [["Morning", "7:00 am – 3:00 pm", m], ["Evening", "3:00 pm – 11:00 pm", e], ["Night", "11:00 pm – 7:00 am", n]] as const;
  return (
    <Card title="Shift handover" action={editable ? <LinkButton onClick={() => setAdding("")}><Plus size={11} className="mr-1 inline" />Add a handover note</LinkButton> : undefined}>
      {adding !== null && (
        <div className="mb-3 flex flex-col gap-2">
          <FormTextarea value={adding} onChange={setAdding} rows={2} placeholder="What the next shift needs to know…" />
          <ErrorLine error={error} />
          <div className="flex gap-2"><button className={`${btn.base} ${btn.solid}`} disabled={loading || adding.trim().length < 2} onClick={async () => { if (await done(run(() => api.post("/ipd/nurse/handover", { admissionId: ctx.id, note: adding.trim() })))) { setAdding(null); m.reload(); e.reload(); n.reload(); } }}>Save</button><button className={`${btn.base} ${btn.ghost}`} onClick={() => setAdding(null)}>Cancel</button></div>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        {cols.map(([name, hours, st]) => {
          const notes = (st.item?.notes ?? []).filter((x) => x.admissionId === ctx.id);
          return (
            <div key={name} className="rounded-[8px] border border-[color:var(--line)] p-3">
              <p className="text-[13px] font-medium text-[color:var(--ink)]">{name} <span className="text-[11px] font-normal text-[color:var(--ink-soft)]">{hours}</span></p>
              {notes.length === 0 ? <p className="mt-1 text-[12px] text-[color:var(--ink-soft)]">No handover notes.</p> : notes.map((x) => <p key={x.id} className="mt-1 text-[12px] text-[color:var(--ink)]">{x.note}<span className="text-[color:var(--ink-soft)]"> — {x.author}</span></p>)}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
