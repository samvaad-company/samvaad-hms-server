import type { ReactNode } from "react";
import { bmiOf, filledFields } from "@/lib/consultation/templates";
import type { Consultation, ConsultationField } from "@/types/consultation";
import { formatDate } from "@/lib/dates";

const label = "text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="break-inside-avoid">
      <p className={`${label} mb-1`}>{title}</p>
      {children}
    </div>
  );
}

function Pairs({ fields }: { fields: ConsultationField[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-[2px] sm:grid-cols-2">
      {fields.map((f) => (
        <p key={f.id} className="text-[13px] text-[color:var(--ink)]">
          <span className="text-[color:var(--ink-soft)]">{f.label}: </span>
          <span className="font-medium">{f.value}{f.unit && f.kind === "text" ? ` ${f.unit}` : ""}</span>
        </p>
      ))}
    </div>
  );
}

/** What the doctor recorded, as read-only text. Empty parts are left out. `followUp` is shown with the treatment. */
export function ConsultationView({ c, diagnosis }: { c: Consultation; diagnosis?: string }) {
  const v = c.vitals;
  const bmi = bmiOf(v.weight, v.height);
  const vitals = [
    v.bp && `BP ${v.bp} mmHg`, v.pulse && `Pulse ${v.pulse}/min`, v.temp && `Temp ${v.temp} °F`, v.spo2 && `SpO₂ ${v.spo2}%`,
    v.weight && `Weight ${v.weight} kg`, v.height && `Height ${v.height} cm`, bmi && `BMI ${bmi}`,
  ].filter(Boolean) as string[];
  const history = ([["Past", c.history.past], ["Family", c.history.family], ["Personal", c.history.personal], ["Medical", c.history.medical]] as const).filter(([, t]) => t.trim());
  const general = filledFields(c.general);
  const systems = c.systemic.map((s) => ({ ...s, fields: filledFields(s.fields) })).filter((s) => s.fields.length > 0);
  const advice = ([["Diet", c.advice.diet], ["Exercise", c.advice.exercise], ["Other", c.advice.other]] as const).filter(([, t]) => t.trim());

  return (
    <div className="flex flex-col gap-4">
      {c.chiefComplaint.trim() && <Block title="Chief complaint"><p className="whitespace-pre-wrap text-[13px] text-[color:var(--ink)]">{c.chiefComplaint}</p></Block>}
      {history.length > 0 && (
        <Block title="History">
          {history.map(([k, t]) => <p key={k} className="text-[13px] text-[color:var(--ink)]"><span className="text-[color:var(--ink-soft)]">{k}: </span>{t}</p>)}
        </Block>
      )}
      {vitals.length > 0 && <Block title="Vitals"><p className="text-[13px] text-[color:var(--ink)]">{vitals.join("  ·  ")}</p></Block>}
      {general.length > 0 && <Block title="General examination"><Pairs fields={general} /></Block>}
      {systems.length > 0 && (
        <Block title="Systemic examination">
          <div className="flex flex-col gap-2">
            {systems.map((s) => (
              <div key={s.key}>
                <p className="text-[12px] font-semibold text-[color:var(--ink)]">{s.title}</p>
                <Pairs fields={s.fields} />
              </div>
            ))}
          </div>
        </Block>
      )}
      {c.investigations.length > 0 && <Block title="Investigations advised"><p className="text-[13px] text-[color:var(--ink)]">{c.investigations.join(", ")}</p></Block>}
      {(diagnosis || c.secondaryDiagnosis.trim()) && (
        <Block title="Diagnosis">
          {diagnosis && <p className="text-[13px] text-[color:var(--ink)]"><span className="text-[color:var(--ink-soft)]">Primary: </span>{diagnosis}</p>}
          {c.secondaryDiagnosis.trim() && <p className="text-[13px] text-[color:var(--ink)]"><span className="text-[color:var(--ink-soft)]">Secondary: </span>{c.secondaryDiagnosis}</p>}
        </Block>
      )}
      {advice.length > 0 && (
        <Block title="Advice">
          {advice.map(([k, t]) => <p key={k} className="text-[13px] text-[color:var(--ink)]"><span className="text-[color:var(--ink-soft)]">{k}: </span>{t}</p>)}
        </Block>
      )}
      {c.followUp && <Block title="Follow-up"><p className="text-[13px] text-[color:var(--ink)]">{formatDate(c.followUp)}</p></Block>}
    </div>
  );
}

export const hasConsultation = (c: Consultation | null | undefined): c is Consultation => !!c && typeof c === "object" && !!c.vitals;
