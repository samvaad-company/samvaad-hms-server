"use client";

import { useState, type ReactNode } from "react";
import { tw } from "@/lib/design-system";
import { INVESTIGATION_GROUPS, INVESTIGATION_OPTIONS, SYSTEM_TEMPLATES, bmiOf, customSystem, makeSystem, newFieldId } from "@/lib/consultation/templates";
import type { Consultation, ConsultationField, ConsultationSystem } from "@/types/consultation";
import { Plus, X, Check, ChevronDown, ChevronUp, Stethoscope, HeartPulse, ClipboardList, History, FlaskConical, Lightbulb, Activity } from "lucide-react";

const input = "h-[34px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors";
const area = "w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 py-2 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors resize-y";

export function Section({ icon, title, right, children }: { icon: ReactNode; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className={`${tw.surface.card} ${tw.radius.card} p-5`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[color:var(--brand)]">{icon}</span>
        <h3 className="text-[14px] font-semibold text-[color:var(--ink)]">{title}</h3>
        <div className="ml-auto">{right}</div>
      </div>
      {children}
    </section>
  );
}

// ── One field: pick-one, pick-any or free text ───────────────────────────────

function Pick({ checked, square, label, onClick }: { checked: boolean; square?: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={checked} className="inline-flex cursor-pointer items-center gap-[6px] text-left text-[13px] text-[color:var(--ink)]">
      <span className={`flex h-[16px] w-[16px] shrink-0 items-center justify-center border ${square ? "rounded-[4px]" : "rounded-full"} ${checked ? "border-[color:var(--brand)] bg-[color:var(--brand)] text-white" : "border-[color:var(--line)] bg-[color:var(--surface)]"}`}>
        {checked && <Check size={11} strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

function FieldControl({ f, onChange }: { f: ConsultationField; onChange: (value: string) => void }) {
  if (f.kind === "text") {
    return (
      <div className="flex items-center gap-2">
        <input className={input} value={f.value} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
        {f.unit && <span className="text-[12px] text-[color:var(--ink-soft)]">{f.unit}</span>}
      </div>
    );
  }
  const chosen = f.value ? f.value.split(", ") : [];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {(f.options ?? []).map((o) => {
        const on = chosen.includes(o);
        return (
          <Pick
            key={o}
            label={o}
            square={f.kind === "multi"}
            checked={on}
            onClick={() => onChange(f.kind === "multi" ? (on ? chosen.filter((c) => c !== o) : [...chosen, o]).join(", ") : on ? "" : o)}
          />
        );
      })}
    </div>
  );
}

function AddField({ onAdd, label = "Add field" }: { onAdd: (f: ConsultationField) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [opts, setOpts] = useState("");
  const reset = () => { setOpen(false); setName(""); setOpts(""); };
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-medium text-[color:var(--brand)] hover:underline">
        <Plus size={13} /> {label}
      </button>
    );
  }
  const options = opts.split(",").map((s) => s.trim()).filter(Boolean);
  const submit = () => {
    if (!name.trim()) return;
    onAdd({ id: newFieldId(), label: name.trim(), kind: options.length ? "choice" : "text", options: options.length ? options : undefined, value: "", custom: true, placeholder: options.length ? undefined : "Enter findings…" });
    reset();
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-dashed border-[color:var(--brand)] p-2">
      <input autoFocus className={`${input} !w-[180px]`} placeholder="Field name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} />
      <input className={`${input} !w-[240px]`} placeholder="Options, comma separated (blank = text)" value={opts} onChange={(e) => setOpts(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} />
      <button type="button" onClick={submit} disabled={!name.trim()} className="h-[30px] cursor-pointer rounded-full bg-[color:var(--brand)] px-3 text-[12px] text-white disabled:opacity-50">Add</button>
      <button type="button" onClick={reset} className="cursor-pointer text-[12px] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]">Cancel</button>
    </div>
  );
}

function FieldList({ fields, onChange, labelWidth = 170 }: { fields: ConsultationField[]; onChange: (fields: ConsultationField[]) => void; labelWidth?: number }) {
  const set = (id: string, value: string) => onChange(fields.map((f) => (f.id === id ? { ...f, value } : f)));
  return (
    <div className="flex flex-col gap-[10px]">
      {fields.map((f) => (
        <div key={f.id} className="grid items-center gap-3" style={{ gridTemplateColumns: `${labelWidth}px minmax(0,1fr) 20px` }}>
          <span className="text-[13px] font-medium text-[color:var(--ink)]">{f.label}</span>
          <FieldControl f={f} onChange={(v) => set(f.id, v)} />
          {f.custom ? (
            <button type="button" aria-label={`Remove ${f.label}`} onClick={() => onChange(fields.filter((x) => x.id !== f.id))} className="cursor-pointer text-[color:var(--ink-soft)] hover:text-[#ff0004]"><X size={14} /></button>
          ) : <span />}
        </div>
      ))}
      <div><AddField onAdd={(f) => onChange([...fields, f])} /></div>
    </div>
  );
}

// ── The form ─────────────────────────────────────────────────────────────────

const HISTORY_TABS: { key: keyof Consultation["history"]; label: string; placeholder: string }[] = [
  { key: "past", label: "Past History", placeholder: "Past illnesses, surgeries, hospital stays… (blank = nothing significant)" },
  { key: "family", label: "Family History", placeholder: "Diabetes, hypertension, heart disease, cancer in the family…" },
  { key: "personal", label: "Personal History", placeholder: "Diet, sleep, smoking, alcohol, occupation…" },
  { key: "medical", label: "Medical History", placeholder: "Ongoing conditions, regular medicines, allergies…" },
];

export function ConsultationForm({ value, onChange, diagnosis, treatment }: { value: Consultation; onChange: (c: Consultation) => void; diagnosis: ReactNode; treatment: ReactNode }) {
  const set = (patch: Partial<Consultation>) => onChange({ ...value, ...patch });
  const [tab, setTab] = useState<keyof Consultation["history"]>("past");
  const [sysOpen, setSysOpen] = useState(true);
  const [addingSystem, setAddingSystem] = useState(false);
  const [customName, setCustomName] = useState("");
  const [otherInv, setOtherInv] = useState("");

  const v = value.vitals;
  const setVital = (k: keyof Consultation["vitals"], val: string) => set({ vitals: { ...v, [k]: val } });
  const bmi = bmiOf(v.weight, v.height);

  const used = new Set(value.systemic.map((s) => s.key));
  const available = SYSTEM_TEMPLATES.filter((t) => !used.has(t.key));
  const setSystem = (key: string, patch: Partial<ConsultationSystem>) => set({ systemic: value.systemic.map((s) => (s.key === key ? { ...s, ...patch } : s)) });
  const addSystem = (s: ConsultationSystem | null) => { if (s) set({ systemic: [...value.systemic, s] }); setAddingSystem(false); setCustomName(""); };

  const toggleInv = (name: string) => set({ investigations: value.investigations.includes(name) ? value.investigations.filter((i) => i !== name) : [...value.investigations, name] });
  const extraInv = value.investigations.filter((i) => !INVESTIGATION_OPTIONS.includes(i));

  const vitalBox = (label: string, k: "bp" | "pulse" | "temp" | "spo2" | "weight" | "height", unit: string, ph: string) => (
    <label className="flex items-center gap-2">
      <span className="w-[52px] shrink-0 text-[12px] font-semibold text-[color:var(--ink)]">{label}</span>
      <input className={`${input} !w-[88px] text-center`} value={v[k]} placeholder={ph} onChange={(e) => setVital(k, e.target.value)} />
      <span className="text-[12px] text-[color:var(--ink-soft)]">{unit}</span>
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section icon={<ClipboardList size={18} />} title="Chief Complaint">
          <textarea className={area} rows={5} maxLength={500} placeholder="e.g. Fever with cough since 3 days…" value={value.chiefComplaint} onChange={(e) => set({ chiefComplaint: e.target.value })} />
          <p className="mt-1 text-right text-[11px] text-[color:var(--ink-soft)]">{value.chiefComplaint.length} / 500</p>
        </Section>

        <Section icon={<History size={18} />} title="History">
          <div className="mb-3 flex gap-1 rounded-[8px] bg-[color:var(--subtle)] p-1">
            {HISTORY_TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={`flex-1 cursor-pointer rounded-[6px] px-2 py-[6px] text-[12px] transition-colors ${tab === t.key ? "bg-[color:var(--surface)] font-semibold text-[color:var(--brand)] shadow-sm" : "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"}`}>
                {t.label}{value.history[t.key].trim() ? " •" : ""}
              </button>
            ))}
          </div>
          <textarea className={area} rows={4} placeholder={HISTORY_TABS.find((t) => t.key === tab)!.placeholder} value={value.history[tab]} onChange={(e) => set({ history: { ...value.history, [tab]: e.target.value } })} />
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section icon={<Activity size={18} />} title="Vitals" right={v.source ? <span className="text-[11px] text-[color:var(--ink-soft)]">{v.source}</span> : undefined}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {vitalBox("BP", "bp", "mmHg", "120/80")}
            {vitalBox("Pulse", "pulse", "/min", "72")}
            {vitalBox("Temp", "temp", "°F", "98.6")}
            {vitalBox("SpO₂", "spo2", "%", "98")}
            {vitalBox("Weight", "weight", "kg", "70")}
            {vitalBox("Height", "height", "cm", "170")}
          </div>
          <div className="mt-3 rounded-[8px] bg-[color:var(--subtle)] px-3 py-[6px] text-center text-[12px] font-semibold text-[color:var(--ink)]">BMI : {bmi || "—"}</div>
        </Section>

        <Section icon={<HeartPulse size={18} />} title="General Examination">
          <FieldList fields={value.general} onChange={(general) => set({ general })} labelWidth={110} />
        </Section>
      </div>

      {/* Systemic examination */}
      <section className="overflow-hidden rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface)]">
        <button type="button" onClick={() => setSysOpen((o) => !o)} className="flex w-full cursor-pointer items-center gap-2 bg-[#0f1f4b] px-5 py-3 text-left text-white">
          <Stethoscope size={18} />
          <span className="text-[14px] font-semibold">Systemic Examination</span>
          <span className="ml-2 text-[12px] opacity-70">{value.systemic.length} system{value.systemic.length === 1 ? "" : "s"}</span>
          <span className="ml-auto">{sysOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
        </button>
        {sysOpen && (
          <div className="p-4">
            {value.systemic.length === 0 && <p className="mb-3 text-[13px] text-[color:var(--ink-soft)]">Add the systems you examined. Each one comes with its own template that you can extend.</p>}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {value.systemic.map((s, i) => (
                <div key={s.key} className="rounded-[10px] border border-[color:var(--line)] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <h4 className="text-[13px] font-semibold text-[color:var(--ink)]">{i + 1}. {s.title}</h4>
                    <button type="button" aria-label={`Remove ${s.title}`} onClick={() => set({ systemic: value.systemic.filter((x) => x.key !== s.key) })} className="ml-auto cursor-pointer text-[color:var(--ink-soft)] hover:text-[#ff0004]"><X size={15} /></button>
                  </div>
                  <FieldList fields={s.fields} onChange={(fields) => setSystem(s.key, { fields })} labelWidth={150} />
                </div>
              ))}
            </div>

            <div className="mt-4">
              {!addingSystem ? (
                <button type="button" onClick={() => setAddingSystem(true)} className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-[color:var(--brand)] px-3 py-[6px] text-[12px] font-medium text-[color:var(--brand)] hover:bg-[color:var(--brand-soft)]">
                  <Plus size={13} /> Add system
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-dashed border-[color:var(--brand)] p-3">
                  {available.map((t) => (
                    <button key={t.key} type="button" onClick={() => addSystem(makeSystem(t.key))} className="cursor-pointer rounded-full border border-[color:var(--line)] bg-[color:var(--subtle)] px-3 py-[5px] text-[12px] text-[color:var(--ink)] hover:border-[color:var(--brand)]">{t.title}</button>
                  ))}
                  <input className={`${input} !w-[200px]`} placeholder="Other system, e.g. ENT" value={customName} onChange={(e) => setCustomName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && customName.trim()) { e.preventDefault(); addSystem(customSystem(customName.trim())); } }} />
                  <button type="button" disabled={!customName.trim()} onClick={() => addSystem(customSystem(customName.trim()))} className="h-[30px] cursor-pointer rounded-full bg-[color:var(--brand)] px-3 text-[12px] text-white disabled:opacity-50">Add custom</button>
                  <button type="button" onClick={() => setAddingSystem(false)} className="cursor-pointer text-[12px] text-[color:var(--ink-soft)]">Cancel</button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section icon={<FlaskConical size={18} />} title="Investigation Advised">
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-[10px] border border-[color:var(--line)]">
              {INVESTIGATION_GROUPS.map((g, gi) => (
                <div key={g.title} className={gi > 0 ? "border-t border-[color:var(--line)]" : ""}>
                  <p className="bg-[color:var(--subtle)] px-3 py-[6px] text-[11px] font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]">{g.title}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3">
                    {g.tests.map((o) => (
                      <div key={o} className="border-b border-r border-[color:var(--subtle-2)] px-3 py-[9px]">
                        <Pick square label={o} checked={value.investigations.includes(o)} onClick={() => toggleInv(o)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]">Others</p>
              <div className="flex flex-wrap gap-2">
                {extraInv.map((o) => (
                  <span key={o} className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-soft)] px-2 py-[2px] text-[12px] text-[color:var(--brand)]">
                    {o}<button type="button" aria-label={`Remove ${o}`} onClick={() => toggleInv(o)} className="cursor-pointer"><X size={12} /></button>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <input className={`${input} mt-3`} placeholder="Other test, e.g. MRI Brain, CT Chest — press Enter to add" value={otherInv}
            onChange={(e) => setOtherInv(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const t = otherInv.trim(); if (t && !value.investigations.includes(t)) toggleInv(t); setOtherInv(""); } }} />
        </Section>

        <Section icon={<Stethoscope size={18} />} title="Diagnosis">
          <div className="flex flex-col gap-[10px]">
            {diagnosis}
            <label className="grid items-center gap-3" style={{ gridTemplateColumns: "130px minmax(0,1fr)" }}>
              <span className="text-[13px] font-medium text-[color:var(--ink)]">Secondary Diagnosis</span>
              <input className={input} value={value.secondaryDiagnosis} placeholder="Enter secondary diagnosis…" onChange={(e) => set({ secondaryDiagnosis: e.target.value })} />
            </label>
          </div>
        </Section>
      </div>

      {treatment}

      <div>
        <Section icon={<Lightbulb size={18} />} title="Advice">
          <div className="flex flex-col gap-[10px]">
            {([["diet", "Diet", "e.g. Low salt diet…"], ["exercise", "Exercise", "e.g. 30 min walk daily…"], ["other", "Other Advice", "Enter additional advice…"]] as const).map(([k, label, ph]) => (
              <label key={k} className="grid items-center gap-3" style={{ gridTemplateColumns: "110px minmax(0,1fr)" }}>
                <span className="text-[13px] font-medium text-[color:var(--ink)]">{label}</span>
                <input className={input} value={value.advice[k]} placeholder={ph} onChange={(e) => set({ advice: { ...value.advice, [k]: e.target.value } })} />
              </label>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
