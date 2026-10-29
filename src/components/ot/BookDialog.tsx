"use client";

/**
 * Book a surgery (or edit / reschedule one). Pick the patient, the case, the theatre and time, the surgical
 * team and the equipment. As you choose, the dialog checks the slot against what is already booked — the
 * theatre and equipment are held for a 15-minute turnaround, and a surgeon or anaesthetist can't be in two
 * places — and says what clashes before you press Book. "Allow overlap" skips that check; equipment under
 * maintenance can never be booked.
 */
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormSelect, FormTextarea } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import {
  OT_ANAESTHESIA_TYPES,
  type OtCaseType,
  type OtCategory,
  type OtConflictDTO,
  type OtOptionsDTO,
  type OtRecordDTO,
  type PatientDTO,
} from "@/types/api";
import { todayLocal, type SlotRequest } from "@/components/ot/shared";

const CASE_TYPES: OtCaseType[] = ["Elective", "Emergency", "Outdoor"];
const CATEGORIES: OtCategory[] = ["Major", "Minor", "Daycare"];
const DURATIONS = [30, 60, 90, 120, 180];

const pill = (active: boolean) =>
  `h-[32px] px-4 rounded-full border text-[13px] cursor-pointer whitespace-nowrap transition-colors ${
    active ? "bg-[color:var(--subtle-2)] border-[color:var(--line)] text-[color:var(--ink)] font-medium" : "bg-[color:var(--surface)] border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]"
  }`;
const label = "text-[14px] font-medium text-[color:var(--ink)]";

interface Form {
  patientId: string; caseType: OtCaseType; surgeryName: string; category: string; procedure: string; procedureCode: string;
  when: string; durationMin: string; roomId: string;
  surgeonId: string; coSurgeonId: string; anesthetistId: string; anaesthesiaType: string;
  scrubNurseId: string; circulatingNurseId: string; tech1: string; tech2: string; tech3: string;
  equipmentIds: number[]; specialRequirements: string; allowOverlap: boolean;
}

function initial(b: OtRecordDTO | null | undefined, slot: SlotRequest | null | undefined): Form {
  const s = (v: number | null | undefined) => (v ? String(v) : "");
  if (b) {
    return {
      patientId: s(b.patientId), caseType: b.caseType, surgeryName: b.surgeryName, category: b.category, procedure: b.procedure === b.surgeryName ? "" : b.procedure, procedureCode: b.procedureCode,
      when: `${b.scheduledDate}T${b.startMinute != null ? `${String(Math.floor(b.startMinute / 60)).padStart(2, "0")}:${String(b.startMinute % 60).padStart(2, "0")}` : "09:00"}`,
      durationMin: String(b.durationMin), roomId: s(b.roomId),
      surgeonId: s(b.surgeonId), coSurgeonId: s(b.coSurgeonId), anesthetistId: s(b.anesthetistId), anaesthesiaType: b.anaesthesiaType,
      scrubNurseId: s(b.scrubNurseId), circulatingNurseId: s(b.circulatingNurseId),
      tech1: s(b.technicianIds[0]), tech2: s(b.technicianIds[1]), tech3: s(b.technicianIds[2]),
      equipmentIds: b.equipmentIds, specialRequirements: b.specialRequirements, allowOverlap: b.allowOverlap,
    };
  }
  return {
    patientId: "", caseType: "Elective", surgeryName: "", category: "", procedure: "", procedureCode: "",
    when: `${slot?.date ?? todayLocal()}T${slot?.time ?? "09:00"}`, durationMin: "60", roomId: s(slot?.roomId),
    surgeonId: "", coSurgeonId: "", anesthetistId: "", anaesthesiaType: "", scrubNurseId: "", circulatingNurseId: "", tech1: "", tech2: "", tech3: "",
    equipmentIds: [], specialRequirements: "", allowOverlap: false,
  };
}

