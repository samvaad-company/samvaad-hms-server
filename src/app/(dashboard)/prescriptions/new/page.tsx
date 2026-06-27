"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { medicines, prescriptionTemplates } from "@/data/medicines";
import { patients } from "@/data/patients";
import { icd10Codes } from "@/data/icd10";
import { FormRow, FormSelect, FormTextarea } from "@/components/shared/FormRow";
import { ChevronLeft, Plus, Trash2, Search, Zap } from "lucide-react";
import Link from "next/link";

type RxRow = { id: number; medicine: string; dosage: string; frequency: string; duration: string; instructions: string };

const FREQ_OPTS = ["OD", "BD", "TDS", "QID", "PRN", "Weekly", "At Night"].map(f => ({ value: f, label: f }));
const DUR_OPTS  = ["3 days","5 days","7 days","10 days","14 days","1 month","2 months","3 months","Ongoing"].map(d => ({ value: d, label: d }));
const TEMPLATES = [
  { label: "Fever",      key: "fever"        },
  { label: "Diabetes",   key: "diabetes"     },
  { label: "Hypertension",key:"hypertension" },
  { label: "Cold / URTI",key: "cold"        },
  { label: "Acidity",    key: "acidity"      },
];

let nextId = 100;
const mkRow = (override: Partial<RxRow> = {}): RxRow => ({
  id: nextId++, medicine: "", dosage: "", frequency: "OD", duration: "7 days", instructions: "", ...override,
});

