"use client";

/**
 * A doctor's scheduling settings: how many patients they see per hour, whether
 * they take video consultations, and the weekly hours reserved for them. In a
 * video hour only video consultations can be booked; in every other working hour
 * only in-person visits can — so the two never compete for the same time.
 */
import { useState } from "react";
import { Loader2, Plus, Save, Trash2, Video } from "lucide-react";
import { useItem, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { FormRow, FormSelect } from "@/components/shared/FormRow";
import type { DoctorScheduleDTO } from "@/types/api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Window = { day: string; start: string; end: string };
interface FormState { patientsPerHour: number; videoEnabled: boolean; videoHours: Window[] }

const timeInput = "h-[42px] bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 text-[14px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] focus:bg-[color:var(--surface)] transition-colors disabled:opacity-50";

export function DoctorScheduleEditor({ doctorId, canEdit }: { doctorId: number; canEdit: boolean }) {
  const { item, reload } = useItem<DoctorScheduleDTO>(`/doctors/${doctorId}/schedule`);
  const { run, loading } = useMutation();
  // The form starts from the saved settings and only diverges once the user edits; no effect needed to sync it.
  const [edits, setEdits] = useState<Partial<FormState>>({});
  const [saved, setSaved] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!item) return <div className="p-6 text-[14px] text-[color:var(--ink-soft)]">Loading schedule…</div>;

  const form: FormState = {
    patientsPerHour: edits.patientsPerHour ?? item.patientsPerHour,
    videoEnabled: edits.videoEnabled ?? item.videoEnabled,
    videoHours: edits.videoHours ?? item.videoHours,
  };
  const edit = (patch: Partial<FormState>) => { setEdits(prev => ({ ...prev, ...patch })); setSaved(null); setError(null); };
  const setWindow = (i: number, patch: Partial<Window>) => edit({ videoHours: form.videoHours.map((w, j) => (j === i ? { ...w, ...patch } : w)) });
  const dirty = Object.keys(edits).length > 0;
  const minutes = 60 / form.patientsPerHour;
  const videoBlocked = !item.hospitalVideoEnabled;

  async function save() {
    setError(null);
    try {
      const res = await run(() => api.put<DoctorScheduleDTO>(`/doctors/${doctorId}/schedule`, form));
      setEdits({});
      setSaved(res?.warnings ?? []);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the schedule.");
    }
  }

  return (
    <div className="p-6 flex flex-col gap-8 max-w-[760px]">
      <section className="flex flex-col gap-3">
        <h3 className="text-[14px] font-medium text-[color:var(--ink)]">Patients per hour</h3>
        <p className="text-[12px] font-light text-[color:var(--ink-soft)]">
          Each patient gets an equal share of the hour. Once an hour&apos;s places are taken nobody can book it — reception, the patient app
          and the booking link all show that hour as <b className="font-medium">Full</b>.
        </p>
        <div className="max-w-[360px]">
          <FormRow label="Patients per hour" hint={`One patient every ${minutes} minute${minutes === 1 ? "" : "s"}`}>
            <FormSelect value={String(form.patientsPerHour)} disabled={!canEdit}
              onChange={v => edit({ patientsPerHour: Number(v) })}
              options={item.patientsPerHourOptions.map(n => ({ value: String(n), label: `${n} per hour (${60 / n} min each)` }))} />
          </FormRow>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-[14px] font-medium text-[color:var(--ink)] flex items-center gap-2"><Video size={15} /> Video consultations</h3>
        {videoBlocked && (
          <p className="text-[13px] text-[#ff9000] bg-[#fff2e0] rounded-[8px] px-3 py-2">
            Video consultations are switched off for the hospital, so they can&apos;t be turned on here yet. An administrator enables them in Admin → Settings.
          </p>
        )}
        <label className={`flex items-center gap-3 ${canEdit && !videoBlocked ? "cursor-pointer" : "opacity-60"}`}>
          <button type="button" role="switch" aria-checked={form.videoEnabled} disabled={!canEdit || (videoBlocked && !form.videoEnabled)}
            onClick={() => edit({ videoEnabled: !form.videoEnabled })}
            className={`w-[42px] h-[24px] rounded-full transition-colors relative shrink-0 ${form.videoEnabled ? "bg-[color:var(--brand)]" : "bg-[color:var(--line)]"}`}>
            <span className={`absolute top-[3px] w-[18px] h-[18px] bg-[color:var(--surface)] rounded-full shadow transition-all ${form.videoEnabled ? "left-[21px]" : "left-[3px]"}`} />
          </button>
          <span className="text-[13px] text-[color:var(--ink)]">{form.videoEnabled ? "I take video consultations" : "I don't take video consultations"}</span>
        </label>

        {form.videoEnabled && (
          <div className="flex flex-col gap-3">
            <p className="text-[12px] font-light text-[color:var(--ink-soft)]">
              Your video hours. Inside them only video consultations can be booked; at every other time in the working day only in-person
              visits can — a time is never offered for both.
            </p>
            {form.videoHours.length === 0 && (
              <p className="text-[13px] text-[color:var(--ink-soft)] bg-[color:var(--subtle)] rounded-[8px] px-3 py-2">No video hours yet — add at least one so patients can book a video consultation.</p>
            )}
            {form.videoHours.map((w, i) => (
              <div key={i} className="flex items-center gap-3 flex-wrap">
                <div className="w-[160px]">
                  <FormSelect value={w.day} disabled={!canEdit} onChange={v => setWindow(i, { day: v })} options={DAYS.map(d => ({ value: d, label: d }))} />
                </div>
                <input type="time" className={timeInput} value={w.start} disabled={!canEdit} onChange={e => setWindow(i, { start: e.target.value })} aria-label="From" />
                <span className="text-[12px] text-[color:var(--ink-soft)]">to</span>
                <input type="time" className={timeInput} value={w.end} disabled={!canEdit} onChange={e => setWindow(i, { end: e.target.value })} aria-label="To" />
                {canEdit && (
                  <button type="button" onClick={() => edit({ videoHours: form.videoHours.filter((_, j) => j !== i) })} aria-label="Remove these hours"
                    className="text-[#ff0004] p-2 rounded-full hover:bg-[#ffe9e9] cursor-pointer"><Trash2 size={15} /></button>
                )}
              </div>
            ))}
            {canEdit && (
              <button type="button" onClick={() => edit({ videoHours: [...form.videoHours, { day: "Monday", start: "16:00", end: "18:00" }] })}
                className="self-start inline-flex items-center gap-2 text-[13px] text-[color:var(--brand)] border border-[color:var(--brand)] px-4 py-[7px] rounded-full hover:bg-[color:var(--brand-soft)] cursor-pointer">
                <Plus size={14} /> Add video hours
              </button>
            )}
          </div>
        )}
      </section>

      {error && <p className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error}</p>}
      {saved && (
        <div className="text-[13px] bg-[#dffff3] text-[#00955c] rounded-[8px] px-3 py-2">
          Saved ✓
          {saved.map((w, i) => <p key={i} className="text-[#ff9000] mt-1">{w}</p>)}
        </div>
      )}
      {canEdit && (
        <div>
          <button onClick={save} disabled={loading || !dirty}
            className="inline-flex items-center gap-2 text-[13px] text-white bg-[color:var(--brand)] px-5 py-[9px] rounded-full hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save schedule
          </button>
        </div>
      )}
    </div>
  );
}