export function BookDialog({ open, onClose, onSaved, slot, editing }: {
  open: boolean;
  onClose: () => void;
  onSaved: (b: OtRecordDTO) => void;
  /** An empty hour the user clicked, to start from. */
  slot?: SlotRequest | null;
  /** A surgery to edit or reschedule; patient can't be changed. */
  editing?: OtRecordDTO | null;
}) {
  // Remounted per opening (see the key at the call site), so the form starts from the right values.
  const { item: opts } = useItem<OtOptionsDTO>("/ot/options");
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { run, loading, error, reset } = useMutation();
  const [f, setF] = useState<Form>(() => initial(editing, slot));
  const [preview, setPreview] = useState<{ conflicts: OtConflictDTO[]; offline: string[] }>({ conflicts: [], offline: [] });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const [date, time] = f.when.split("T");
  const rooms = opts?.rooms ?? [];
  const doctors = opts?.doctors ?? [];
  const nurses = opts?.nurses ?? [];
  const techs = opts?.technicians ?? [];
  const num = (s: string) => (s ? Number(s) : undefined);
  const technicianIds = [f.tech1, f.tech2, f.tech3].filter(Boolean).map(Number);

  // Ask the server what the chosen slot clashes with, shortly after the user stops changing it.
  const key = JSON.stringify([date, time, f.durationMin, f.roomId, f.surgeonId, f.coSurgeonId, f.anesthetistId, f.equipmentIds, editing?.id]);
  useEffect(() => {
    if (!open || !date || !time || !f.roomId) return;
    let live = true;
    const t = setTimeout(async () => {
      try {
        const res = await api.post<{ conflicts: OtConflictDTO[]; offline: string[] }>("/ot/conflicts", {
          scheduledDate: date, scheduledTime: time, durationMin: num(f.durationMin) ?? 60, roomId: num(f.roomId),
          surgeonId: num(f.surgeonId), coSurgeonId: num(f.coSurgeonId), anesthetistId: num(f.anesthetistId), equipmentIds: f.equipmentIds, excludeId: editing?.id,
        });
        if (live) setPreview(res);
      } catch { /* the server checks again on save */ }
    }, 350);
    return () => { live = false; clearTimeout(t); };
    // `key` carries every input of the check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, open]);

  const clashing = useMemo(() => new Set(preview.conflicts.filter((c) => c.kind === "equipment").map((c) => c.refId)), [preview]);
  const blocked = preview.conflicts.length > 0 && !f.allowOverlap;
  const valid = Boolean(f.patientId || editing) && f.surgeryName.trim().length >= 2 && f.roomId && date && time && f.surgeonId && (num(f.durationMin) ?? 0) >= 15;

  function close() { reset(); onClose(); }

  async function save() {
    const patient = patients.find((p) => String(p.id) === f.patientId);
    const body = {
      ...(editing ? {} : { patientId: num(f.patientId), patientName: patient?.name ?? "" }),
      surgeryName: f.surgeryName.trim(), procedure: f.procedure.trim() || f.surgeryName.trim(), caseType: f.caseType,
      category: f.category || rooms.find((r) => String(r.id) === f.roomId)?.kind || "Major", procedureCode: f.procedureCode.trim(),
      roomId: num(f.roomId), scheduledDate: date, scheduledTime: time, durationMin: num(f.durationMin) ?? 60,
      surgeonId: num(f.surgeonId), coSurgeonId: editing ? (num(f.coSurgeonId) ?? null) : num(f.coSurgeonId),
      anesthetistId: editing ? (num(f.anesthetistId) ?? null) : num(f.anesthetistId),
      anaesthesiaType: f.anaesthesiaType || undefined,
      scrubNurseId: editing ? (num(f.scrubNurseId) ?? null) : num(f.scrubNurseId),
      circulatingNurseId: editing ? (num(f.circulatingNurseId) ?? null) : num(f.circulatingNurseId),
      technicianIds, equipmentIds: f.equipmentIds, specialRequirements: f.specialRequirements.trim(), allowOverlap: f.allowOverlap,
    };
    let saved: OtRecordDTO | null = null;
    try {
      await run(async () => {
        saved = editing ? await api.patch<OtRecordDTO>(`/ot/${editing.id}`, body) : await api.post<OtRecordDTO>("/ot", body);
        return saved;
      });
    } catch { return; }
    close();
    if (saved) onSaved(saved);
  }

  const person = (k: keyof Form, list: { id: number; name: string }[], placeholder = "-") => (
    <FormSelect placeholder={placeholder} value={f[k] as string} onChange={(v) => set(k, v as never)} options={[{ value: "", label: "-" }, ...list.map((d) => ({ value: String(d.id), label: d.name }))]} />
  );

  return (
    <Modal open={open} onClose={close} width={680} title={editing ? "Edit surgery" : "Book surgery"}
      subtitle={`Books the theatre + equipment with a ${opts?.bufferMin ?? 15}-minute turnaround buffer; the OT number is issued on booking. Anaesthetic fitness never blocks booking - only the start.`}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-[12px] text-[color:var(--ink-soft)]">{blocked ? "Resolve the clashes, or allow overlap." : ""}</span>
          <div className="flex items-center gap-2">
            <button onClick={close} className="h-[36px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 text-[13px] font-medium text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer transition-colors">Cancel</button>
            <button onClick={save} disabled={loading || !valid || blocked} className="h-[36px] rounded-[8px] bg-[color:var(--brand)] px-6 text-[13px] font-medium text-white hover:bg-[color:var(--brand-hover)] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Saving…" : editing ? "Save" : "Book"}
            </button>
          </div>
        </div>
      }>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className={label}>Patient</span>
          {editing ? (
            <p className="text-[14px] text-[color:var(--ink)]">{editing.patientName} {editing.patientCode && <span className="font-mono text-[12px] text-[color:var(--ink-soft)]">{editing.patientCode}</span>}</p>
          ) : (
            <SearchSelect placeholder="Search patient…" value={f.patientId} onChange={(v) => set("patientId", v)}
              options={patients.map((p) => ({ value: String(p.id), label: p.name, hint: `${p.patientId ?? ""} · ${p.phone}` }))} />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className={label}>Case type</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Case type">
            {CASE_TYPES.map((c) => <button key={c} type="button" role="radio" aria-checked={f.caseType === c} onClick={() => set("caseType", c)} className={pill(f.caseType === c)}>{c}</button>)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2"><span className={label}>Surgery name</span><FormInput placeholder="Laparoscopic appendicectomy" value={f.surgeryName} onChange={(v) => set("surgeryName", v)} /></div>
          <div className="flex flex-col gap-2"><span className={label}>Category</span>
            <FormSelect placeholder={rooms.find((r) => String(r.id) === f.roomId)?.kind ?? "Major / Minor / Daycare"} value={f.category} onChange={(v) => set("category", v)} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </div>
          <div className="flex flex-col gap-2"><span className={label}>Procedure (free text)</span><FormInput placeholder="e.g. Appendicectomy" value={f.procedure} onChange={(v) => set("procedure", v)} /></div>
          <div className="flex flex-col gap-2"><span className={label}>Procedure code</span><FormInput placeholder="ICD-10-PCS / CPT" value={f.procedureCode} onChange={(v) => set("procedureCode", v)} /></div>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: "1.4fr 1fr 1fr" }}>
          <div className="flex flex-col gap-2"><span className={label}>Date &amp; time</span><FormInput type="datetime-local" value={f.when} onChange={(v) => set("when", v)} /></div>
          <div className="flex flex-col gap-2"><span className={label}>Duration (min)</span><FormInput type="number" min="15" value={f.durationMin} onChange={(v) => set("durationMin", v)} /></div>
          <div className="flex flex-col gap-2"><span className={label}>OT room</span>
            <FormSelect placeholder="Select" value={f.roomId} onChange={(v) => set("roomId", v)} options={rooms.map((r) => ({ value: String(r.id), label: r.name }))} />
          </div>
        </div>
        <div className="-mt-3 flex flex-wrap gap-2">
          {DURATIONS.map((d) => <button key={d} type="button" onClick={() => set("durationMin", String(d))} className={`${pill(f.durationMin === String(d))} !h-[26px] !px-3 !text-[12px]`}>{d} min</button>)}
        </div>

        {f.roomId && preview.conflicts.length > 0 && (
          <div role="alert" className={`flex gap-3 rounded-[10px] border px-4 py-3 text-[13px] ${f.allowOverlap ? "border-[#f3cf7d] bg-[#fff6dd] text-[#7a4700]" : "border-[#f4a3ac] bg-[#ffe3e5] text-[#8f0016]"}`}>
            <AlertTriangle size={16} className="mt-[2px] shrink-0" />
            <div>
              <p className="font-medium">{f.allowOverlap ? "These clashes will be ignored" : "This slot clashes"}</p>
              <ul className="mt-1 list-disc pl-4">{preview.conflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul>
            </div>
          </div>
        )}
        {f.roomId && preview.conflicts.length === 0 && date && time && (
          <p className="-mt-2 text-[12px] text-[#0b7a47]">✓ Theatre, team and equipment are free for this slot (plus {opts?.bufferMin ?? 15} min turnaround).</p>
        )}

        <section className="rounded-[10px] border border-[color:var(--line)] p-4">
          <p className="mb-3 text-[15px] font-medium text-[color:var(--ink)]">Surgical team</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="flex flex-col gap-2"><span className={label}>Surgeon</span>{person("surgeonId", doctors, "Select")}</div>
            <div className="flex flex-col gap-2"><span className={label}>Co-surgeon</span>{person("coSurgeonId", doctors)}</div>
            <div className="flex flex-col gap-2"><span className={label}>Anaesthetist</span>{person("anesthetistId", doctors)}</div>
            <div className="flex flex-col gap-2"><span className={label}>Anaesthesia</span>
              <FormSelect placeholder="Type" value={f.anaesthesiaType} onChange={(v) => set("anaesthesiaType", v)} options={[{ value: "", label: "-" }, ...OT_ANAESTHESIA_TYPES.map((a) => ({ value: a, label: a }))]} />
            </div>
            <div className="flex flex-col gap-2"><span className={label}>Scrub nurse</span>{person("scrubNurseId", nurses)}</div>
            <div className="flex flex-col gap-2"><span className={label}>Circulating nurse</span>{person("circulatingNurseId", nurses)}</div>
            <div className="col-span-2 grid grid-cols-3 gap-4">
              {(["tech1", "tech2", "tech3"] as const).map((k, i) => (
                <div key={k} className="flex flex-col gap-2"><span className={label}>Technician {i + 1}</span>{person(k, techs)}</div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <span className={label}>Equipment</span>
          <div className="flex flex-wrap gap-2">
            {(opts?.equipment ?? []).map((e) => {
              const on = f.equipmentIds.includes(e.id);
              const down = e.status === "Maintenance";
              return (
                <button key={e.id} type="button" disabled={down} aria-pressed={on} title={down ? `${e.name} — out for maintenance${e.note ? `: ${e.note}` : ""}` : clashing.has(e.id) ? "In use at this time" : undefined}
                  onClick={() => setF((x) => ({ ...x, equipmentIds: x.equipmentIds.includes(e.id) ? x.equipmentIds.filter((id) => id !== e.id) : [...x.equipmentIds, e.id] }))}
                  className={`h-[32px] px-4 rounded-full border text-[13px] whitespace-nowrap transition-colors ${down ? "cursor-not-allowed text-[color:var(--ink-soft)] line-through opacity-70 border-[color:var(--line)]"
                    : on ? `cursor-pointer bg-[color:var(--subtle-2)] text-[color:var(--ink)] font-medium ${clashing.has(e.id) ? "border-[#f4a3ac]" : "border-[color:var(--ink-soft)]"}`
                    : `cursor-pointer bg-[color:var(--surface)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] ${clashing.has(e.id) ? "border-[#f3cf7d]" : "border-[color:var(--line)]"}`}`}>
                  {e.name}{down ? " - maintenance" : ""}
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex flex-col gap-2">
          <span className={label}>Special requirements</span>
          <FormTextarea rows={2} placeholder="Implants, blood reservation, positioning aids" value={f.specialRequirements} onChange={(v) => set("specialRequirements", v)} />
        </div>

        <label className="flex cursor-pointer items-center gap-3 text-[14px] text-[color:var(--ink)]">
          <button type="button" role="switch" aria-checked={f.allowOverlap} onClick={() => set("allowOverlap", !f.allowOverlap)}
            className={`relative h-[22px] w-[40px] rounded-full transition-colors cursor-pointer ${f.allowOverlap ? "bg-[color:var(--brand)]" : "bg-[color:var(--subtle-2)]"}`}>
            <span className={`absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${f.allowOverlap ? "translate-x-[18px]" : ""}`} />
          </button>
          Allow overlap (skip the conflict check)
        </label>

        {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
      </div>
    </Modal>
  );
}
