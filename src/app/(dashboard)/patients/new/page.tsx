"use client";

/**
 * New patient — one full-screen form (no steps). Only name, gender and mobile are required;
 * everything else can be filled now or later. Keyboard: ↵ next field, ⇧↵ register, M / F / O gender,
 * A / D age ⇄ exact date, Esc cancel.
 */
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Info, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { FormInput, FormSelect, FormTextarea } from "@/components/shared/FormRow";
import {
  IDENTITY_TYPES, validateDob, validateIdentityNumber, validateMobile, todayIso, type IdentityType,
} from "@/lib/validators";

// ── Option lists ──────────────────────────────────────────────────────────────

const opts = (list: string[]) => list.map(v => ({ value: v, label: v }));
const TITLES = opts(["Mr", "Mrs", "Ms", "Miss", "Master", "Baby", "Dr", "Prof"]);
const BLOOD_GROUPS = opts(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);
const MARITAL = opts(["Single", "Married", "Divorced", "Widowed", "Separated"]);
const RELIGIONS = opts(["Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain", "Parsi", "Other"]);
const LANGUAGES = opts(["Hindi", "English", "Marathi", "Gujarati", "Bengali", "Tamil", "Telugu", "Kannada", "Malayalam", "Punjabi", "Urdu", "Other"]);
const NATIONALITIES = opts(["Indian", "Nepali", "Bangladeshi", "Sri Lankan", "American", "British", "Other"]);
const EDUCATION = opts(["Illiterate", "Primary", "Secondary", "Higher secondary", "Graduate", "Postgraduate", "Doctorate", "Other"]);
const RELATIONS = [...["Spouse", "Parent", "Child", "Sibling", "Guardian", "Other"].map(r => ({ value: r.toLowerCase(), label: r }))];
const PAYER_TYPES = opts(["Insurance", "Corporate", "TPA", "Government scheme"]);
const COVID_STATUS = opts(["Not vaccinated", "Partially vaccinated", "Fully vaccinated", "Booster taken"]);
const GENDERS = [
  { value: "Male", key: "M" },
  { value: "Female", key: "F" },
  { value: "Other", key: "O" },
] as const;

interface PayerRow { type: string; name: string; policyNumber: string; validUntil: string; contractId: string }
interface DocRow { type: IdentityType; number: string }

const INITIAL = {
  name: "", gender: "", years: "", months: "", dob: "", mobile: "", reason: "", referralSource: "", patientCategory: "", incomeGroup: "", visitPurpose: "",
  medicoLegal: false, temporary: false, dataConsent: false,
  alternatePhone: "", email: "", address: "", addressLine2: "", pincode: "", city: "", state: "",
  title: "", guardianName: "", careOf: "", anniversary: "", bloodGroup: "", maritalStatus: "", religion: "",
  language: "", nationality: "Indian", education: "", abhaId: "", notes: "",
  allergies: "", chronic: "",
  emergencyName: "", emergencyRelation: "", emergencyPhone: "",
  occupation: "", employer: "", designation: "", workPhone: "", privilegeCardNo: "", corporate: "",
  covidVaccination: "", covidLastDose: "", covidInfected: false,
};
type Form = typeof INITIAL;

// ── Small building blocks ─────────────────────────────────────────────────────

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="bg-[color:var(--surface)] border border-[color:var(--line)] rounded-[12px] overflow-hidden">
      <header className="flex items-baseline gap-3 px-5 py-3 border-b border-[color:var(--subtle-2)]">
        <h2 className="text-[14px] font-medium text-[color:var(--ink)]">{title}</h2>
        {hint && <span className="text-[12px] font-light text-[color:var(--ink-soft)]">{hint}</span>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-5">{children}</div>;
}

