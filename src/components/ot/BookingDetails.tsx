"use client";

/**
 * One surgery in full: the case, the team, the equipment, and what can be done next — record anaesthetic
 * fitness, start, complete, cancel, reschedule. Shared by the side panel and the full detail page.
 */
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { formatDate } from "@/lib/dates";
import type { OtFitness, OtRecordDTO } from "@/types/api";
import { btn, hhmm, STATUS_STYLE, surgeryOf } from "@/components/ot/shared";

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">{label}</p>
      <p className={`text-[14px] text-[color:var(--ink)] ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}

const FITNESS_STYLE: Record<OtFitness, string> = {
  Pending: "bg-[color:var(--subtle)] text-[color:var(--ink-soft)] border-[color:var(--line)]",
  Fit: "bg-[#dffff3] text-[#0b7a47] border-[#9fe3c6]",
  Unfit: "bg-[#ffe3e5] text-[#b3001b] border-[#f4a3ac]",
};

export function BookingDetails({ b, canWrite, onChanged, onEdit, onDelete }: {
  b: OtRecordDTO;
  canWrite: boolean;
  onChanged: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { run, loading, error, reset } = useMutation();
  const closed = b.status === "Completed" || b.status === "Cancelled";

  async function patch(body: Record<string, unknown>) {
    reset();
    try { await run(() => api.patch(`/ot/${b.id}`, body)); } catch { return; }
    onChanged();
  }

  const time = b.startMinute != null ? `${hhmm(b.startMinute)}–${hhmm(b.endMinute ?? b.startMinute)}` : b.scheduledTime;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`rounded-full px-3 py-[2px] text-[12px] font-medium ${STATUS_STYLE[b.status].pill}`}>{b.status}</span>
        <span className="rounded-full border border-[color:var(--line)] px-3 py-[2px] text-[12px] text-[color:var(--ink)]">{b.caseType}</span>
        <span className="rounded-full border border-[color:var(--line)] px-3 py-[2px] text-[12px] text-[color:var(--ink)]">{b.category}</span>
        {b.allowOverlap && <span className="rounded-full border border-[#f3cf7d] bg-[#fff6dd] px-3 py-[2px] text-[12px] text-[#8a5300]">Overlap allowed</span>}
        <span className={`rounded-full border px-3 py-[2px] text-[12px] ${FITNESS_STYLE[b.fitness]}`}>Anaesthetic fitness: {b.fitness}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Booking no." value={b.bookingNo} mono />
        <Field label="Patient" value={`${b.patientName}${b.patientCode ? ` · ${b.patientCode}` : ""}`} />
        <Field label="Surgery" value={surgeryOf(b)} />
        <Field label="Procedure" value={b.procedure !== surgeryOf(b) ? b.procedure : ""} />
        {b.procedureCode && <Field label="Procedure code" value={b.procedureCode} mono />}
        <Field label="Theatre" value={b.otRoom} />
        <Field label="Date" value={formatDate(b.scheduledDate)} />
        <Field label="Time" value={time} mono />
        <Field label="Duration" value={`${b.actualMin ?? b.durationMin} min${b.actualMin != null ? " (actual)" : " (planned)"}`} />
      </div>

      <section>
        <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">Surgical team</h4>
        <div className="grid grid-cols-2 gap-4 rounded-[10px] border border-[color:var(--line)] p-4">
          <Field label="Surgeon" value={b.surgeon} />
          <Field label="Co-surgeon" value={b.coSurgeon} />
          <Field label="Anaesthetist" value={b.anesthetist} />
          <Field label="Anaesthesia" value={b.anaesthesiaType} />
          <Field label="Scrub nurse" value={b.scrubNurse} />
          <Field label="Circulating nurse" value={b.circulatingNurse} />
          <div className="col-span-2"><Field label="Technicians" value={b.technicians.join(", ")} /></div>
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">Equipment</h4>
        {b.equipment.length === 0 ? <p className="text-[14px] text-[color:var(--ink-soft)]">None booked.</p> : (
          <div className="flex flex-wrap gap-2">{b.equipment.map((e) => <span key={e} className="rounded-full border border-[color:var(--line)] bg-[color:var(--subtle)] px-3 py-[3px] text-[13px] text-[color:var(--ink)]">{e}</span>)}</div>
        )}
      </section>

      {b.specialRequirements && <Field label="Special requirements" value={b.specialRequirements} />}

      {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}

      {canWrite && (
        <div className="flex flex-col gap-3 border-t border-[color:var(--line)] pt-4">
          {!closed && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] text-[color:var(--ink-soft)]">Anaesthetic fitness</span>
              {(["Fit", "Unfit", "Pending"] as const).map((f) => (
                <button key={f} onClick={() => patch({ fitness: f })} disabled={loading || b.fitness === f} aria-pressed={b.fitness === f}
                  className={`${btn.base} ${b.fitness === f ? "bg-[color:var(--ink)] text-[color:var(--surface)]" : btn.ghost} !h-[30px] !text-[12px]`}>{f}</button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {b.status === "Scheduled" && <button onClick={() => patch({ status: "In Progress" })} disabled={loading} className={`${btn.base} ${btn.solid}`}>Start surgery</button>}
            {!closed && <button onClick={() => patch({ status: "Completed" })} disabled={loading} className={`${btn.base} ${btn.ghost}`}>Mark completed</button>}
            {!closed && onEdit && <button onClick={onEdit} className={`${btn.base} ${btn.ghost}`}>Edit / reschedule</button>}
            {!closed && <button onClick={() => patch({ status: "Cancelled" })} disabled={loading} className={`${btn.base} border border-[#f4a3ac] text-[#c8001a] hover:bg-[#ffe9e9]`}>Cancel surgery</button>}
            {onDelete && <button onClick={onDelete} className={`${btn.base} ml-auto text-[#c8001a] hover:bg-[#ffe9e9]`}>Delete</button>}
          </div>
          {b.status === "Scheduled" && b.fitness !== "Fit" && b.caseType !== "Emergency" && (
            <p className="text-[12px] text-[color:var(--ink-soft)]">Booking is never held up by fitness — but the surgery can only be started once the patient is recorded Fit (an emergency can start without it).</p>
          )}
        </div>
      )}
    </div>
  );
}
