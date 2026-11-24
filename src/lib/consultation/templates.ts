import type { Consultation, ConsultationField, ConsultationSystem } from "@/types/consultation";

let seq = 0;
export const newFieldId = () => `f${Date.now().toString(36)}${(seq++).toString(36)}`;

const AP = ["Absent", "Present"];
const NA = ["Normal", "Abnormal"];

const choice = (label: string, options: string[]): ConsultationField => ({ id: newFieldId(), label, kind: "choice", options, value: "" });
const multi = (label: string, options: string[]): ConsultationField => ({ id: newFieldId(), label, kind: "multi", options, value: "" });
const text = (label: string, extra: Partial<ConsultationField> = {}): ConsultationField => ({ id: newFieldId(), label, kind: "text", value: "", ...extra });

/** The built-in systemic examination templates. Each call returns fresh copies so a prescription never shares state. */
export const SYSTEM_TEMPLATES: { key: string; title: string; build: () => ConsultationField[] }[] = [
  {
    key: "cns", title: "Central Nervous System (CNS)",
    build: () => [
      choice("Consciousness", ["Conscious", "Drowsy", "Unconscious"]),
      multi("Orientation", ["Time", "Place", "Person"]),
      choice("Higher Mental Functions", NA),
      choice("Speech", NA),
      text("Motor System", { placeholder: "Tone, power and reflexes" }),
      choice("Sensory System", ["Intact", "Impaired"]),
      choice("Plantar Response", ["Bilateral Flexor", "Extensor"]),
      choice("Neck Rigidity", AP),
    ],
  },
  {
    key: "cvs", title: "Cardiovascular System (CVS)",
    build: () => [
      text("S1, S2", { placeholder: "Normal" }),
      text("Heart Rate", { unit: "bpm", placeholder: "72" }),
      choice("Rhythm", ["Regular", "Irregular"]),
      choice("Murmur", AP),
      choice("Peripheral Pulses", ["Palpable", "Feeble"]),
      choice("JVP", ["Normal", "Raised"]),
    ],
  },
  {
    key: "rs", title: "Respiratory System (RS)",
    build: () => [
      choice("Chest Shape", NA),
      choice("Bilateral Air Entry", ["Equal", "Reduced"]),
      choice("Breath Sounds", ["Vesicular", "Bronchial"]),
      choice("Added Sounds", AP),
      choice("Crepitations", AP),
      choice("Rhonchi / Wheeze", AP),
    ],
  },
  {
    key: "pa", title: "Per Abdomen (P/A)",
    build: () => [
      choice("Inspection", ["Normal", "Distended"]),
      choice("Palpation", ["Soft", "Tender"]),
      choice("Guarding / Rigidity", AP),
      choice("Organomegaly", AP),
      choice("Percussion", ["Tympanic", "Dull"]),
      choice("Bowel Sounds", ["Present", "Absent"]),
    ],
  },
  {
    key: "msk", title: "Musculoskeletal System",
    build: () => [
      choice("Joint Deformity", AP),
      choice("Joint Swelling", AP),
      choice("Range of Motion", ["Full", "Restricted"]),
      choice("Muscle Tone and Power", ["Normal", "Reduced"]),
      choice("Peripheral Edema", AP),
    ],
  },
  {
    key: "local", title: "Local Examination",
    build: () => [
      text("Site", { placeholder: "Enter site…" }),
      text("Inspection", { placeholder: "Enter findings…" }),
      text("Palpation", { placeholder: "Enter findings…" }),
      text("Local Findings", { placeholder: "Enter findings…" }),
    ],
  },
];

export const makeSystem = (key: string): ConsultationSystem | null => {
  const t = SYSTEM_TEMPLATES.find((s) => s.key === key);
  return t ? { key: t.key, title: t.title, fields: t.build() } : null;
};

export const customSystem = (title: string): ConsultationSystem => ({ key: `custom-${newFieldId()}`, title, fields: [text("Findings", { placeholder: "Enter findings…" })] });

export const defaultGeneral = (): ConsultationField[] => [
  choice("Consciousness", ["Conscious", "Drowsy", "Unconscious"]),
  choice("Cyanosis", AP),
  choice("Pallor", AP),
  choice("Icterus", AP),
  choice("Edema", AP),
  choice("Clubbing", AP),
];

export const INVESTIGATION_GROUPS: { title: string; tests: string[] }[] = [
  { title: "Blood tests", tests: ["CBC", "LFT", "KFT", "HbA1c", "Fasting Blood Sugar", "PP Blood Sugar", "Lipid Profile", "Thyroid Profile (TSH)", "Vitamin D", "Vitamin B12", "CRP", "ESR", "Electrolytes", "Dengue NS1", "Malaria Test", "Widal"] },
  { title: "Urine & stool", tests: ["Urine Routine", "Urine Culture", "Stool Routine"] },
  { title: "Imaging", tests: ["Chest X-Ray", "X-Ray (other)", "USG Abdomen", "USG Pelvis", "CT Scan", "MRI", "Mammography"] },
  { title: "Heart", tests: ["ECG", "2D Echo", "TMT"] },
];
export const INVESTIGATION_OPTIONS = INVESTIGATION_GROUPS.flatMap((g) => g.tests);

export const emptyConsultation = (): Consultation => ({
  chiefComplaint: "",
  history: { past: "", family: "", personal: "", medical: "" },
  patientHistory: [],
  vitals: { bp: "", pulse: "", temp: "", spo2: "", weight: "", height: "", source: "" },
  general: defaultGeneral(),
  systemic: [],
  investigations: [],
  secondaryDiagnosis: "",
  followUp: "",
  advice: { diet: "", exercise: "", other: "" },
  remarks: "",
});

export const bmiOf = (weightKg: string, heightCm: string): string => {
  const w = Number(weightKg), h = Number(heightCm) / 100;
  return w > 0 && h > 0 ? (w / (h * h)).toFixed(1) : "";
};

/** Fields the doctor actually filled in — what gets printed. */
export const filledFields = (fields: ConsultationField[]) => fields.filter((f) => f.value.trim());
