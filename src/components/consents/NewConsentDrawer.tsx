"use client";

/**
 * "New consent": pick a form, pick the language the patient reads, see exactly what they will read, then make it.
 * Making a consent sends nothing — afterwards it can be printed to sign on paper, signed on paper, or sent to a phone.
 */
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { CONSENT_LANGUAGES, LANGUAGE_NAME, LANGUAGE_TAG, type ConsentLanguage } from "@/types/consent-catalog";
import type { ConsentDTO, ConsentTemplateDTO, PatientDTO } from "@/types/api";
import { ErrorNote, attempt, cancelBtn } from "@/components/mrd/shared";

/** The patient's preferred language when it is one we have forms in; otherwise English. */
export function patientLanguage(language: string | null | undefined): ConsentLanguage {
  const l = (language ?? "").trim().toLowerCase();
  return CONSENT_LANGUAGES.find((x) => x.toLowerCase() === l || LANGUAGE_NAME[x].toLowerCase() === l) ?? "English";
}

export interface ConsentPatient { id: number; name: string; language?: string | null }

export function NewConsentDrawer({ patient, onClose, onMade }: {
  /** Who it is for; null lets the user pick one (used from the MRD signatures page). */
  patient: ConsentPatient | null;
  onClose: () => void;
  onMade: (consent: ConsentDTO, andPrint: boolean) => void;
}) {
  const { items: patients } = useList<PatientDTO>(patient ? null : "/patients", { all: true });
  const [pickedId, setPickedId] = useState("");
  const picked = patient ?? (() => { const p = patients.find((x) => String(x.id) === pickedId); return p ? { id: p.id, name: p.name, language: p.language } : null; })();
  const theirs = patientLanguage(picked?.language);

  const { items: all } = useList<ConsentTemplateDTO>("/consents/templates");
  const templates = useMemo(() => all.filter((t) => t.active), [all]);
  const [query, setQuery] = useState("");
  const [formKey, setFormKey] = useState<string | null>(null);
  const [chosen, setChosen] = useState<ConsentLanguage | null>(null);
  const form = templates.find((t) => t.key === formKey) ?? templates[0] ?? null;
  const offered = CONSENT_LANGUAGES.filter((l) => form?.languages.includes(l));
  // The patient's language when this form has it, otherwise English.
  const language: ConsentLanguage = chosen && offered.includes(chosen) ? chosen : offered.includes(theirs) ? theirs : "English";
  const [english, setEnglish] = useState(false);
  const { run, loading, error } = useMutation();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((f) => !q || Object.values(f.titles).some((t) => t.toLowerCase().includes(q)) || Object.values(f.bodies).some((b) => b.toLowerCase().includes(q)));
  }, [query, templates]);
  /** The wording as the patient will see it, with the patient's name and today's date filled in. */
  const fill = (text: string) => text
    .replace(/\{\{\s*patient_name\s*\}\}/gi, picked?.name ?? "…")
    .replace(/\{\{\s*age\s*\}\}/gi, "…")
    .replace(/\{\{\s*date\s*\}\}/gi, new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }));

  async function make(andPrint: boolean) {
    if (!picked || !form) return;
    let made: ConsentDTO | null = null;
    const ok = await attempt(run(async () => { made = await api.post<ConsentDTO>(`/patients/${picked.id}/consents`, { template: form.key, language, includeEnglish: english && language !== "English" }); }));
    if (ok && made) onMade(made, andPrint);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="New consent">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative flex h-full w-[600px] max-w-full flex-col bg-[color:var(--surface)] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[color:var(--line)] px-6 py-5">
          <div>
            <h2 className="text-[20px] font-semibold text-[color:var(--ink)]">New consent</h2>
            <p className="mt-1 text-[14px] text-[color:var(--ink-soft)]">{picked ? `For ${picked.name} · ` : ""}prints and e-signs in the language you pick</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-[8px] p-1 text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer"><X size={20} /></button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!patient && (
            <section className="mb-6">
              <h3 className="mb-2 text-[14px] font-semibold text-[color:var(--ink)]">Patient</h3>
              <SearchSelect placeholder="Search a patient…" value={pickedId} onChange={setPickedId} options={patients.map((p) => ({ value: String(p.id), label: p.name, hint: `${p.patientId} ${p.phone}` }))} />
            </section>
          )}

          <section>
            <h3 className="text-[14px] font-semibold text-[color:var(--ink)]">1. Which form?</h3>
            <label className="relative mt-2 block">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search forms" aria-label="Search forms"
                className="h-[44px] w-full rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] pl-9 pr-3 text-[14px] focus:border-[color:var(--brand)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ring)]" />
            </label>
            <ul className="mt-3 flex flex-col gap-2">
              {shown.map((f) => (
                <li key={f.key}>
                  <button onClick={() => setFormKey(f.key)} aria-pressed={f.key === form?.key}
                    className={`w-full rounded-[10px] border px-4 py-3 text-left cursor-pointer transition-colors ${f.key === form?.key ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)]" : "border-[color:var(--line)] hover:bg-[color:var(--subtle)]"}`}>
                    <p className="text-[15px] font-medium text-[color:var(--ink)]">{f.titles.English}{!f.builtIn && <span className="ml-2 rounded-full bg-[color:var(--subtle-2)] px-2 py-[1px] align-middle text-[11px] font-normal text-[color:var(--ink-soft)]">Your template</span>}</p>
                    <p className="mt-1 line-clamp-2 text-[13px] text-[color:var(--ink-soft)]">{fill(f.bodies.English)}</p>
                    <p className="mt-2 text-[12px] text-[color:var(--ink-soft)]">{CONSENT_LANGUAGES.filter((l) => f.languages.includes(l)).map((l) => LANGUAGE_NAME[l]).join(" · ")}</p>
                  </button>
                </li>
              ))}
              {shown.length === 0 && <li className="py-4 text-center text-[14px] text-[color:var(--ink-soft)]">No form matches that.</li>}
            </ul>
          </section>

          <section className="mt-6">
            <h3 className="text-[14px] font-semibold text-[color:var(--ink)]">2. In which language?</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {offered.map((l) => (
                <button key={l} onClick={() => setChosen(l)} aria-pressed={l === language}
                  className={`h-[34px] rounded-full border px-4 text-[14px] cursor-pointer transition-colors ${l === language ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)] font-medium text-[color:var(--ink)]" : "border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>
                  {LANGUAGE_NAME[l]}{l === theirs && picked ? " · patient's" : ""}
                </button>
              ))}
            </div>
            <label className={`mt-3 flex items-center gap-2 text-[14px] ${language === "English" ? "opacity-50" : "cursor-pointer"}`}>
              <input type="checkbox" checked={english && language !== "English"} disabled={language === "English"} onChange={(e) => setEnglish(e.target.checked)} className="h-4 w-4 accent-[color:var(--brand)]" />
              Also print the English text after it
            </label>
          </section>

          <section className="mt-6">
            <h3 className="text-[12px] text-[color:var(--ink-soft)]">What the patient reads</h3>
            <div className="mt-2 rounded-[10px] border border-[color:var(--line)] bg-[color:var(--faint)] p-4">
              {form && <>
              <p lang={LANGUAGE_TAG[language]} className="text-[16px] font-semibold text-[color:var(--ink)]">{fill(form.titles[language])}</p>
              <p lang={LANGUAGE_TAG[language]} className="mt-2 text-[15px] leading-[24px] text-[color:var(--ink)]">{fill(form.bodies[language])}</p>
              {english && language !== "English" && (
                <div className="mt-3 border-t border-[color:var(--line)] pt-3">
                  <p className="text-[13px] font-medium text-[color:var(--ink)]">{fill(form.titles.English)}</p>
                  <p lang="en" className="mt-1 text-[13px] leading-[20px] text-[color:var(--ink-soft)]">{fill(form.bodies.English)}</p>
                </div>
              )}
              </>}
            </div>
          </section>
          <div className="mt-4"><ErrorNote message={error?.message} /></div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-[color:var(--line)] px-6 py-4">
          <button onClick={onClose} className={cancelBtn}>Cancel</button>
          <button onClick={() => make(true)} disabled={loading || !picked} className="h-[36px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 text-[13px] font-medium text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Make and print</button>
          <button onClick={() => make(false)} disabled={loading || !picked} className="h-[36px] rounded-[8px] bg-[color:var(--brand)] px-5 text-[13px] font-medium text-white hover:bg-[color:var(--brand-hover)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{loading ? "Making…" : "Make consent"}</button>
        </footer>
      </aside>
    </div>
  );
}
