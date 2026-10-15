"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tw } from "@/lib/design-system";
import { icd10Codes } from "@/data/icd10";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import { useAuth } from "@/lib/auth-context";
import type { PatientDTO, DoctorDTO, MedicineDTO, PrescriptionTemplateDTO } from "@/types/api";
import { FormRow, FormInput, FormTextarea } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { Modal } from "@/components/shared/Modal";
import { Plus, Trash2, Pencil, Search, Zap, Loader2 } from "lucide-react";

type RxRow = { id: number; medicine: string; dosage: string; frequency: string; duration: string; instructions: string };

const FREQ_OPTS = ["OD", "BD", "TDS", "QID", "PRN", "Weekly", "At Night"].map(f => ({ value: f, label: f }));
const DUR_OPTS  = ["3 days","5 days","7 days","10 days","14 days","1 month","2 months","3 months","Ongoing"].map(d => ({ value: d, label: d }));

let nextId = 100;
const mkRow = (override: Partial<RxRow> = {}): RxRow => ({
  id: nextId++, medicine: "", dosage: "", frequency: "OD", duration: "7 days", instructions: "", ...override,
});

export default function NewPrescriptionPage() {
  const router = useRouter();
  useBreadcrumb("/prescriptions", "Prescriptions", "New Prescription");
  const { user } = useAuth();
  const isDoctorUser = user?.doctorId != null;
  const { run, loading, error } = useMutation();
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  const { items: medicines } = useList<MedicineDTO>("/medicines", { all: true });
  const { items: myTemplates, reload: reloadTemplates } = useList<PrescriptionTemplateDTO>(
    "/prescriptions/templates",
    { all: true },
  );
  const tmplMutation = useMutation();

  const [rows, setRows] = useState<RxRow[]>([mkRow()]);
  const [medSearch, setMedSearch] = useState<Record<number, string>>({});
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [diagnoses, setDiagnoses] = useState<string[]>([]);
  const [icdSearch, setIcdSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [foodInstr, setFoodInstr] = useState("");

  const addDiagnosis = (d: string) => {
    const clean = d.trim();
    if (!clean) return;
    setDiagnoses(prev => (prev.includes(clean) ? prev : [...prev, clean]));
    setIcdSearch("");
  };
  const removeDiagnosis = (d: string) =>
    setDiagnoses(prev => prev.filter(x => x !== d));

  const addRow = () => setRows(prev => [...prev, mkRow()]);
  const removeRow = (id: number) => setRows(prev => prev.filter(r => r.id !== id));
  const updateRow = (id: number, field: keyof RxRow, value: string) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const applyTemplate = (t: PrescriptionTemplateDTO) => {
    setRows(t.items.map(it => mkRow({
      medicine: it.medicineName, dosage: it.dosage,
      frequency: it.frequency || "OD", duration: it.duration || "7 days",
      instructions: it.instructions,
    })));
  };

  // ── Template create/edit modal ──
  const [tmplModalOpen, setTmplModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PrescriptionTemplateDTO | null>(null);
  const [tmplName, setTmplName] = useState("");
  const [tmplRows, setTmplRows] = useState<RxRow[]>([mkRow()]);
  const [tmplMedSearch, setTmplMedSearch] = useState<Record<number, string>>({});

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
        medicineId: medicines.find(m => m.name === r.medicine)?.id,
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
  if (diagnoses.length === 0) missing.push("at least one diagnosis");
  if (filledRows.length === 0) missing.push("at least one medicine");
  const valid = missing.length === 0;

  async function save() {
    const patient = patients.find(p => String(p.id) === patientId);
    await run(() =>
      api.post("/prescriptions", {
        patientId: Number(patientId),
        patientName: patient?.name ?? "",
        patientAge: patient?.age ?? 0,
        doctorId: Number(doctorId),
        diagnosis: diagnoses.join("; "),
        status: "Pending",
        items: filledRows.map(r => ({
          medicineId: medicines.find(m => m.name === r.medicine)?.id,
          medicineName: r.medicine,
          dosage: r.dosage,
          frequency: r.frequency,
          duration: r.duration,
          instructions: r.instructions || notes || undefined,
        })),
      }),
    );
    router.push("/prescriptions");
  }

  const filteredIcd = icd10Codes.filter(c =>
    c.description.toLowerCase().includes(icdSearch.toLowerCase()) ||
    c.code.toLowerCase().includes(icdSearch.toLowerCase())
  ).slice(0, 6);

  const filteredMed = (query: string) =>
    medicines.filter(m =>
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.generic.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);

  return (
    <>
      <div className={`${tw.gutterX} pt-4 pb-3 flex items-end justify-between gap-4`}>
        <div className="flex flex-col gap-[2px]">
          <h1 className="text-[24px] font-medium text-[color:var(--ink)] leading-[28px]">New Prescription</h1>
          <p className="text-[13px] font-light text-[color:var(--ink-soft)] leading-[17px]">
            Select patient and doctor, add diagnoses and medicines, then save.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!valid && (
            <span className="text-[12px] font-normal text-[#ff9000] whitespace-nowrap">
              Add {missing.join(", ")} to save.
            </span>
          )}
          <button onClick={save} disabled={!valid || loading} className="flex items-center gap-2 text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {loading ? "Saving…" : "Save Prescription"}
          </button>
        </div>
      </div>

      {error && (
        <div className={`${tw.gutterX} mb-3`}>
          <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>
        </div>
      )}

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className="grid grid-cols-3 gap-5">
          {/* ── Left: Patient + ICD + Notes ── */}
          <div className="col-span-1 flex flex-col gap-4">
            {/* Patient */}
            <div className={`${tw.surface.card} ${tw.radius.card} p-5`}>
              <h3 className="text-[13px] font-medium text-[color:var(--ink)] mb-3">Patient & Doctor</h3>
              <div className="flex flex-col gap-3">
                <FormRow label="Patient *">
                  <SearchSelect
                    placeholder="Search patient…"
                    value={patientId}
                    onChange={setPatientId}
                    options={patients.map(p => ({ value: String(p.id), label: p.name, hint: `${p.patientId ?? ""} · ${p.phone}` }))}
                  />
                </FormRow>
                <FormRow label="Doctor *">
                  <SearchSelect
                    placeholder="Search doctor…"
                    value={doctorId}
                    onChange={setDoctorId}
                    options={doctors.map(d => ({ value: String(d.id), label: d.name, hint: d.specialty }))}
                  />
                </FormRow>
              </div>
            </div>

            {/* ICD-10 Diagnoses (multiple) */}
            <div className={`${tw.surface.card} ${tw.radius.card} p-5`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-medium text-[color:var(--ink)]">Diagnoses (ICD-10)</h3>
                {diagnoses.length > 0 && (
                  <span className="text-[11px] font-normal text-[color:var(--ink-soft)]">{diagnoses.length} added</span>
                )}
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
                <input
                  placeholder="Search ICD-10 or type & press Enter…"
                  value={icdSearch}
                  onChange={e => setIcdSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDiagnosis(icdSearch);
                    }
                  }}
                  className="h-[38px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] pl-[34px] pr-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors"
                />
              </div>
              {icdSearch && (
                <div className="mt-2 border border-[color:var(--line)] rounded-[8px] overflow-hidden">
                  {filteredIcd.map(c => (
                    <button key={c.code} onClick={() => addDiagnosis(`${c.description} (${c.code})`)}
                      className="w-full text-left px-3 py-2 text-[12px] hover:bg-[color:var(--subtle)] border-b border-[color:var(--subtle-2)] last:border-0 transition-colors">
                      <span className="font-medium text-[color:var(--brand)]">{c.code}</span>
                      <span className="text-[color:var(--ink-soft)] ml-2">{c.description}</span>
                    </button>
                  ))}
                  <button onClick={() => addDiagnosis(icdSearch)}
                    className="w-full text-left px-3 py-2 text-[12px] text-[color:var(--brand)] hover:bg-[color:var(--brand-soft)] transition-colors">
                    + Add “{icdSearch.trim()}” as free-text diagnosis
                  </button>
                </div>
              )}
              {diagnoses.length > 0 && (
                <div className="mt-3 flex flex-col gap-[6px]">
                  {diagnoses.map(d => (
                    <div key={d} className="p-2 bg-[color:var(--brand-soft)] rounded-[6px] flex items-center justify-between gap-2">
                      <span className="text-[12px] font-normal text-[color:var(--brand)] min-w-0 truncate">{d}</span>
                      <button onClick={() => removeDiagnosis(d)} className="text-[color:var(--ink-soft)] hover:text-[#ff0004] shrink-0"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className={`${tw.surface.card} ${tw.radius.card} p-5`}>
              <h3 className="text-[13px] font-medium text-[color:var(--ink)] mb-3">Clinical Notes</h3>
              <FormTextarea placeholder="Notes for patient or pharmacist..." value={notes} onChange={v => setNotes(v)} rows={3} />
              <div className="mt-3">
                <label className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider block mb-1">Food Instructions</label>
                <FormTextarea placeholder="e.g. Low-sodium diet, avoid spicy food..." value={foodInstr} onChange={v => setFoodInstr(v)} rows={2} />
              </div>
            </div>
          </div>

          {/* ── Right: Medicine builder ── */}
          <div className="col-span-2 flex flex-col gap-4">
            {/* Quick templates */}
            <div className={`${tw.surface.card} ${tw.radius.card} p-4`}>
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

            {/* Medicines table */}
            <div className={`${tw.surface.card} ${tw.radius.card} p-5 flex flex-col gap-3`}>
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-medium text-[color:var(--ink)]">Medicines ({rows.length})</h3>
                <button onClick={addRow} className="flex items-center gap-1 text-[12px] font-normal text-[color:var(--brand)] hover:underline">
                  <Plus size={13} /> Add Medicine
                </button>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr_30px] gap-2 px-1">
                {["Medicine", "Dosage", "Frequency", "Duration", "Instructions", ""].map(h => (
                  <span key={h} className="text-[10px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">{h}</span>
                ))}
              </div>

              {rows.map(row => (
                <div key={row.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr_30px] gap-2 items-start">
                  {/* Medicine search */}
                  <div className="relative">
                    <input
                      placeholder="Search medicine..."
                      value={medSearch[row.id] ?? row.medicine}
                      onChange={e => {
                        setMedSearch(prev => ({ ...prev, [row.id]: e.target.value }));
                        updateRow(row.id, "medicine", e.target.value);
                      }}
                      className="h-[38px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 text-[12px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors"
                    />
                    {(medSearch[row.id]?.length ?? 0) > 1 && !row.medicine.includes("mg") && (
                      <div className="absolute top-[40px] left-0 right-0 bg-[color:var(--surface)] border border-[color:var(--line)] rounded-[8px] shadow-md z-10 overflow-hidden">
                        {filteredMed(medSearch[row.id]).map(m => (
                          <button key={m.id} onClick={() => {
                            updateRow(row.id, "medicine", m.name);
                            updateRow(row.id, "dosage", m.defaultDosage);
                            updateRow(row.id, "frequency", m.defaultFrequency);
                            updateRow(row.id, "duration", m.defaultDuration);
                            setMedSearch(prev => ({ ...prev, [row.id]: m.name }));
                          }} className="w-full text-left px-3 py-2 text-[12px] hover:bg-[color:var(--subtle)] border-b border-[color:var(--subtle-2)] last:border-0">
                            <span className="font-medium text-[color:var(--ink)]">{m.name}</span>
                            <span className="text-[color:var(--ink-soft)] ml-2 text-[11px]">{m.generic}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Dosage */}
                  <input value={row.dosage} onChange={e => updateRow(row.id, "dosage", e.target.value)}
                    placeholder="e.g. 500mg"
                    className="h-[38px] bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 text-[12px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors" />
                  {/* Frequency */}
                  <select value={row.frequency} onChange={e => updateRow(row.id, "frequency", e.target.value)}
                    className="h-[38px] bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-2 text-[12px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors">
                    {FREQ_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {/* Duration */}
                  <select value={row.duration} onChange={e => updateRow(row.id, "duration", e.target.value)}
                    className="h-[38px] bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-2 text-[12px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors">
                    {DUR_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {/* Instructions */}
                  <input value={row.instructions} onChange={e => updateRow(row.id, "instructions", e.target.value)}
                    placeholder="With meals, etc."
                    className="h-[38px] bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 text-[12px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] transition-colors" />
                  {/* Delete */}
                  {rows.length > 1 ? (
                    <button onClick={() => removeRow(row.id)} className="flex items-center justify-center h-[38px] text-[#ff0004] hover:text-red-700 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  ) : <div />}
                </div>
              ))}
            </div>
          </div>
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