export default function NewPrescriptionPage() {
  const [rows, setRows] = useState<RxRow[]>([mkRow()]);
  const [medSearch, setMedSearch] = useState<Record<number, string>>({});
  const [diagnosis, setDiagnosis] = useState("");
  const [icdSearch, setIcdSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [foodInstr, setFoodInstr] = useState("");

  const addRow = () => setRows(prev => [...prev, mkRow()]);
  const removeRow = (id: number) => setRows(prev => prev.filter(r => r.id !== id));
  const updateRow = (id: number, field: keyof RxRow, value: string) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const applyTemplate = (key: string) => {
    const tmpl = (prescriptionTemplates as Record<string, any[]>)[key] ?? [];
    setRows(tmpl.map((m, i) => mkRow({
      medicine: m.name, dosage: m.defaultDosage,
      frequency: m.defaultFrequency, duration: m.defaultDuration,
    })));
  };

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
      <div className={`${tw.gutterX} mb-4 pt-2 flex items-center justify-between`}>
        <Link href="/prescriptions" className="inline-flex items-center gap-1 text-[13px] font-normal text-[#57575f] hover:text-[#11111c] transition-colors">
          <ChevronLeft size={15} /> Back to Prescriptions
        </Link>
        <div className="flex items-center gap-2">
          <button className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-4 py-[7px] rounded-full hover:bg-[#f6f6f6] transition-colors">Preview</button>
          <button className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[7px] rounded-full hover:bg-[#007f82] transition-colors">Save Prescription</button>
        </div>
      </div>

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className="grid grid-cols-3 gap-5">
          {/* ── Left: Patient + ICD + Notes ── */}
          <div className="col-span-1 flex flex-col gap-4">
            {/* Patient */}
            <div className={`${tw.surface.card} ${tw.radius.card} p-5`}>
              <h3 className="text-[13px] font-medium text-[#11111c] mb-3">Patient & Doctor</h3>
              <div className="flex flex-col gap-3">
                <FormRow label="Patient *">
                  <FormSelect placeholder="Search patient" options={patients.map(p => ({ value: String(p.id), label: `${p.name} — ${p.patientId}` }))} />
                </FormRow>
                <FormRow label="Doctor *">
                  <FormSelect placeholder="Select doctor" options={[
                    { value: "1", label: "Dr. Ethan Miller" }, { value: "2", label: "Dr. Sophia Adams" },
                    { value: "3", label: "Dr. Daniel Reed" },  { value: "4", label: "Dr. Emily Cooper" },
                  ]} />
                </FormRow>
              </div>
            </div>

            {/* ICD-10 Diagnosis */}
            <div className={`${tw.surface.card} ${tw.radius.card} p-5`}>
              <h3 className="text-[13px] font-medium text-[#11111c] mb-3">Diagnosis (ICD-10)</h3>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#57575f]" />
                <input
                  placeholder="Search diagnosis..."
                  value={icdSearch}
                  onChange={e => setIcdSearch(e.target.value)}
                  className="h-[38px] w-full bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] pl-[34px] pr-3 text-[13px] text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors"
                />
              </div>
              {icdSearch && (
                <div className="mt-2 border border-[#dedee1] rounded-[8px] overflow-hidden">
                  {filteredIcd.map(c => (
                    <button key={c.code} onClick={() => { setDiagnosis(`${c.description} (${c.code})`); setIcdSearch(""); }}
                      className="w-full text-left px-3 py-2 text-[12px] hover:bg-[#f6f6f6] border-b border-[#f0f0f0] last:border-0 transition-colors">
                      <span className="font-medium text-[#009598]">{c.code}</span>
                      <span className="text-[#57575f] ml-2">{c.description}</span>
                    </button>
                  ))}
                </div>
              )}
              {diagnosis && (
                <div className="mt-2 p-2 bg-[#e8f7f7] rounded-[6px] flex items-center justify-between">
                  <span className="text-[12px] font-normal text-[#009598]">{diagnosis}</span>
                  <button onClick={() => setDiagnosis("")} className="text-[#57575f] hover:text-[#ff0004] ml-2"><Trash2 size={12} /></button>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className={`${tw.surface.card} ${tw.radius.card} p-5`}>
              <h3 className="text-[13px] font-medium text-[#11111c] mb-3">Clinical Notes</h3>
              <FormTextarea placeholder="Notes for patient or pharmacist..." value={notes} onChange={v => setNotes(v)} rows={3} />
              <div className="mt-3">
                <label className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider block mb-1">Food Instructions</label>
                <FormTextarea placeholder="e.g. Low-sodium diet, avoid spicy food..." value={foodInstr} onChange={v => setFoodInstr(v)} rows={2} />
              </div>
            </div>
          </div>

          {/* ── Right: Medicine builder ── */}
          <div className="col-span-2 flex flex-col gap-4">
            {/* Quick templates */}
            <div className={`${tw.surface.card} ${tw.radius.card} p-4`}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 text-[12px] font-medium text-[#57575f]">
                  <Zap size={13} /> Quick Templates:
                </div>
                {TEMPLATES.map(t => (
                  <button key={t.key} onClick={() => applyTemplate(t.key)}
                    className="text-[12px] font-normal text-[#009598] border border-[#009598] px-3 py-[5px] rounded-full hover:bg-[#e8f7f7] transition-colors whitespace-nowrap">
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Medicines table */}
            <div className={`${tw.surface.card} ${tw.radius.card} p-5 flex flex-col gap-3`}>
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-medium text-[#11111c]">Medicines ({rows.length})</h3>
                <button onClick={addRow} className="flex items-center gap-1 text-[12px] font-normal text-[#009598] hover:underline">
                  <Plus size={13} /> Add Medicine
                </button>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr_30px] gap-2 px-1">
                {["Medicine", "Dosage", "Frequency", "Duration", "Instructions", ""].map(h => (
                  <span key={h} className="text-[10px] font-medium text-[#57575f] uppercase tracking-wider">{h}</span>
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
                      className="h-[38px] w-full bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-3 text-[12px] text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors"
                    />
                    {(medSearch[row.id]?.length ?? 0) > 1 && !row.medicine.includes("mg") && (
                      <div className="absolute top-[40px] left-0 right-0 bg-white border border-[#dedee1] rounded-[8px] shadow-md z-10 overflow-hidden">
                        {filteredMed(medSearch[row.id]).map(m => (
                          <button key={m.id} onClick={() => {
                            updateRow(row.id, "medicine", m.name);
                            updateRow(row.id, "dosage", m.defaultDosage);
                            updateRow(row.id, "frequency", m.defaultFrequency);
                            updateRow(row.id, "duration", m.defaultDuration);
                            setMedSearch(prev => ({ ...prev, [row.id]: m.name }));
                          }} className="w-full text-left px-3 py-2 text-[12px] hover:bg-[#f6f6f6] border-b border-[#f0f0f0] last:border-0">
                            <span className="font-medium text-[#11111c]">{m.name}</span>
                            <span className="text-[#57575f] ml-2 text-[11px]">{m.generic}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Dosage */}
                  <input value={row.dosage} onChange={e => updateRow(row.id, "dosage", e.target.value)}
                    placeholder="e.g. 500mg"
                    className="h-[38px] bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-3 text-[12px] text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors" />
                  {/* Frequency */}
                  <select value={row.frequency} onChange={e => updateRow(row.id, "frequency", e.target.value)}
                    className="h-[38px] bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-2 text-[12px] text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors">
                    {FREQ_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {/* Duration */}
                  <select value={row.duration} onChange={e => updateRow(row.id, "duration", e.target.value)}
                    className="h-[38px] bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-2 text-[12px] text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors">
                    {DUR_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {/* Instructions */}
                  <input value={row.instructions} onChange={e => updateRow(row.id, "instructions", e.target.value)}
                    placeholder="With meals, etc."
                    className="h-[38px] bg-[#f6f6f6] border border-[#dedee1] rounded-[8px] px-3 text-[12px] text-[#11111c] focus:outline-none focus:border-[#009598] transition-colors" />
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
    </>
  );
}
