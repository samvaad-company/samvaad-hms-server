"use client";

/**
 * The selected patient's history as tags, kept apart so a doctor sees at a glance what matters before choosing medicines and doses:
 * surgeries, serious illnesses, other conditions and past diagnoses, allergies, habits and family history. Everything comes from the
 * patient's record and the diagnoses written on earlier prescriptions (no AI). "Ask KAYA" opens the assistant with this patient's
 * history and today's medicines already typed in.
 */
import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { useList } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import type { PatientDiagnosisDTO, PatientDTO } from "@/types/api";

/** Illnesses worth a second look when choosing a dose. A plain word list, not a guess by a model. */
const SERIOUS = /diabet|hypertens|high blood pressure|cancer|carcinoma|tumou?r|malignan|leuk|lymphoma|tubercul|\btb\b|stroke|paralysis|hemipleg|heart|cardiac|cardiomyo|myocardial|infarct|angina|coronary|arrhythm|renal|kidney|\bckd\b|dialysis|nephro|liver|cirrhosis|hepatitis|\bhiv\b|\baids\b|epilep|seizure|\bcopd\b|asthma|sepsis|thalass|sickle|hemophil|haemophil|transplant|pregnan|dementia|parkinson/i;

type Group = "surgery" | "serious" | "other" | "allergy" | "habit" | "family";
interface Tag { text: string; hint?: string }

const GROUPS: { key: Group; label: string; cls: string }[] = [
  { key: "surgery", label: "Surgeries", cls: "bg-[#efe6ff] text-[#5b2bb3]" },
  { key: "serious", label: "Serious illnesses", cls: "bg-[#ffe3e3] text-[#b3001b]" },
  { key: "other", label: "Other conditions and past diagnoses", cls: "bg-[color:var(--subtle-2)] text-[color:var(--ink)]" },
  { key: "allergy", label: "Allergies", cls: "bg-[#fff0d6] text-[#a35a00]" },
  { key: "habit", label: "Habits", cls: "bg-[#e6f3ff] text-[#0b5cad]" },
  { key: "family", label: "Family history", cls: "bg-[#dff7ee] text-[#0b7a47]" },
];

/** Sorts a patient's record into the groups above. */
export function historyTags(patient: PatientDTO | undefined, diagnoses: PatientDiagnosisDTO[]): Record<Group, Tag[]> {
  const out: Record<Group, Tag[]> = { surgery: [], serious: [], other: [], allergy: [], habit: [], family: [] };
  const seen = new Set<string>();
  const add = (g: Group, text: string, hint?: string) => {
    const t = text.trim();
    const k = `${g}:${t.toLowerCase()}`;
    if (!t || seen.has(k)) return;
    seen.add(k);
    out[g].push({ text: t, hint });
  };
  const illness = (text: string, hint?: string) => add(SERIOUS.test(text) ? "serious" : "other", text, hint);
  for (const e of patient?.history ?? []) {
    const text = `${e.text}${e.since ? ` (${e.since})` : ""}`;
    if (e.type === "Surgery") add("surgery", text);
    else if (e.type === "Allergy") add("allergy", text);
    else if (e.type === "Addiction") add("habit", text);
    else if (e.type === "Family") add("family", text);
    else if (e.type === "Time" || e.type === "Other") illness(text);
    else if (e.type === "Remarks") add(SERIOUS.test(e.text) ? "serious" : "other", text);
  }
  for (const a of patient?.allergies ?? []) add("allergy", a);
  for (const c of patient?.chronicConditions ?? []) illness(c, "On the patient's record");
  for (const d of diagnoses) illness(d.name, `${d.doctor ? `${d.doctor}, ` : ""}${d.recordedOn}${d.kind === "Secondary" ? " (secondary)" : ""}`);
  return out;
}

/** The illnesses on a patient's record, for suggesting the doctor's usual medicines. */
export function knownDiseases(tags: Record<Group, Tag[]>): string[] {
  return [...tags.serious, ...tags.other].map((t) => t.text.replace(/\s*\([^)]*\)\s*$/, "")).filter(Boolean);
}

export function PatientHistoryTags({ patient, diagnosesToday, medicinesToday, onDiseases }: { patient: PatientDTO | undefined; diagnosesToday: string[]; medicinesToday: string[]; onDiseases?: (d: string[]) => void }) {
  const { can } = useAuth();
  const { items: diagnoses, loading } = useList<PatientDiagnosisDTO>(patient ? `/patients/${patient.id}/diagnoses` : null, { all: true });
  const tags = historyTags(patient, diagnoses);
  const diseaseSig = knownDiseases(tags).join(";");
  useEffect(() => { onDiseases?.(diseaseSig ? diseaseSig.split(";") : []); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diseaseSig]);
  if (!patient) return null;
  const any = GROUPS.some((g) => tags[g.key].length > 0);

  function askKaya() {
    const list = (g: Group) => tags[g].map((t) => t.text).join(", ");
    const lines = [
      `I am writing a prescription for ${patient!.name}, ${patient!.age} years, ${patient!.gender ?? "gender not recorded"}.`,
      tags.surgery.length ? `Surgeries: ${list("surgery")}.` : "",
      tags.serious.length ? `Serious illnesses: ${list("serious")}.` : "",
      tags.other.length ? `Other conditions: ${list("other")}.` : "",
      tags.allergy.length ? `Allergies: ${list("allergy")}.` : "",
      diagnosesToday.length ? `Today's diagnosis: ${diagnosesToday.join("; ")}.` : "",
      medicinesToday.length ? `Medicines so far: ${medicinesToday.join("; ")}.` : "",
      "Given this history, please flag any dose that should be changed, any interaction between these medicines, and any conflict with the allergies.",
    ].filter(Boolean);
    // Opens the KAYA panel on the right with the question typed in; where there is no panel, falls back to the chat page in a new tab.
    const text = lines.join(" ");
    const ev = new CustomEvent<{ text: string; handled: boolean }>("kaya:ask", { detail: { text, handled: false } });
    window.dispatchEvent(ev);
    if (!ev.detail.handled) window.open(`/chat?ask=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  return (
    <div className="rounded-[10px] border border-[color:var(--line)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-medium text-[color:var(--ink)]">Patient history</h3>
          <p className="text-[11px] text-[color:var(--ink-soft)]">From the patient&apos;s record and earlier prescriptions. Check it before choosing doses.</p>
        </div>
        {can("chat") && (
          <button type="button" onClick={askKaya} className="inline-flex h-[32px] cursor-pointer items-center gap-2 rounded-full border border-[color:var(--brand)] px-4 text-[12px] font-medium text-[color:var(--brand)] hover:bg-[color:var(--brand-soft)]">
            <Sparkles size={13} /> Ask KAYA
          </button>
        )}
      </div>
      {!any ? (
        <p className="text-[12px] text-[color:var(--ink-soft)]">{loading ? "Loading the history…" : "Nothing on record yet: no surgeries, illnesses or allergies."}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {GROUPS.filter((g) => tags[g.key].length > 0).map((g) => (
            <div key={g.key} className="flex flex-wrap items-center gap-2">
              <span className="w-[190px] shrink-0 text-[11px] font-medium uppercase tracking-wide text-[color:var(--ink-soft)]">{g.label}</span>
              <div className="flex flex-wrap gap-1.5">
                {tags[g.key].map((t) => <span key={t.text} title={t.hint} className={`rounded-full px-3 py-[3px] text-[12px] ${g.cls}`}>{t.text}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
