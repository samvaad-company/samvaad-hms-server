"use client";

/**
 * A patient's vaccinations. Nothing is pre-filled: staff type each one in, and its date starts empty — it must be filled in, or the
 * person ticks "I don't know the exact date" (and may say roughly when).
 */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import type { PatientVaccinationDTO } from "@/types/api";
import { FormInput, FormRow, FormSelect } from "@/components/shared/FormRow";
import { formatDate, todayIso } from "@/lib/dates";

const COMMON = ["COVID-19", "Influenza", "Hepatitis B", "Hepatitis A", "BCG", "DPT / DTP", "Tetanus (Td / TT)", "Polio (OPV / IPV)", "MMR", "Measles", "Varicella (chickenpox)", "Typhoid", "Pneumococcal", "HPV", "Rotavirus", "Rabies", "Other"];
const EMPTY = { vaccine: "", other: "", dose: "", givenOn: "", dateUnknown: false, approxWhen: "", nextDue: "" };

export function VaccinationsTab({ patientId }: { patientId: number }) {
  const { can } = useAuth();
  const { items, reload } = useList<PatientVaccinationDTO>(`/patients/${patientId}/vaccinations`);
  const { run, loading, error, reset } = useMutation();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => { reset(); setF((x) => ({ ...x, [k]: v })); };
  const name = f.vaccine === "Other" ? f.other.trim() : f.vaccine;
  const ready = name.length >= 2 && (!!f.givenOn || f.dateUnknown);

  async function save() {
    try {
      await run(() => api.post(`/patients/${patientId}/vaccinations`, {
        vaccine: name, dose: f.dose.trim(), givenOn: f.dateUnknown ? "" : f.givenOn, dateUnknown: f.dateUnknown,
        approxWhen: f.dateUnknown ? f.approxWhen.trim() : "", nextDue: f.nextDue,
      }));
    } catch { return; }
    setF(EMPTY); setOpen(false); reload();
  }
  async function remove(v: PatientVaccinationDTO) {
    if (!confirm(`Remove ${v.vaccine}${v.dose ? ` (${v.dose})` : ""} from this patient's vaccinations?`)) return;
    try { await run(() => api.del(`/patients/${patientId}/vaccinations/${v.id}`)); reload(); } catch { /* shown below */ }
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[color:var(--ink-soft)]">Vaccinations recorded for this patient. Enter the date of each; if it isn&apos;t known, say so.</p>
        {can("patients", "add") && !open && (
          <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand)] px-4 py-[7px] text-[13px] text-white hover:bg-[color:var(--brand-hover)] cursor-pointer"><Plus size={13} /> Add vaccination</button>
        )}
      </div>

      {open && (
        <section className="rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface)] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormRow label="Vaccine" required><FormSelect placeholder="Choose a vaccine" value={f.vaccine} onChange={(v) => set("vaccine", v)} options={COMMON.map((c) => ({ value: c, label: c }))} /></FormRow>
            {f.vaccine === "Other" && <FormRow label="Vaccine name" required><FormInput placeholder="Name of the vaccine" value={f.other} onChange={(v) => set("other", v)} /></FormRow>}
            <FormRow label="Dose"><FormInput placeholder="e.g. Dose 1, Booster, Annual" value={f.dose} onChange={(v) => set("dose", v)} /></FormRow>
            <FormRow label="Date given" required>
              <FormInput type="date" max={todayIso()} disabled={f.dateUnknown} value={f.givenOn} onChange={(v) => set("givenOn", v)} error={!f.givenOn && !f.dateUnknown && !!error} />
            </FormRow>
            <FormRow label="Next due (optional)"><FormInput type="date" min={todayIso()} value={f.nextDue} onChange={(v) => set("nextDue", v)} /></FormRow>
          </div>
          <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-[13px] text-[color:var(--ink)]">
            <input type="checkbox" checked={f.dateUnknown} onChange={(e) => { set("dateUnknown", e.target.checked); if (e.target.checked) set("givenOn", ""); }} />
            I don&apos;t know the exact date
          </label>
          {f.dateUnknown && (
            <div className="mt-3 max-w-[360px]"><FormRow label="Roughly when? (optional)"><FormInput placeholder="e.g. 2021, or March 2021, or as a child" value={f.approxWhen} onChange={(v) => set("approxWhen", v)} /></FormRow></div>
          )}
          {!f.givenOn && !f.dateUnknown && <p className="mt-2 text-[12px] text-[color:var(--ink-soft)]">Enter the date, or tick &ldquo;I don&apos;t know the exact date&rdquo;.</p>}
          {error && <p role="alert" className="mt-3 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#ff0004]">{error.message}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={save} disabled={!ready || loading} className="rounded-full bg-[color:var(--brand)] px-5 py-[7px] text-[13px] text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">{loading ? "Saving…" : "Save vaccination"}</button>
            <button type="button" onClick={() => { setOpen(false); setF(EMPTY); reset(); }} className="rounded-full border border-[color:var(--line)] px-5 py-[7px] text-[13px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer">Cancel</button>
          </div>
        </section>
      )}

      <div className="overflow-x-auto rounded-[12px] border border-[color:var(--line)]">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead className="bg-[color:var(--subtle-3)] text-[12px] text-[color:var(--ink)]">
            <tr>{["Vaccine", "Dose", "Date given", "Next due", "Recorded by", ""].map((h) => <th key={h} className="px-4 py-[10px] font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[color:var(--ink-soft)]">No vaccinations recorded yet.</td></tr>
            ) : items.map((v) => (
              <tr key={v.id} className="border-t border-[color:var(--subtle-2)] hover:bg-[color:var(--faint)]">
                <td className="px-4 py-3 font-medium text-[color:var(--ink)]">{v.vaccine}</td>
                <td className="px-4 py-3 text-[color:var(--ink-soft)]">{v.dose || "—"}</td>
                <td className="px-4 py-3 text-[color:var(--ink)]">
                  {v.givenOn ? formatDate(v.givenOn) : <span className="text-[color:var(--ink-soft)]">Exact date not known{v.approxWhen ? ` · about ${v.approxWhen}` : ""}</span>}
                </td>
                <td className="px-4 py-3 text-[color:var(--ink-soft)]">{v.nextDue ? formatDate(v.nextDue) : "—"}</td>
                <td className="px-4 py-3 text-[12px] text-[color:var(--ink-soft)]">{v.recordedBy || "—"}</td>
                <td className="px-4 py-3 text-right">{can("patients", "edit") && <button type="button" aria-label={`Remove ${v.vaccine}`} onClick={() => remove(v)} className="cursor-pointer text-[#c8c8cc] hover:text-[#ff0004]"><Trash2 size={14} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
