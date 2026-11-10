"use client";

/**
 * The two optional loyalty links on an appointment: who referred this patient, and whose family they are booked under (with how
 * they are related). Used when booking and when editing an appointment. These feed the loyalty programme's points.
 */
import { useMemo, useState } from "react";
import { Pencil, Users } from "lucide-react";
import { FormRow, FormSelect } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { tw } from "@/lib/design-system";
import type { AppointmentDTO, PatientDTO } from "@/types/api";

export const RELATIONS = ["Spouse", "Father", "Mother", "Son", "Daughter", "Brother", "Sister", "Grandparent", "Other"];

export interface LinkValues { referredBy: string; familyOf: string; relation: string }

export function LoyaltyLinksFields({ patients, ownPatientId, value, onChange }: { patients: PatientDTO[]; ownPatientId: string; value: LinkValues; onChange: (v: LinkValues) => void }) {
  // Not the patient themselves; "None" clears the link.
  const options = useMemo(() => [{ value: "", label: "None" }, ...patients.filter((p) => String(p.id) !== ownPatientId).map((p) => ({ value: String(p.id), patientId: p.id, label: p.name, hint: `${p.patientId ?? ""} · ${p.phone}` }))], [patients, ownPatientId]);
  return (
    <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
      <FormRow label="Referred by (optional)">
        <SearchSelect placeholder="Search a patient…" value={value.referredBy} onChange={(v) => onChange({ ...value, referredBy: v })} options={options} />
      </FormRow>
      <FormRow label="Family of (optional)">
        <SearchSelect placeholder="Search a patient…" value={value.familyOf} onChange={(v) => onChange({ ...value, familyOf: v, relation: v ? value.relation : "" })} options={options} />
      </FormRow>
      <FormRow label="Relation">
        <FormSelect placeholder="Select…" value={value.relation} disabled={!value.familyOf} onChange={(v) => onChange({ ...value, relation: v })} options={[{ value: "", label: "Not said" }, ...RELATIONS.map((r) => ({ value: r, label: r }))]} />
      </FormRow>
    </div>
  );
}

/** On the appointment page: who referred them and whose family, with an Edit for receptionists and doctors. */
export function AppointmentLoyaltyCard({ appt, patients, canEdit, onSaved }: { appt: AppointmentDTO; patients: PatientDTO[]; canEdit: boolean; onSaved: () => void }) {
  const { run, loading, error } = useMutation();
  const [editing, setEditing] = useState(false);
  const initial: LinkValues = { referredBy: appt.referredByPatientId ? String(appt.referredByPatientId) : "", familyOf: appt.familyOfPatientId ? String(appt.familyOfPatientId) : "", relation: appt.familyRelation ?? "" };
  const [v, setV] = useState<LinkValues>(initial);

  async function save() {
    await run(() => api.put(`/appointments/${appt.id}/links`, { referredByPatientId: v.referredBy ? Number(v.referredBy) : null, familyOfPatientId: v.familyOf ? Number(v.familyOf) : null, familyRelation: v.relation || null }));
    setEditing(false);
    onSaved();
  }

  if (!canEdit && !appt.referredByName && !appt.familyOfName) return null;
  return (
    <div className={`${tw.surface.card} ${tw.radius.card} p-6`}>
      <div className="mb-3 flex items-center gap-2">
        <Users size={15} className="text-[color:var(--ink-soft)]" />
        <div className="text-[14px] font-medium text-[color:var(--ink)]">Referral &amp; family</div>
        <span className="text-[12px] text-[color:var(--ink-soft)]">optional · counts towards loyalty points</span>
        {canEdit && !editing && <button onClick={() => { setV(initial); setEditing(true); }} className="ml-auto inline-flex h-[28px] items-center gap-1 rounded-full border border-[color:var(--line)] px-3 text-[12px] hover:bg-[color:var(--subtle)] cursor-pointer"><Pencil size={12} /> Edit</button>}
      </div>
      {editing ? (
        <div className="flex flex-col gap-3">
          <LoyaltyLinksFields patients={patients} ownPatientId={appt.patientId ? String(appt.patientId) : ""} value={v} onChange={setV} />
          {error && <p className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#ff0004]">{error.message}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={loading} className="rounded-full bg-[color:var(--brand)] px-5 py-[7px] text-[13px] text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">{loading ? "Saving…" : "Save"}</button>
            <button onClick={() => setEditing(false)} className="rounded-full border border-[color:var(--line)] px-5 py-[7px] text-[13px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer">Cancel</button>
          </div>
        </div>
      ) : (
        <dl className="grid grid-cols-1 gap-3 text-[14px] sm:grid-cols-2">
          <div><dt className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">Referred by</dt><dd className="mt-[2px]">{appt.referredByName ?? "—"}</dd></div>
          <div><dt className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">Family of</dt><dd className="mt-[2px]">{appt.familyOfName ? `${appt.familyOfName}${appt.familyRelation ? ` (${appt.familyRelation})` : ""}` : "—"}</dd></div>
        </dl>
      )}
    </div>
  );
}
