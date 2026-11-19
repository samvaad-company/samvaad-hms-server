/** Chief complaint templates (set up in Masters) and the sentence made from a doctor's answers. */
import type { SetupRecordDTO } from "@/types/setup";

export interface ComplaintOption { label: string; /** What goes in the sentence when this is picked; empty = leave it out. */ text: string }
export type QuestionKind = "single" | "multi" | "duration" | "text";
export interface ComplaintQuestion { id: string; title: string; kind: QuestionKind; optional: boolean; options: ComplaintOption[] }
export interface ComplaintTemplate { id: number; name: string; common: boolean; questions: ComplaintQuestion[] }

export const DURATION_UNITS = ["Hours", "Days", "Weeks", "Months", "Years"];
export const KIND_LABEL: Record<QuestionKind, string> = { single: "Choose one", multi: "Choose several", duration: "Duration", text: "Free text" };

/** What the doctor picked: the option labels, the typed text, or a duration. */
export type ComplaintAnswers = Record<string, { labels?: string[]; text?: string; n?: string; unit?: string }>;

export function toComplaint(r: SetupRecordDTO): ComplaintTemplate {
  const raw = Array.isArray(r.data.questions) ? (r.data.questions as Partial<ComplaintQuestion>[]) : [];
  return {
    id: r.id, name: r.name, common: r.data.common === true,
    questions: raw.map((q, i) => ({
      id: String(q.id ?? `q${i + 1}`), title: String(q.title ?? ""), kind: (q.kind as QuestionKind) ?? "single", optional: q.optional === true,
      options: Array.isArray(q.options) ? q.options.map((o) => ({ label: String(o?.label ?? ""), text: String(o?.text ?? "") })) : [],
    })),
  };
}

/** "Fever for 3 days, intermittent, with chills, with evening rise." */
export function sentenceOf(t: ComplaintTemplate, a: ComplaintAnswers, more = ""): string {
  let head = t.name;
  const parts: string[] = [];
  for (const q of t.questions) {
    const v = a[q.id];
    if (!v) continue;
    if (q.kind === "duration") {
      const n = (v.n ?? "").trim();
      if (n) head += ` for ${n} ${(v.unit ?? "days").toLowerCase()}`;
    } else if (q.kind === "text") {
      if (v.text?.trim()) parts.push(v.text.trim());
    } else {
      for (const label of v.labels ?? []) {
        const o = q.options.find((x) => x.label === label);
        if (o?.text.trim()) parts.push(o.text.trim());
      }
    }
  }
  if (more.trim()) parts.push(more.trim().replace(/[.\s]+$/, ""));
  return `${head}${parts.length ? `, ${parts.join(", ")}` : ""}.`;
}