function Field({ label, required, error, span = 1, hint, children }: {
  label: string; required?: boolean; error?: string | null; span?: 1 | 2 | 3 | 4; hint?: string; children: ReactNode;
}) {
  const spans = { 1: "", 2: "sm:col-span-2", 3: "lg:col-span-3 sm:col-span-2", 4: "sm:col-span-2 lg:col-span-4" }[span];
  return (
    <div className={`flex flex-col gap-[6px] min-w-0 ${spans}`}>
      <label className="text-[13px] font-medium text-[color:var(--ink)]">
        {label}{required && <span className="text-[#ff0004] ml-1">*</span>}
      </label>
      {children}
      {error ? <p className="text-[11px] text-[#ff0004] leading-4">{error}</p> : hint && <p className="text-[11px] font-light text-[color:var(--ink-soft)] leading-4">{hint}</p>}
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded bg-[color:var(--brand-soft)] text-[color:var(--brand)] text-[10px] font-medium">{children}</kbd>;
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} data-field onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-left cursor-pointer">
      <span className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${checked ? "bg-[color:var(--brand)]" : "bg-[color:var(--line)]"}`}>
        <span className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-[color:var(--surface)] shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
      </span>
      <span className="text-[13px] text-[color:var(--ink)]">{label}</span>
      <span title={hint} className="text-[color:var(--ink-soft)]"><Info size={13} strokeWidth={1.5} /></span>
    </button>
  );
}

const addBtn = "inline-flex items-center gap-1 text-[13px] text-[color:var(--ink)] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[6px] rounded-[8px] hover:bg-[color:var(--subtle)] transition-colors cursor-pointer";

// ── Page ──────────────────────────────────────────────────────────────────────

/** True when this form was opened from the booking screen (…/patients/new?from=booking). Read on demand, not at render. */
const cameFromBooking = () => new URLSearchParams(window.location.search).get("from") === "booking";
const leaveTo = () => (cameFromBooking() ? "/appointments/new" : "/patients");

export default function NewPatientPage() {
  // useSearchParams needs a Suspense boundary above it.
  return <Suspense fallback={null}><NewPatientForm /></Suspense>;
}

/** The names of a Setup master's active entries, as dropdown options. */
function useMasterOptions(kind: string) {
  const { items } = useList<{ id: number; name: string }>(`/setup/${kind}`, { active: 1 });
  return items.map((i) => ({ value: i.name, label: i.name }));
}

function NewPatientForm() {
  const visitPurposes = useMasterOptions("visit_purpose");
  const categories = useMasterOptions("patient_category");
  const incomeGroups = useMasterOptions("income_group");
  const referrals = useMasterOptions("referral_source");
  const contractOptions = useList<{ id: number; name: string }>("/payer-contracts").items.map(c => ({ value: String(c.id), label: c.name }));
  const router = useRouter();
  const params = useSearchParams();
  const { can, loading: authLoading } = useAuth();
  const allowed = can("patients", "write");
  const { run, loading } = useMutation();
  // Opened from an enquiry ("Convert"): start with what we already know about the lead.
  const [form, setForm] = useState<Form>(() => ({
    ...INITIAL,
    name: params.get("name") ?? "",
    mobile: params.get("mobile") ?? "",
    reason: params.get("interest") ?? "",
  }));
  const [exactDate, setExactDate] = useState(false);
  const [payers, setPayers] = useState<PayerRow[]>([{ type: "Insurance", name: "", policyNumber: "", validUntil: "", contractId: "" }]);
  const [docs, setDocs] = useState<DocRow[]>([{ type: "Aadhaar", number: "" }]);
  const [showCovid, setShowCovid] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(prev => ({ ...prev, [k]: v }));

  // ── Validation ──
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Enter the patient's name";
    if (!form.gender) e.gender = "Choose a gender";
    if (!form.mobile.trim()) e.mobile = "Enter a mobile number";
    else { const m = validateMobile(form.mobile); if (m) e.mobile = m; }
    if (form.alternatePhone) { const m = validateMobile(form.alternatePhone); if (m) e.alternatePhone = m; }
    if (form.emergencyPhone) { const m = validateMobile(form.emergencyPhone); if (m) e.emergencyPhone = m; }
    if (exactDate) { const d = validateDob(form.dob); if (d) e.dob = d; }
    else {
      if (form.years && (!/^\d{1,3}$/.test(form.years) || Number(form.years) > 120)) e.years = "0–120";
      if (form.months && (!/^\d{1,2}$/.test(form.months) || Number(form.months) > 11)) e.months = "0–11";
    }
    if (form.anniversary && form.anniversary > todayIso()) e.anniversary = "Can't be in the future";
    docs.forEach((d, i) => { const m = validateIdentityNumber(d.type, d.number); if (m) e[`doc${i}`] = m; });
    return e;
  }, [form, exactDate, docs]);

  const required = [
    { key: "name", label: "Name", done: form.name.trim().length >= 2 },
    { key: "gender", label: "Gender", done: !!form.gender },
    { key: "mobile", label: "Mobile", done: !!form.mobile.trim() && !errors.mobile },
  ];
  const show = (k: string) => (submitted ? errors[k] : undefined) ?? null;
  const blocked = Object.keys(errors).length > 0;

  // ── Submit ──
  async function register() {
    setSubmitted(true);
    setServerError(null);
    if (blocked) {
      document.getElementById("app-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
      if (errors.name) nameRef.current?.querySelector("input")?.focus();
      return;
    }
    const clean = (v: string) => v.trim() || undefined;
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      gender: form.gender,
      phone: form.mobile.trim(),
      reason: clean(form.reason),
      referralSource: clean(form.referralSource), patientCategory: clean(form.patientCategory), incomeGroup: clean(form.incomeGroup), visitPurpose: clean(form.visitPurpose),
      medicoLegal: form.medicoLegal, temporary: form.temporary, dataConsent: form.dataConsent,
      email: clean(form.email), alternatePhone: clean(form.alternatePhone),
      address: clean(form.address), addressLine2: clean(form.addressLine2),
      pincode: clean(form.pincode), city: clean(form.city), state: clean(form.state),
      title: clean(form.title), guardianName: clean(form.guardianName), careOf: clean(form.careOf),
      anniversary: clean(form.anniversary), bloodGroup: clean(form.bloodGroup), maritalStatus: clean(form.maritalStatus),
      religion: clean(form.religion), language: clean(form.language), nationality: clean(form.nationality),
      education: clean(form.education), abhaId: clean(form.abhaId), notes: clean(form.notes),
      allergies: clean(form.allergies), chronic: clean(form.chronic),
      emergencyName: clean(form.emergencyName), emergencyRelation: clean(form.emergencyRelation), emergencyPhone: clean(form.emergencyPhone),
      occupation: clean(form.occupation), employer: clean(form.employer), designation: clean(form.designation),
      workPhone: clean(form.workPhone), privilegeCardNo: clean(form.privilegeCardNo), corporate: clean(form.corporate),
    };
    if (exactDate) { if (form.dob) payload.dob = form.dob; }
    else {
      if (form.years) payload.age = Number(form.years);
      if (form.months) payload.ageMonths = Number(form.months);
    }
    const cleanPayers = payers.filter(p => p.name.trim() || p.policyNumber.trim() || p.contractId);
    if (cleanPayers.length) payload.payers = cleanPayers.map(p => ({ ...p, validUntil: p.validUntil || "", contractId: p.contractId ? Number(p.contractId) : null }));
    const cleanDocs = docs.filter(d => d.number.trim());
    if (cleanDocs.length) payload.identityDocuments = cleanDocs;
    if (showCovid && (form.covidVaccination || form.covidLastDose || form.covidInfected)) {
      payload.covid = { vaccination: form.covidVaccination, lastDose: form.covidLastDose, infectedBefore: form.covidInfected };
    }

    try {
      const created = await run(() => api.post<{ id?: number }>("/patients", payload));
      // Opened from an enquiry: link the new patient to the lead and finish it (the patient is registered either way).
      const enquiryId = new URLSearchParams(window.location.search).get("enquiry");
      if (enquiryId && created?.id) {
        try { await api.post(`/enquiries/${enquiryId}/convert`, { patientId: created.id }); } catch { /* the patient exists; the lead can be converted again from its row */ }
      }
      // Opened from "Book appointment → New patient": go back and carry on booking for the patient just registered.
      if (cameFromBooking() && created?.id) router.push(`/appointments/new?patientId=${created.id}`);
      else router.push(created?.id ? `/patients/${created.id}` : "/patients");
    } catch (e) {
      setServerError(e instanceof ApiClientError ? e.message : "Couldn't register the patient. Please try again.");
      document.getElementById("app-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // ── Keyboard: ↵ next field, ⇧↵ register, Esc cancel, M/F/O gender, A/D age ⇄ date ──
  const latest = useRef<{ register: () => Promise<void>; cancel: () => void; setGender: (g: string) => void; setDateMode: (d: boolean) => void }>({
    register, cancel: () => {}, setGender: () => {}, setDateMode: () => {},
  });
  useEffect(() => {
    latest.current = {
      register,
      cancel: () => router.push(leaveTo()),
      setGender: (g: string) => set("gender", g),
      setDateMode: (d: boolean) => setExactDate(d),
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (e.key === "Escape") { e.preventDefault(); latest.current.cancel(); return; }
      if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); void latest.current.register(); return; }
      const isRadio = !!el && el.getAttribute("role") === "radio";
      if (e.key === "Enter" && el && (el.tagName === "INPUT" || el.tagName === "SELECT" || isRadio)) {
        e.preventDefault();
        const fields = Array.from(formRef.current?.querySelectorAll<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [data-field]") ?? [])
          .filter(f => f.offsetParent !== null);
        let from = el;
        if (isRadio) {
          // Enter moves past the whole group; it only picks the focused option when nothing is chosen yet
          // (so M / F / O followed by Enter keeps what you pressed).
          const radios = el.closest<HTMLElement>("[role=radiogroup]")?.querySelectorAll<HTMLElement>("[role=radio]");
          if (radios?.length) {
            if (!Array.from(radios).some(r => r.getAttribute("aria-checked") === "true")) el.click();
            from = radios[radios.length - 1];
          }
        }
        fields[fields.indexOf(from) + 1]?.focus();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "m") latest.current.setGender("Male");
      else if (k === "f") latest.current.setGender("Female");
      else if (k === "o") latest.current.setGender("Other");
      else if (k === "a") latest.current.setDateMode(false);
      else if (k === "d") latest.current.setDateMode(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus the name once the form is actually on screen (on a fresh load it appears after permissions arrive).
  useEffect(() => { if (allowed) nameRef.current?.querySelector("input")?.focus(); }, [allowed]);

  if (authLoading) return null;
  if (!allowed) {
    return (
      <div className="p-6 text-[14px] text-[color:var(--ink-soft)]">
        You don&apos;t have permission to register patients. <Link href="/patients" className="text-[color:var(--brand)] hover:underline">Back to Patients</Link>
      </div>
    );
  }

  const invalid = (k: string) => submitted && !!errors[k];
  const setPayer = (i: number, patch: Partial<PayerRow>) => setPayers(rows => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setDoc = (i: number, patch: Partial<DocRow>) => setDocs(rows => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <form ref={formRef} onSubmit={e => { e.preventDefault(); void register(); }} className="min-h-full bg-[color:var(--canvas)]">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-[color:var(--surface)] border-b border-[color:var(--line)] px-6 py-3 flex items-center gap-4">
        <button type="button" onClick={() => router.push(leaveTo())} aria-label="Back"
          className="p-2 -ml-2 rounded-[8px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)] cursor-pointer">
          <ArrowLeft size={18} strokeWidth={1.5} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[15px] font-medium text-[color:var(--ink)]"><UserPlus size={16} strokeWidth={1.5} className="text-[color:var(--ink-soft)]" /> New patient</div>
          <p className="text-[12px] font-light text-[color:var(--ink-soft)] truncate">
            Press <Kbd>↵</Kbd> to move between fields — only name, gender and mobile are required.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          {required.map(r => (
            <span key={r.key} className={`inline-flex items-center gap-1 px-3 py-[3px] rounded-full text-[12px] border ${r.done ? "bg-[#effcf5] border-[#b6e8cf] text-[#00955c]" : "bg-[color:var(--surface)] border-[color:var(--line)] text-[color:var(--ink-soft)]"}`}>
              {r.done && <Check size={12} />} {r.label}
            </span>
          ))}
        </div>
        <button type="button" onClick={() => router.push(leaveTo())}
          className="inline-flex items-center gap-2 text-[13px] text-[color:var(--ink)] border border-[color:var(--line)] px-4 py-[8px] rounded-[10px] hover:bg-[color:var(--subtle)] cursor-pointer">
          Cancel <Kbd>Esc</Kbd>
        </button>
        <button type="submit" disabled={loading}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-white bg-[color:var(--brand)] px-4 py-[8px] rounded-[10px] hover:bg-[color:var(--brand-hover)] disabled:opacity-60 cursor-pointer">
          {loading ? <Loader2 size={14} className="animate-spin" /> : null} Register patient <span className="px-1 rounded bg-white/20 text-[11px]">⇧↵</span>
        </button>
      </div>

      <div className="p-6 flex flex-col gap-5 max-w-[1500px]">
        {(serverError || (submitted && blocked)) && (
          <div role="alert" className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-4 py-3">
            {serverError ?? "Please fix the highlighted fields."}
          </div>
        )}

        {/* ── Essentials ── */}
        <Card title="Essentials" hint="The fast path — this card alone registers a patient">
          <Grid>
            <div ref={nameRef} className="contents">
              <Field label="Full name" required span={2} error={show("name")}>
                <FormInput placeholder="e.g. Asha Patel" value={form.name} onChange={v => set("name", v)} error={invalid("name")} />
              </Field>
            </div>
            <Field label="Gender" required error={show("gender")}>
              <div className="flex gap-2" role="radiogroup" aria-label="Gender">
                {GENDERS.map(g => (
                  <button key={g.value} type="button" role="radio" aria-checked={form.gender === g.value} data-field
                    onClick={() => set("gender", g.value)}
                    className={`flex-1 h-[42px] inline-flex items-center justify-center gap-2 rounded-[8px] border text-[14px] cursor-pointer transition-colors ${
                      form.gender === g.value ? "border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--brand)]" : invalid("gender") ? "border-[#ff0004] text-[color:var(--ink)]" : "border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>
                    {g.value} <Kbd>{g.key}</Kbd>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Mobile" required error={show("mobile")}>
              <FormInput type="tel" placeholder="10-digit number" value={form.mobile} onChange={v => set("mobile", v)} error={invalid("mobile")} />
            </Field>

            <Field label={exactDate ? "Date of birth" : "Age"} span={2} error={show("dob") ?? show("years") ?? show("months")}>
              <div className="flex items-center gap-2">
                {exactDate ? (
                  <FormInput type="date" max={todayIso()} value={form.dob} onChange={v => set("dob", v)} error={invalid("dob")} />
                ) : (
                  <>
                    <FormInput type="number" min="0" max="120" placeholder="Years" value={form.years} onChange={v => set("years", v)} error={invalid("years")} />
                    <FormInput type="number" min="0" max="11" placeholder="Months" value={form.months} onChange={v => set("months", v)} error={invalid("months")} />
                  </>
                )}
                <button type="button" onClick={() => setExactDate(d => !d)}
                  className="shrink-0 inline-flex items-center gap-1 text-[12px] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] cursor-pointer whitespace-nowrap">
                  {exactDate ? "Enter age" : "Enter exact date"} <Kbd>{exactDate ? "A" : "D"}</Kbd>
                </button>
              </div>
            </Field>
            <Field label="Primary complaint" span={2}>
              <FormInput placeholder="Reason for the visit" value={form.reason} onChange={v => set("reason", v)} />
            </Field>
            <Field label="Visit purpose">
              <FormSelect placeholder="Not recorded" options={visitPurposes} value={form.visitPurpose} onChange={v => set("visitPurpose", v)} />
            </Field>
            <Field label="Patient category">
              <FormSelect placeholder="Not recorded" options={categories} value={form.patientCategory} onChange={v => set("patientCategory", v)} />
            </Field>
            <Field label="Income group">
              <FormSelect placeholder="Not recorded" options={incomeGroups} value={form.incomeGroup} onChange={v => set("incomeGroup", v)} />
            </Field>
            <Field label="How did they come?">
              <FormSelect placeholder="Not recorded" options={referrals} value={form.referralSource} onChange={v => set("referralSource", v)} />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-x-6 gap-y-3 pt-6">
              <Toggle label="Medico-legal case" hint="Mark if this visit may need police or court documentation" checked={form.medicoLegal} onChange={v => set("medicoLegal", v)} />
              <Toggle label="Temporary" hint="A provisional record, to be completed or merged later" checked={form.temporary} onChange={v => set("temporary", v)} />
              <Toggle label="Data-processing consent" hint="The patient agreed to their data being stored and processed" checked={form.dataConsent} onChange={v => set("dataConsent", v)} />
            </div>
          </Grid>
        </Card>

        {/* ── Contact & address ── */}
        <Card title="Contact & address" hint="How to reach them">
          <Grid>
            <Field label="Alternate mobile" error={show("alternatePhone")}>
              <FormInput type="tel" value={form.alternatePhone} onChange={v => set("alternatePhone", v)} error={invalid("alternatePhone")} />
            </Field>
            <Field label="Email"><FormInput type="email" value={form.email} onChange={v => set("email", v)} /></Field>
            <Field label="Address line 1" span={2}><FormInput value={form.address} onChange={v => set("address", v)} /></Field>
            <Field label="Address line 2" span={2}><FormInput value={form.addressLine2} onChange={v => set("addressLine2", v)} /></Field>
            <Field label="PIN"><FormInput placeholder="PIN" value={form.pincode} onChange={v => set("pincode", v)} /></Field>
            <Field label="City"><FormInput value={form.city} onChange={v => set("city", v)} /></Field>
            <Field label="State"><FormInput value={form.state} onChange={v => set("state", v)} /></Field>
          </Grid>
        </Card>

        {/* ── Personal ── */}
        <Card title="Personal" hint="Family and demographics">
          <Grid>
            <Field label="Title"><FormSelect placeholder="Select" options={TITLES} value={form.title} onChange={v => set("title", v)} /></Field>
            <Field label="Guardian name" span={1}><FormInput value={form.guardianName} onChange={v => set("guardianName", v)} /></Field>
            <Field label="Care of (C/O)"><FormInput value={form.careOf} onChange={v => set("careOf", v)} /></Field>
            <Field label="Anniversary" error={show("anniversary")}><FormInput type="date" max={todayIso()} value={form.anniversary} onChange={v => set("anniversary", v)} error={invalid("anniversary")} /></Field>
            <Field label="Blood group"><FormSelect placeholder="Select" options={BLOOD_GROUPS} value={form.bloodGroup} onChange={v => set("bloodGroup", v)} /></Field>
            <Field label="Marital status"><FormSelect placeholder="Select" options={MARITAL} value={form.maritalStatus} onChange={v => set("maritalStatus", v)} /></Field>
            <Field label="Religion"><FormSelect placeholder="Select" options={RELIGIONS} value={form.religion} onChange={v => set("religion", v)} /></Field>
            <Field label="Language"><FormSelect placeholder="Select" options={LANGUAGES} value={form.language} onChange={v => set("language", v)} /></Field>
            <Field label="Nationality"><FormSelect options={NATIONALITIES} value={form.nationality} onChange={v => set("nationality", v)} /></Field>
            <Field label="Education"><FormSelect placeholder="Select" options={EDUCATION} value={form.education} onChange={v => set("education", v)} /></Field>
            <Field label="ABHA ID" span={2}><FormInput placeholder="14-digit ABHA number" value={form.abhaId} onChange={v => set("abhaId", v)} /></Field>
            <Field label="Notes" span={4}><FormTextarea rows={2} value={form.notes} onChange={v => set("notes", v)} /></Field>
          </Grid>
        </Card>

        {/* ── Medical background & emergency contact (carried over from the old form) ── */}
        <Card title="Medical background" hint="Allergies and long-term conditions, separated by commas">
          <Grid>
            <Field label="Known allergies" span={2}><FormInput placeholder="e.g. Penicillin, Peanuts" value={form.allergies} onChange={v => set("allergies", v)} /></Field>
            <Field label="Chronic conditions" span={2}><FormInput placeholder="e.g. Diabetes, Hypertension" value={form.chronic} onChange={v => set("chronic", v)} /></Field>
          </Grid>
        </Card>

        <Card title="Emergency contact" hint="Who to call if needed">
          <Grid>
            <Field label="Contact name" span={2}><FormInput placeholder="Full name" value={form.emergencyName} onChange={v => set("emergencyName", v)} /></Field>
            <Field label="Relationship"><FormSelect placeholder="Select" options={RELATIONS} value={form.emergencyRelation} onChange={v => set("emergencyRelation", v)} /></Field>
            <Field label="Phone" error={show("emergencyPhone")}>
              <FormInput type="tel" value={form.emergencyPhone} onChange={v => set("emergencyPhone", v)} error={invalid("emergencyPhone")} />
            </Field>
          </Grid>
        </Card>

        {/* ── Work & payer ── */}
        <Card title="Work & payer" hint="Employment and coverage">
          <Grid>
            <Field label="Occupation"><FormInput value={form.occupation} onChange={v => set("occupation", v)} /></Field>
            <Field label="Employer / organisation"><FormInput value={form.employer} onChange={v => set("employer", v)} /></Field>
            <Field label="Designation"><FormInput value={form.designation} onChange={v => set("designation", v)} /></Field>
            <Field label="Work phone"><FormInput type="tel" value={form.workPhone} onChange={v => set("workPhone", v)} /></Field>
            <Field label="Privilege card no."><FormInput value={form.privilegeCardNo} onChange={v => set("privilegeCardNo", v)} /></Field>
            <Field label="Corporate (tie-up)" span={2}><FormInput placeholder="Corporate account, if the visit is billed to one" value={form.corporate} onChange={v => set("corporate", v)} /></Field>
          </Grid>

          <div className="mt-5 border border-[color:var(--line)] rounded-[10px] p-4 flex flex-col gap-3">
            <span className="text-[13px] font-medium text-[color:var(--ink)]">Payer / coverage</span>
            {payers.map((p, i) => (
              <div key={i} className="flex flex-col gap-2">
              <div className="grid grid-cols-1 sm:grid-cols-[170px_1fr_1fr_170px_auto] gap-3 items-center">
                <FormSelect options={PAYER_TYPES} value={p.type} onChange={v => setPayer(i, { type: v })} />
                <FormInput placeholder="Payer name" value={p.name} onChange={v => setPayer(i, { name: v })} />
                <FormInput placeholder="Policy / proposal no." value={p.policyNumber} onChange={v => setPayer(i, { policyNumber: v })} />
                <FormInput type="date" value={p.validUntil} onChange={v => setPayer(i, { validUntil: v })} />
                <button type="button" aria-label="Remove payer" disabled={payers.length === 1 && !p.name && !p.policyNumber}
                  onClick={() => setPayers(rows => (rows.length === 1 ? [{ type: "Insurance", name: "", policyNumber: "", validUntil: "", contractId: "" }] : rows.filter((_, j) => j !== i)))}
                  className="p-2 text-[color:var(--ink-soft)] hover:text-[#ff0004] disabled:opacity-30 cursor-pointer"><Trash2 size={15} strokeWidth={1.5} /></button>
              </div>
              <FormSelect options={[{ value: "", label: "No sponsor contract (the bill is not split)" }, ...contractOptions]} value={p.contractId} onChange={v => setPayer(i, { contractId: v })} />
              </div>
            ))}
            <div>
              <button type="button" className={addBtn} data-field onClick={() => setPayers(rows => [...rows, { type: "Insurance", name: "", policyNumber: "", validUntil: "", contractId: "" }])}>
                <Plus size={14} /> Add payer
              </button>
            </div>
          </div>
        </Card>

        {/* ── Identity documents ── */}
        <Card title="Identity documents" hint="Proofs on file">
          <p className="text-[12px] font-light text-[color:var(--ink-soft)] mb-4 max-w-[900px]">
            Aadhaar is validated (Verhoeff) and stored as last-4 + fingerprint only — the full number is never saved. The photo and
            document scans can be added from the profile after saving.
          </p>
          <div className="flex flex-col gap-3">
            {docs.map((d, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr_auto] gap-3 items-center max-w-[760px]">
                  <FormSelect options={IDENTITY_TYPES.map(t => ({ value: t, label: t }))} value={d.type} onChange={v => setDoc(i, { type: v as IdentityType })} />
                  <FormInput placeholder={d.type === "Aadhaar" ? "12-digit Aadhaar" : `${d.type} number`} value={d.number} error={invalid(`doc${i}`)}
                    onChange={v => setDoc(i, { number: d.type === "Aadhaar" ? v.replace(/[^\d ]/g, "").slice(0, 14) : v })} />
                  <button type="button" aria-label="Remove document" disabled={docs.length === 1 && !d.number}
                    onClick={() => setDocs(rows => (rows.length === 1 ? [{ type: "Aadhaar", number: "" }] : rows.filter((_, j) => j !== i)))}
                    className="p-2 text-[color:var(--ink-soft)] hover:text-[#ff0004] disabled:opacity-30 cursor-pointer"><Trash2 size={15} strokeWidth={1.5} /></button>
                </div>
                {show(`doc${i}`) && <p className="text-[11px] text-[#ff0004]">{show(`doc${i}`)}</p>}
              </div>
            ))}
            <div>
              <button type="button" className={addBtn} data-field onClick={() => setDocs(rows => [...rows, { type: "PAN", number: "" }])}>
                <Plus size={14} /> Add document
              </button>
            </div>
          </div>
        </Card>

        {/* ── COVID details ── */}
        {showCovid && (
          <Card title="COVID details" hint="Vaccination and infection history">
            <Grid>
              <Field label="Vaccination status" span={2}><FormSelect placeholder="Select" options={COVID_STATUS} value={form.covidVaccination} onChange={v => set("covidVaccination", v)} /></Field>
              <Field label="Last dose on"><FormInput type="date" max={todayIso()} value={form.covidLastDose} onChange={v => set("covidLastDose", v)} /></Field>
              <div className="pt-6"><Toggle label="Had COVID before" hint="The patient has been infected earlier" checked={form.covidInfected} onChange={v => set("covidInfected", v)} /></div>
            </Grid>
          </Card>
        )}

        {/* ── Footer: extras + shortcuts ── */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pb-10 text-[12px] text-[color:var(--ink-soft)]">
          {!showCovid && (
            <button type="button" className={addBtn} data-field onClick={() => setShowCovid(true)}><Plus size={14} /> Add COVID details</button>
          )}
          <span className="inline-flex items-center gap-2"><Kbd>↵</Kbd> next field</span>
          <span className="inline-flex items-center gap-2"><Kbd>⇧↵</Kbd> register</span>
          <span className="inline-flex items-center gap-2"><Kbd>M</Kbd><Kbd>F</Kbd><Kbd>O</Kbd> gender</span>
          <span className="inline-flex items-center gap-2"><Kbd>A</Kbd>/<Kbd>D</Kbd> age ⇄ date</span>
          <span className="inline-flex items-center gap-2"><Kbd>Esc</Kbd> cancel</span>
        </div>
      </div>
    </form>
  );
}
