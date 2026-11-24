"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tw } from "@/lib/design-system";
import { useList, useMutation } from "@/lib/api/hooks";
import { useMedicineMatches } from "@/lib/api/useMedicineSearch";
import { api } from "@/lib/api/client";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import { useAuth } from "@/lib/auth-context";
import type { PatientDTO, DoctorDTO, PrescriptionDTO, PrescriptionTemplateDTO, OpdVitalDTO } from "@/types/api";
import { formatDate } from "@/lib/dates";
import { FormRow, FormInput, FormTextarea } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { Modal } from "@/components/shared/Modal";
import Link from "next/link";
import { Plus, Trash2, Pencil, Search, Zap, Loader2, Pill, Printer, Download, FileText } from "lucide-react";
import { ConsultationForm, Section } from "@/components/consultation/ConsultationForm";
import { DiagnosisPicker } from "@/components/consultation/DiagnosisPicker";
import { emptyConsultation } from "@/lib/consultation/templates";
import { PATTERN_PRESETS, TIMINGS, remarksOf, toPattern } from "@/lib/prescriptions/remarks";
import { PatternInput } from "@/components/prescriptions/PatternInput";
import { TodayPatientPicker } from "@/components/prescriptions/TodayPatientPicker";
import { LANGS, type Lang } from "@/lib/prescriptions/remarks";
import type { Consultation } from "@/types/consultation";

const MED_COLS = "minmax(200px,2.2fr) 92px 190px 112px 104px 64px minmax(150px,1.6fr) 28px";
type RxRow = { id: number; medicine: string; dosage: string; frequency: string; timing: string; duration: string; instructions: string; quantity: string };

/** How many to give: the doses a day times the days (from "5 days", "2 weeks", "1 month"); 0 when it cannot be worked out. */
function autoQuantity(frequency: string, duration: string): number {
  const perDay = toPattern(frequency).split("-").reduce((a, n) => a + (Number(n) || 0), 0);
  const m = /^(\d+(?:\.\d+)?)\s*(day|week|month)s?$/i.exec(duration.trim());
  if (!perDay || !m) return 0;
  return Math.round(perDay * Number(m[1]) * ({ day: 1, week: 7, month: 30 } as Record<string, number>)[m[2].toLowerCase()]);
}

const FREQ_OPTS = ["OD", "BD", "TDS", "QID", "PRN", "Weekly", "At Night"].map(f => ({ value: f, label: f }));
const DUR_OPTS  = ["1 day","2 days","3 days","5 days","7 days","10 days","14 days","1 month","2 months","3 months","Ongoing"].map(d => ({ value: d, label: d }));

let nextId = 100;
const mkRow = (override: Partial<RxRow> = {}): RxRow => ({
  id: nextId++, medicine: "", dosage: "", frequency: "1-0-1", timing: "After Meal", duration: "5 days", instructions: "", quantity: "", ...override,
});

export default function NewPrescriptionPage() {
  const router = useRouter();
  useBreadcrumb("/prescriptions", "Prescriptions", "New Prescription");
  const { user } = useAuth();
  const isDoctorUser = user?.doctorId != null;
  const { run, loading, error } = useMutation();
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  const { items: myTemplates, reload: reloadTemplates } = useList<PrescriptionTemplateDTO>(
    "/prescriptions/templates",
    { all: true },
  );
  const tmplMutation = useMutation();

  const [rows, setRows] = useState<RxRow[]>([mkRow()]);
  const [medSearch, setMedSearch] = useState<Record<number, string>>({});
  /** A medicine was chosen from the list for this row, so the list stays closed until the name is typed over. */
  const [medPicked, setMedPicked] = useState<Record<number, boolean>>({});
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  // A doctor writing their own prescription starts with themselves as the doctor.
  useEffect(() => { if (user?.doctorId != null) setDoctorId((cur) => cur || String(user.doctorId)); }, [user?.doctorId]);
  // What the doctor writes for this patient (each line or ";" is one diagnosis); picking a saved one fills the box for editing.
  const [diagnosisText, setDiagnosisText] = useState("");
  const [secondaryText, setSecondaryText] = useState("");
  const parts = (t: string) => t.split(/[\n;]+/).map((x) => x.trim()).filter(Boolean);
  const diagnoses = parts(diagnosisText);
  const secondary = parts(secondaryText);
  const [notes] = useState("");
  const [language, setLanguage] = useState<Lang>("English");
  const [fillMsg, setFillMsg] = useState("");
  const [prevId, setPrevId] = useState("");
  const [consult, setConsult] = useState<Consultation>(emptyConsultation);

  // Choosing a patient fills in what the record already knows: latest vitals, history, allergies and the medicines last prescribed.
  const { items: readings } = useList<OpdVitalDTO>(patientId ? `/patients/${patientId}/vitals` : null, { all: true });
  const { items: previous } = useList<PrescriptionDTO>(patientId ? "/prescriptions" : null, { all: true, patient_id: patientId });
  const prevSorted = [...previous].sort((x, y) => y.id - x.id);
  const prefilled = useRef("");
  // What was filled in automatically, so a later, fuller answer can replace it but never something the doctor typed.
  const autoVals = useRef<Record<string, string>>({});
  const autoFor = useRef("");
  useEffect(() => {
    if (!patientId) { prefilled.current = ""; return; }
    const latest = readings[0];
    const key = `${patientId}:${latest?.id ?? "none"}:${prevSorted[0]?.id ?? "none"}`;
    if (prefilled.current === key) return;
    prefilled.current = key;
    const patient = patients.find(p => String(p.id) === patientId);
    if (autoFor.current !== patientId) { autoVals.current = {}; autoFor.current = patientId; }
    let dead = false;
    (async () => {
      let lastMeds = "";
      if (prevSorted[0]) {
        try {
          const d = await api.get<PrescriptionDTO>(`/prescriptions/${prevSorted[0].id}`);
          lastMeds = d.items.map(i => [i.medicineName, toPattern(i.frequency), i.timing].filter(Boolean).join(" ")).join("; ");
        } catch { /* the history just stays empty */ }
      }
      if (dead) return;
      setConsult(prev => {
        const entries = patient?.history ?? [];
        const ofType = (...t: string[]) => entries.filter(e => t.includes(e.type)).map(e => `${e.text}${e.since ? ` (${e.since})` : ""}`).join("; ");
        const allergyLine = patient?.allergies?.length ? `Allergies: ${patient.allergies.join(", ")}` : "";
        const patientHistory = prev.patientHistory?.length ? prev.patientHistory : [
          ...entries,
          ...((patient?.allergies ?? []).filter(a => !entries.some(e => e.type === "Allergy" && e.text.toLowerCase() === a.toLowerCase())).map(a => ({ type: "Allergy", text: a, since: "" }))),
        ];
        const pick = (name: string, cur: string, next: string) => { const auto = autoVals.current[name]; if (!cur.trim() || cur === auto) { autoVals.current[name] = next; return next; } return cur; };
        const vit = latest ? {
          ...prev.vitals,
          bp: latest.bpSystolic != null ? `${latest.bpSystolic}/${latest.bpDiastolic ?? ""}` : prev.vitals.bp,
          pulse: latest.pulse != null ? String(latest.pulse) : prev.vitals.pulse,
          temp: latest.temperature != null ? String(latest.temperature) : prev.vitals.temp,
          spo2: latest.spo2 != null ? String(latest.spo2) : prev.vitals.spo2,
          source: `From OPD vitals, ${formatDate(latest.recordedAt.slice(0, 10))} ${latest.recordedAt.slice(11, 16)}`,
        } : { ...prev.vitals, source: "No vitals on record — enter them here" };
        return {
          ...prev, vitals: vit, patientHistory,
          history: {
            past: pick("past", prev.history.past, [patient?.chronicConditions?.length ? patient.chronicConditions.join(", ") : "", ofType("Surgery")].filter(Boolean).join("; ")),
            family: pick("family", prev.history.family, ofType("Family")),
            personal: pick("personal", prev.history.personal, [ofType("Addiction"), ofType("Time"), ofType("Remarks")].filter(Boolean).join("; ")),
            medical: pick("medical", prev.history.medical, [lastMeds, allergyLine].filter(Boolean).join(". ")),
          },
        };
      });
    })();
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, readings, previous, patients]);

  /** Copies an earlier prescription of this patient into the form, to be changed where this visit differs. */
  async function fillFromPrevious() {
    if (!prevId) return;
    setFillMsg("");
    try {
      const d = await api.get<PrescriptionDTO>(`/prescriptions/${prevId}`);
      const c = d.consultation;
      if (c) setConsult(cur => ({ ...cur, ...c, vitals: cur.vitals, followUp: "", patientHistory: c.patientHistory?.length ? c.patientHistory : cur.patientHistory }));
      setDiagnosisText(d.diagnosis.split(";").map(x => x.trim()).filter(Boolean).join("\n"));
      setSecondaryText((c?.secondaryDiagnosis ?? "").split(";").map(x => x.trim()).filter(Boolean).join("\n"));
      if (d.items.length) setRows(d.items.map(i => mkRow({
        medicine: i.medicineName, dosage: i.dosage, frequency: toPattern(i.frequency) || "1-0-1", timing: i.timing ?? "", duration: i.duration || "5 days",
        instructions: i.instructions ?? "", quantity: i.quantity ?? "",
      })));
      if (d.language && (LANGS as string[]).includes(d.language)) setLanguage(d.language as Lang);
      setFillMsg(`Filled from ${d.rxNumber} (${formatDate(d.date)}). Check each part and change what is different today.`);
    } catch (e) { setFillMsg((e as Error).message || "That prescription could not be opened."); }
  }

  const addRow = () => setRows(prev => [...prev, mkRow()]);
  const removeRow = (id: number) => setRows(prev => prev.filter(r => r.id !== id));
  const updateRow = (id: number, field: keyof RxRow, value: string) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const applyTemplate = (t: PrescriptionTemplateDTO) => {
    setRows(t.items.map(it => mkRow({
      medicine: it.medicineName, dosage: it.dosage,
      frequency: toPattern(it.frequency) || "1-0-1", duration: it.duration || "5 days",
      instructions: it.instructions,
    })));
  };

  // ── Template create/edit modal ──
  const [tmplModalOpen, setTmplModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PrescriptionTemplateDTO | null>(null);
  const [tmplName, setTmplName] = useState("");
  const [tmplRows, setTmplRows] = useState<RxRow[]>([mkRow()]);
  const [tmplMedSearch, setTmplMedSearch] = useState<Record<number, string>>({});
  const medLookup = useMedicineMatches([...Object.values(medSearch), ...Object.values(tmplMedSearch)]);

  const openCreateTemplate = () => {
    setEditingTemplate(null);
    setTmplName("");
    setTmplRows([mkRow()]);
    setTmplMedSearch({});
    setTmplModalOpen(true);
  };
  const openEditTemplate = (t: PrescriptionTemplateDTO) => {
    setEditingTemplate(t);
    setTmplName(t.name);
    setTmplRows(t.items.length
      ? t.items.map(it => mkRow({
          medicine: it.medicineName, dosage: it.dosage,
          frequency: it.frequency || "OD", duration: it.duration || "7 days",
          instructions: it.instructions,
        }))
      : [mkRow()]);
    setTmplMedSearch({});
    setTmplModalOpen(true);
  };

  const addTmplRow = () => setTmplRows(prev => [...prev, mkRow()]);
  const removeTmplRow = (id: number) => setTmplRows(prev => prev.filter(r => r.id !== id));
  const updateTmplRow = (id: number, field: keyof RxRow, value: string) =>
    setTmplRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const tmplFilledRows = tmplRows.filter(r => r.medicine.trim());
  const tmplValid = tmplName.trim().length > 1 && tmplFilledRows.length > 0;

  const saveTemplate = async () => {
    const payload = {
      name: tmplName.trim(),
      items: tmplFilledRows.map(r => ({
        medicineId: medLookup.byName(r.medicine)?.id,
        medicineName: r.medicine,
        dosage: r.dosage,
        frequency: r.frequency,
        duration: r.duration,
        instructions: r.instructions,
      })),
    };
    await tmplMutation.run(() =>
      editingTemplate
        ? api.patch(`/prescriptions/templates/${editingTemplate.id}`, payload)
        : api.post("/prescriptions/templates", payload),
    );
    setTmplModalOpen(false);
    reloadTemplates();
  };

  const [deletingTemplate, setDeletingTemplate] = useState<PrescriptionTemplateDTO | null>(null);

  const confirmDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    await tmplMutation.run(() => api.del(`/prescriptions/templates/${deletingTemplate.id}`));
    setDeletingTemplate(null);
    reloadTemplates();
  };

  const filledRows = rows.filter(r => r.medicine.trim());
  const missing: string[] = [];
  if (!patientId) missing.push("patient");
  if (!doctorId) missing.push("doctor");
  if (diagnoses.join("; ").length < 2) missing.push("a diagnosis of at least 2 letters");
  if (filledRows.length === 0) missing.push("at least one medicine");
  const valid = missing.length === 0;

  async function save(after?: "print" | "download") {
    const patient = patients.find(p => String(p.id) === patientId);
    let created: PrescriptionDTO | undefined;
    try {
    created = await run(() =>
      api.post<PrescriptionDTO>("/prescriptions", {
        patientId: Number(patientId),
        patientName: patient?.name ?? "",
        patientAge: patient?.age ?? 0,
        doctorId: Number(doctorId),
        diagnosis: diagnoses.join("; "),
        status: "Pending",
        consultation: { ...consult, secondaryDiagnosis: secondary.join("; ") },
        primaryDiagnoses: diagnoses,
        secondaryDiagnoses: secondary,
        items: filledRows.map(r => ({
          medicineId: medLookup.byName(r.medicine)?.id,
          medicineName: r.medicine,
          dosage: r.dosage,
          frequency: r.frequency,
          timing: r.timing,
          duration: r.duration,
          quantity: r.quantity,
          instructions: r.instructions || notes || undefined,
        })),
        language,
      }),
    );
    } catch { return; } // the message is shown at the top of the form
    // Allergies, addictions and remarks written here are kept on the patient's record for next time.
    if (consult.patientHistory) await api.patch(`/patients/${patientId}`, { history: consult.patientHistory.filter(h => h.text.trim()) }).catch(() => null);
    // Print and download are chosen on the saved prescription (half or full, and the language).
    router.push(after && created?.id ? `/prescriptions/${created.id}?action=${after}` : "/prescriptions");
  }

  const filteredMed = (query: string) => medLookup.matches(query).slice(0, 8);

  return (
    <>
      <div className={`${tw.gutterX} pt-4 pb-3 flex items-end justify-between gap-4`}>
        <div className="flex flex-col gap-[2px]">
          <h1 className="text-[24px] font-medium text-[color:var(--ink)] leading-[28px]">New Prescription</h1>
          <p className="text-[13px] font-light text-[color:var(--ink-soft)] leading-[17px]">
            Record the consultation: vitals, complaint, examination, diagnosis, treatment and advice.
          </p>
        </div>
        {/* A doctor's menu opens this form, so the prescriptions already written for their patients are one click away. */}
        {isDoctorUser && (
          <Link href="/prescriptions" className="inline-flex h-[36px] shrink-0 items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-4 text-[13px] text-[color:var(--ink)] transition-colors hover:bg-[color:var(--subtle)]">
            <FileText size={14} /> View patients&apos; prescriptions
          </Link>
        )}
      </div>

      {error && (
        <div className={`${tw.gutterX} mb-3`}>
          <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>
        </div>
      )}

      <div className={`${tw.gutterX} mb-[30px] flex flex-col gap-4`}>
        <div className={`${tw.surface.card} ${tw.radius.card} p-5`}>
          <h3 className="text-[13px] font-medium text-[color:var(--ink)] mb-3">Patient & Doctor</h3>
          <TodayPatientPicker patientId={patientId} patients={patients} canPickAny={user?.role === "Super Admin"} isDoctor={isDoctorUser}
            onSelect={(id, docId) => { setPatientId(id); setPrevId(""); setFillMsg(""); if (docId && !isDoctorUser) setDoctorId(String(docId)); }} />
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormRow label="Doctor *">
              <SearchSelect
                placeholder="Search doctor…"
                value={doctorId}
                onChange={(v) => { if (!isDoctorUser) setDoctorId(v); }}
                options={doctors.map(d => ({ value: String(d.id), label: d.name, hint: d.specialty }))}
              />
            </FormRow>
            <FormRow label="Patient copy language" hint="Only the directions (when to take each medicine) are translated.">
              <select value={language} onChange={e => setLanguage(e.target.value as Lang)}
                className="h-[38px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)]">
                {LANGS.map(l => <option key={l}>{l}</option>)}
              </select>
            </FormRow>
            {patientId && (
              <FormRow label="Fill from a previous prescription" hint={prevSorted.length ? "Copies its history, examination, diagnosis and medicines. Vitals stay as they are today." : "This patient has no earlier prescription."}>
                <div className="flex gap-2">
                  <select value={prevId} onChange={e => setPrevId(e.target.value)} disabled={prevSorted.length === 0}
                    className="h-[38px] min-w-0 flex-1 bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] disabled:opacity-60">
                    <option value="">{prevSorted.length ? "Choose by date…" : "None"}</option>
                    {prevSorted.map(r => <option key={r.id} value={r.id}>{formatDate(r.date)} · {r.doctor} · {r.diagnosis.slice(0, 40)}</option>)}
                  </select>
                  <button type="button" onClick={() => void fillFromPrevious()} disabled={!prevId}
                    className="h-[38px] shrink-0 cursor-pointer rounded-[8px] bg-[color:var(--brand)] px-4 text-[13px] text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50">Fill</button>
                </div>
              </FormRow>
            )}
          </div>
          {fillMsg && <p className="mt-3 rounded-[8px] bg-[color:var(--brand-soft)] px-3 py-2 text-[12px] text-[color:var(--ink)]">{fillMsg}</p>}
        </div>

        <ConsultationForm
          doctorId={doctorId}
          patientId={patientId}
          value={consult}
          onChange={setConsult}
          diagnosis={
            <>
              <div>
                <p className="text-[13px] font-medium text-[color:var(--ink)] mb-2">Primary Diagnosis *</p>
                <DiagnosisPicker doctorId={doctorId} patientId={patientId} kind="Primary" value={diagnosisText} onChange={setDiagnosisText} rows={3} textPlaceholder="Type the diagnosis for this patient, or search below and edit it here…" placeholder="Search your earlier diagnoses or ICD-10…" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-[color:var(--ink)] mb-2">Secondary Diagnosis</p>
                <DiagnosisPicker doctorId={doctorId} patientId={patientId} kind="Secondary" value={secondaryText} onChange={setSecondaryText} rows={2} textPlaceholder="Type a secondary diagnosis, or search below and edit it here…" placeholder="Search your earlier diagnoses or ICD-10…" />
              </div>
            </>
          }
          treatment={
            <Section icon={<Pill size={18} />} title="Treatment & Follow-up">
              <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 text-[12px] font-medium text-[color:var(--ink-soft)]">
                  <Zap size={13} /> Quick Templates:
                </div>
                {myTemplates.map(t => (
                  <div key={t.id}
                    className="flex items-center gap-1 border border-[color:var(--brand)] rounded-full pl-3 pr-[6px] py-[3px] whitespace-nowrap">
                    <button onClick={() => applyTemplate(t)}
                      className="text-[12px] font-normal text-[color:var(--brand)] hover:underline">
                      {t.name}
                    </button>
                    {isDoctorUser && (
                      <>
                        <button onClick={() => openEditTemplate(t)} title="Edit template"
                          className="text-[color:var(--ink-soft)] hover:text-[color:var(--brand)] transition-colors p-[2px]">
                          <Pencil size={11} />
                        </button>
                        <button onClick={() => setDeletingTemplate(t)} title="Delete template"
                          className="text-[color:var(--ink-soft)] hover:text-[#ff0004] transition-colors p-[2px]">
                          <Trash2 size={11} />
                        </button>
                      </>
                    )}
                  </div>
                ))}

                {isDoctorUser && (
                  <button onClick={openCreateTemplate}
                    className="flex items-center gap-1 text-[12px] font-normal text-[color:var(--brand)] border border-dashed border-[color:var(--brand)] px-3 py-[5px] rounded-full hover:bg-[color:var(--brand-soft)] transition-colors whitespace-nowrap">
                    <Plus size={12} /> New Template
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-medium text-[color:var(--ink)]">Medicines ({rows.length})</h3>
                <button onClick={addRow} className="flex items-center gap-1 text-[12px] font-normal text-[color:var(--brand)] hover:underline">
                  <Plus size={13} /> Add Medicine
                </button>
              </div>

              <p className="text-[12px] text-[color:var(--ink-soft)]">
                Frequency is written <b>Morning-Afternoon-Night</b>: <b>1-0-1</b> means one in the morning and one at night, <b>0-0-1</b> night only,
                <b> 1-1-1</b> three times. A fourth number is the evening dose. The remarks for the patient are written from it.
              </p>

              {/* One medicine per line: the headings are written once, the fields follow in a row. */}
              {/* The bottom padding gives the open medicine list room inside the scrolling box; the negative margin gives the space back. */}
<div className="pointer-events-none -mb-[260px] overflow-x-auto pb-[260px]">
                <div className="pointer-events-auto min-w-[1020px]">
                  <div className="grid gap-2 px-1 pb-1 text-[10px] font-medium uppercase tracking-wider text-[color:var(--ink-soft)]" style={{ gridTemplateColumns: MED_COLS }}>
                    <span>Medicine</span><span>Dose</span><span>Morning – Afternoon – Night</span><span>When</span><span>Duration</span><span>Qty</span><span>Special instruction</span><span />
                  </div>
                  {rows.map((row, idx) => {
                    const remark = remarksOf(row, language);
                    const auto = autoQuantity(row.frequency, row.duration);
                    return (
                      <div key={row.id} className="border-b border-[color:var(--subtle-2)] py-2 last:border-0">
                        <div className="grid items-center gap-2" style={{ gridTemplateColumns: MED_COLS }}>
                          <div className="relative">
                            <input aria-label={`Medicine ${idx + 1}`} placeholder={`${idx + 1}. Search by name or formula…`} value={medSearch[row.id] ?? row.medicine}
                              onChange={e => { setMedPicked(prev => ({ ...prev, [row.id]: false })); setMedSearch(prev => ({ ...prev, [row.id]: e.target.value })); updateRow(row.id, "medicine", e.target.value); }}
                              className="h-[36px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-2 text-[12px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors" />
                            {(medSearch[row.id]?.length ?? 0) > 1 && row.medicine === medSearch[row.id] && !medPicked[row.id] && (
                              <div className="absolute left-0 right-0 top-[40px] z-10 overflow-hidden rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] shadow-md">
                                {filteredMed(medSearch[row.id]).map(m => (
                                  <button key={m.id} onClick={() => {
                                    updateRow(row.id, "medicine", m.name);
                                    updateRow(row.id, "dosage", m.defaultDosage);
                                    updateRow(row.id, "frequency", toPattern(m.defaultFrequency) || "1-0-1");
                                    updateRow(row.id, "duration", m.defaultDuration);
                                    setMedSearch(prev => ({ ...prev, [row.id]: m.name }));
                                    setMedPicked(prev => ({ ...prev, [row.id]: true }));
                                  }} className="block w-full border-b border-[color:var(--subtle-2)] px-3 py-2 text-left text-[12px] last:border-0 hover:bg-[color:var(--subtle)]">
                                    <span className="block font-medium text-[color:var(--ink)]">{m.name}</span>
                                    {m.generic && <span className="block text-[11px] text-[color:var(--brand)]">{m.generic}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <input aria-label="Dose each time" value={row.dosage} onChange={e => updateRow(row.id, "dosage", e.target.value)} placeholder="1 tablet" className="h-[36px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-2 text-[12px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors" />
                          <PatternInput value={row.frequency} onChange={(v) => updateRow(row.id, "frequency", v)} />
                          <select aria-label="When" value={row.timing} onChange={e => updateRow(row.id, "timing", e.target.value)} className="h-[36px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-2 text-[12px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors">
                            {TIMINGS.map(t => <option key={t} value={t}>{t || "Any time"}</option>)}
                          </select>
                          <select aria-label="Duration" value={row.duration} onChange={e => updateRow(row.id, "duration", e.target.value)} className="h-[36px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-2 text-[12px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors">
                            {(DUR_OPTS.some(o => o.value === row.duration) ? DUR_OPTS : [{ value: row.duration, label: row.duration }, ...DUR_OPTS]).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <input aria-label="Quantity" value={row.quantity} onChange={e => updateRow(row.id, "quantity", e.target.value)} placeholder={auto ? String(auto) : "Qty"}
                            onFocus={() => { if (!row.quantity && auto > 0) updateRow(row.id, "quantity", String(auto)); }} className="h-[36px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-2 text-[12px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors" />
                          <input aria-label="Special instruction" value={row.instructions} onChange={e => updateRow(row.id, "instructions", e.target.value)} placeholder="e.g. in a glass of water" className="h-[36px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-2 text-[12px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors" />
                          {rows.length > 1 ? (
                            <button onClick={() => removeRow(row.id)} aria-label="Remove medicine" className="flex h-[36px] items-center justify-center text-[#ff0004] transition-colors hover:text-red-700"><Trash2 size={14} /></button>
                          ) : <span />}
                        </div>
                        <p className="mt-1 truncate px-1 text-[11px] text-[color:var(--ink-soft)]" title={remark.line}>
                          {remark.line ? <>Patient will read: <span className="text-[color:var(--ink)]">{remark.line}{remark.special ? ` ${remark.special}` : ""}</span></> : "Fill the dose, pattern and duration to see the directions."}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-medium text-[color:var(--ink)]">Follow-up</span>
                  
                  <input type="date" min={new Date().toISOString().slice(0, 10)} value={consult.followUp} onChange={e => setConsult({ ...consult, followUp: e.target.value })}
                    className="h-[34px] bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)]" />
                  <span className="text-[12px] text-[color:var(--ink-soft)]">Added to Follow-ups so the hospital can contact the patient.</span>
                </div>
              </div>
            </Section>
          }
        />
      </div>

      {/* Save sits at the bottom, where the form ends. */}
      <div className="sticky bottom-0 z-30 border-t border-[color:var(--line)] bg-[color:var(--surface)]/95 backdrop-blur-sm">
        <div className={`${tw.gutterX} flex flex-wrap items-center justify-end gap-3 py-3`}>
          {!valid && (
            <span className="text-[12px] font-normal text-[#ff9000]">Add {missing.join(", ")} to save.</span>
          )}
          <button onClick={() => void save("print")} disabled={!valid || loading} className="flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-5 py-[9px] text-[13px] text-[color:var(--ink)] transition-colors hover:bg-[color:var(--subtle)] disabled:cursor-default disabled:opacity-50 cursor-pointer">
            <Printer size={14} /> Save &amp; Print
          </button>
          <button onClick={() => void save("download")} disabled={!valid || loading} className="flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-5 py-[9px] text-[13px] text-[color:var(--ink)] transition-colors hover:bg-[color:var(--subtle)] disabled:cursor-default disabled:opacity-50 cursor-pointer">
            <Download size={14} /> Save &amp; Download
          </button>
          <button onClick={() => void save()} disabled={!valid || loading} className="flex items-center gap-2 text-[13px] font-medium text-white bg-[color:var(--brand)] px-6 py-[9px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-default">
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {loading ? "Saving…" : "Save Prescription"}
          </button>
        </div>
      </div>

      <Modal
        open={tmplModalOpen}
        onClose={() => setTmplModalOpen(false)}
        title={editingTemplate ? "Edit Template" : "New Template"}
        width={680}
        footer={
          <>
            <button onClick={() => setTmplModalOpen(false)}
              className="text-[13px] font-normal text-[color:var(--ink-soft)] px-4 py-[8px] rounded-full hover:bg-[color:var(--subtle-2)] transition-colors">
              Cancel
            </button>
            <button onClick={saveTemplate} disabled={!tmplValid || tmplMutation.loading}
              className="flex items-center gap-2 text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
              {tmplMutation.loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {tmplMutation.loading ? "Saving…" : "Save Template"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {tmplMutation.error && (
            <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">
              {tmplMutation.error.message}
            </div>
          )}
          <FormRow label="Template Name" required>
            <FormInput placeholder="e.g. Migraine relief" value={tmplName} onChange={setTmplName} />
          </FormRow>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Medicines</span>
              <button onClick={addTmplRow} className="flex items-center gap-1 text-[12px] font-normal text-[color:var(--brand)] hover:underline">
                <Plus size={13} /> Add Medicine
              </button>
            </div>

            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr_26px] gap-2 px-1">
              {["Medicine", "Dosage", "Frequency", "Duration", "Instructions", ""].map(h => (
                <span key={h} className="text-[10px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">{h}</span>
              ))}
            </div>

            {tmplRows.map(row => (
              <div key={row.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr_26px] gap-2 items-start">
                <div className="relative">
                  <input
                    placeholder="Search medicine..."
                    value={tmplMedSearch[row.id] ?? row.medicine}
                    onChange={e => {
                      setTmplMedSearch(prev => ({ ...prev, [row.id]: e.target.value }));
                      updateTmplRow(row.id, "medicine", e.target.value);
                    }}
                    className="h-[36px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 text-[12px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors"
                  />
                  {(tmplMedSearch[row.id]?.length ?? 0) > 1 && !row.medicine.includes("mg") && (
                    <div className="absolute top-[38px] left-0 right-0 bg-[color:var(--surface)] border border-[color:var(--line)] rounded-[8px] shadow-md z-10 overflow-hidden">
                      {filteredMed(tmplMedSearch[row.id]).map(m => (
                        <button key={m.id} onClick={() => {
                          updateTmplRow(row.id, "medicine", m.name);
                          updateTmplRow(row.id, "dosage", m.defaultDosage);
                          updateTmplRow(row.id, "frequency", m.defaultFrequency);
                          updateTmplRow(row.id, "duration", m.defaultDuration);
                          setTmplMedSearch(prev => ({ ...prev, [row.id]: m.name }));
                        }} className="w-full text-left px-3 py-2 text-[12px] hover:bg-[color:var(--subtle)] border-b border-[color:var(--subtle-2)] last:border-0">
                          <span className="font-medium text-[color:var(--ink)]">{m.name}</span>
                          <span className="text-[color:var(--ink-soft)] ml-2 text-[11px]">{m.generic}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input value={row.dosage} onChange={e => updateTmplRow(row.id, "dosage", e.target.value)}
                  placeholder="e.g. 500mg"
                  className="h-[36px] bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 text-[12px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors" />
                <select value={row.frequency} onChange={e => updateTmplRow(row.id, "frequency", e.target.value)}
                  className="h-[36px] bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-2 text-[12px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors">
                  {FREQ_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select value={row.duration} onChange={e => updateTmplRow(row.id, "duration", e.target.value)}
                  className="h-[36px] bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-2 text-[12px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors">
                  {DUR_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input value={row.instructions} onChange={e => updateTmplRow(row.id, "instructions", e.target.value)}
                  placeholder="With meals, etc."
                  className="h-[36px] bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 text-[12px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors" />
                {tmplRows.length > 1 ? (
                  <button onClick={() => removeTmplRow(row.id)} className="flex items-center justify-center h-[36px] text-[#ff0004] hover:text-red-700 transition-colors">
                    <Trash2 size={13} />
                  </button>
                ) : <div />}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        open={deletingTemplate != null}
        onClose={() => setDeletingTemplate(null)}
        title="Delete Template"
        width={420}
        footer={
          <>
            <button onClick={() => setDeletingTemplate(null)}
              className="text-[13px] font-normal text-[color:var(--ink-soft)] px-4 py-[8px] rounded-full hover:bg-[color:var(--subtle-2)] transition-colors">
              Cancel
            </button>
            <button onClick={confirmDeleteTemplate} disabled={tmplMutation.loading}
              className="flex items-center gap-2 text-[13px] font-normal text-white bg-[#ff0004] px-5 py-[8px] rounded-full hover:bg-red-700 transition-colors disabled:opacity-50">
              {tmplMutation.loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {tmplMutation.loading ? "Deleting…" : "Delete"}
            </button>
          </>
        }
      >
        <p className="text-[13px] font-normal text-[color:var(--ink-soft)] leading-5">
          Delete template <span className="font-medium text-[color:var(--ink)]">“{deletingTemplate?.name}”</span>? This can&apos;t be undone.
        </p>
      </Modal>
    </>
  );
}
