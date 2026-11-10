/**
 * The forms of an IPD case file, described as data: the on-screen editor and the printed page are both drawn from these, so what staff
 * fill in is exactly what prints. They follow the hospital's own sheets, in the order the file is kept.
 *
 * A form is a list of blocks (headings, labelled fields, ruled lines, tables, grids). A form is kept as:
 *   scope "single"  one record;
 *   scope "date"    one record per day (treatment sheet, I/O chart, handover);
 *   scope "sheet"   numbered sheets, add another when one is full (investigation sheet).
 */
import type { CaseFormKey } from "@/types/casefile";

export type FieldType = "text" | "date" | "time" | "number" | "yesno" | "check" | "choice";
export interface Field { k: string; label: string; type?: FieldType; options?: string[]; /** columns to span in a fields block */ span?: number }

export interface StackLine { k: string; label: string; suffix?: string }
export interface Col {
  k: string;
  label: string;
  /** Relative width. */
  w: number;
  type?: "text" | "date" | "time" | "textarea" | "yesno";
  /** A cell made of several labelled lines (the progress note's S/B DR, condition, TPR…). */
  stack?: StackLine[];
  center?: boolean;
}

export type Block =
  | { t: "title"; text: string }
  | { t: "heading"; text: string }
  | { t: "note"; text: string }
  | { t: "patient"; items: ("name" | "age" | "sex" | "ipd" | "uhid" | "bed" | "doctor" | "diet")[] }
  | { t: "fields"; cols: number; items: Field[] }
  | { t: "lines"; k: string; label?: string; n: number }
  | {
      t: "table";
      k: string;
      cols: Col[];
      /** Rows on one printed page. */
      rows: number;
      /** What the rest of the app supplies for this table: see link.ts. */
      linked?: string;
      /** Rows a new form starts with. */
      defaults?: Record<string, string>[];
      /** Row height in px when printed. */
      rowH?: number;
      addLabel?: string;
    }
  | { t: "grid"; k: string; rows: { k: string; label: string; group?: string; input?: "date" | "time" }[]; cols: { k: string; label?: string }[]; rowH?: number; linked?: string; labelW?: number }
  | { t: "linkedlist"; linked: string; title: string };

export interface FormDef {
  key: CaseFormKey;
  /** The name staff know the sheet by. */
  title: string;
  /** Shown on the printed page. */
  heading: string;
  scope: "single" | "date" | "sheet";
  /** Tighter spacing for sheets with a lot on one page: the value is the height of a ruled line in px. */
  lineH?: number;
  /** Where what is already known about the patient comes from, in plain words. */
  linkedNote?: string;
  blocks: Block[];
}

const lines = (k: string, n: number, label?: string): Block => ({ t: "lines", k, n, label });
const yn = (k: string, label: string): Field => ({ k, label, type: "yesno" });
const txt = (k: string, label: string, span?: number): Field => ({ k, label, span });

export const FORMS: FormDef[] = [
  {
    key: "admission_history",
    title: "Admission history & initial assessment",
    heading: "ADMISSION HISTORY AND INITIAL PHYSICAL ASSESSMENT",
    scope: "single",
    lineH: 23,
    linkedNote: "Allergies recorded for the patient are shown here until written in.",
    blocks: [
      { t: "title", text: "ADMISSION HISTORY AND INITIAL PHYSICAL ASSESSMENT" },
      { t: "patient", items: ["name", "ipd", "uhid", "age", "sex"] },
      { t: "fields", cols: 1, items: [txt("hoName", "Name of HO / Registrar taking History :")] },
      { t: "fields", cols: 2, items: [{ k: "allergy", label: "Allergies :", type: "choice", options: ["None", "Yes"] }, txt("allergyNote", "(if Yes, describe)  Drugs / Food / Latex / Dyes / Contrast / Other")] },
      {
        t: "table", k: "allergies", rows: 3, rowH: 30, addLabel: "Add an allergy",
        cols: [{ k: "what", label: "Allergen", w: 60 }, { k: "reaction", label: "Reaction", w: 40 }],
      },
      lines("complaints", 16, "Chief Complaints with Origin, Duration and Progress :"),
      lines("tests", 12, "Signification Tests done (Laboratory Reports) :"),
    ],
  },
  {
    key: "past_history",
    title: "Past, family & personal history",
    heading: "PAST HISTORY",
    scope: "single",
    lineH: 20,
    linkedNote: "Allergies and long-term conditions already recorded for the patient are shown at the top.",
    blocks: [
      { t: "heading", text: "Past History :" },
      {
        t: "fields", cols: 2, items: [
          txt("htn1", "If Hypertension, On Medication  Since 1)"), txt("dm1", "If Diabetes, On Medication  Since 1)"), txt("htn2", "2)"), txt("dm2", "2)"), txt("htn3", "3)"), txt("dm3", "3)"),
          txt("ihd1", "If Ischaemic Heart Disease since / On Medication  1)"), txt("dmDr", "Under Treatment of Dr."), txt("ihd2", "2)"), txt("tb", "If Tuberculosis, When"), txt("ihd3", "3)"), txt("otherPh", "Any Other P/H"),
          txt("ihdDr", "Under Treatment of Dr."), txt("otherMed", "Any Other Medication"), txt("intervention", "Any Intervention Done"), txt("hospDiag", "P/H of Hospitalization  Diagnosis :"),
          txt("opDiag", "P/H of Operation  Diagnosis :"), txt("hospYear", "Year :"), txt("opName", "Name of Operation :"), txt("hospDuration", "Duration :"), txt("opYear", "Year of Operation :"), txt("pastOthers", "Others"),
        ],
      },
      { t: "heading", text: "Family History : (Specify : F-Father, M-Mother, B-Brother, S-Sister)  (Pl. Circle whichever is applicable e.g. If Father has h/o 10 yrs. then, Yes / No  F/10 Yrs)" },
      {
        t: "fields", cols: 2, items: [
          yn("fhHtn", "Hypertension"), yn("fhAsthma", "Asthma"), yn("fhHeart", "Heart Disease"), yn("fhStroke", "Stroke"), yn("fhDm", "Diabetes"), yn("fhArthritis", "Arthritis / Gout"),
          yn("fhTb", "Tuberculosis"), yn("fhCancer", "Cancer"), yn("fhEpilepsy", "Epilepsy"), yn("fhChronic", "Other Chronic Disease"), txt("fhDetail", "Details (who, how long)", 2),
        ],
      },
      { t: "heading", text: "Personal History :" },
      {
        t: "fields", cols: 2, items: [
          txt("diet", "Diet"), yn("smoking", "Smoking"), txt("appetite", "Appetite"), txt("smokingSince", "Since / per day"), txt("sleep", "Sleep"), yn("alcohol", "Alcohol"), txt("micturition", "Micturition"), txt("alcoholSince", "Since / (Freq.)"),
          txt("bowel", "Bowel Habits"), yn("drugs", "Drugs"), txt("otherHabit", "Any Other Habit"), txt("drugsSince", "Since / (Freq.)"), yn("tobacco", "Tobacco"), txt("tobaccoSince", "Since / (Freq.)"),
        ],
      },
      { t: "heading", text: "For Females :" },
      { t: "fields", cols: 2, items: [{ k: "lmp", label: "Menstrual History : L.M.P. Date", type: "date" }, { k: "cycle", label: "Regular / Irregular", type: "choice", options: ["Regular", "Irregular"] }, txt("obstetric", "Obstetric History : L.D."), txt("abortion", "Abortion"), txt("femOthers", "Others")] },
      { t: "heading", text: "Declaration by the Informant : (Patient / Relative / Accompanying Person) - I hereby declare that the facts recorded above are based on my narration and are accurate to the best of my knowledge." },
      { t: "fields", cols: 2, items: [txt("informant", "Name of Informant (Patient / Relative / Accompanying Person)"), txt("relationship", "Relationship with Patient"), txt("informantSign", "Signature"), { k: "informantDate", label: "Date :", type: "date" }] },
    ],
  },
  {
    key: "physical_exam",
    title: "Physical examination",
    heading: "PHYSICAL EXAMINATION",
    scope: "single",
    lineH: 20,
    blocks: [
      { t: "heading", text: "Physical Examination :" },
      { t: "heading", text: "Vital Signs :" },
      { t: "fields", cols: 4, items: [txt("temp", "Temp : (F)"), txt("pulse", "Pulse : (/min)"), txt("rr", "R/R : (/min)"), txt("bp", "B.P. : (mm Hg)"), txt("pain", "Pain Score : (on Visual Analogue Scale)", 2)] },
      { t: "heading", text: "General Examination :" },
      { t: "fields", cols: 5, items: [{ k: "anemia", label: "Anemia", type: "check" }, { k: "cyanosis", label: "Cyanosis", type: "check" }, { k: "jaundice", label: "Jaundice", type: "check" }, { k: "lymph", label: "Generalized Lymphadenopathy", type: "check" }, { k: "oedema", label: "Pedal Oedema", type: "check" }] },
      lines("generalExam", 5, "General Examination : Head / Eyes / Ears / Nose / Throat / Neck"),
      { t: "heading", text: "Systemic Examination :" },
      lines("resp", 3, "Respiratory System"), lines("abdomen", 3, "Abdomen"), lines("cvs", 3, "Cardiovascular System"), lines("cns", 3, "Central Nervous System"),
      lines("msk", 3, "Musculoskeletal System"), lines("lymphatics", 3, "Lymphatics"), lines("extremities", 3, "Extremities / Spine"), lines("skin", 3, "Skin"), lines("local", 2, "Local Examination"),
    ],
  },
  {
    key: "diagnosis_plan",
    title: "Diagnosis & plan of care",
    heading: "PROVISIONAL DIAGNOSIS",
    scope: "single",
    linkedNote: "The diagnosis entered at admission is shown if this is still blank.",
    blocks: [
      lines("diagnosis", 3, "Provisional Diagnosis :"),
      lines("plan", 4, "Plan of Care during Hospitalization :"),
      lines("preventive", 4, "Preventive Aspect :"),
      { t: "fields", cols: 2, items: [txt("hoSign", "Sign. of House Office / Registrar"), txt("consultantSign", "Sign. of Consultant"), txt("hoName", "Name of House Officer / Registrar"), txt("consultantName", "Name of Consultant"), { k: "hoDate", label: "Date", type: "date" }, { k: "consultantDate", label: "Date", type: "date" }, { k: "hoTime", label: "Time", type: "time" }, { k: "consultantTime", label: "Time", type: "time" }] },
    ],
  },
  {
    key: "doctor_notes",
    title: "Doctor notes",
    heading: "DOCTOR NOTES",
    scope: "single",
    linkedNote: "Doctor rounds recorded in the IPD section appear here.",
    blocks: [
      { t: "title", text: "DOCTOR NOTES" },
      { t: "patient", items: ["name", "ipd", "uhid", "age", "sex"] },
      {
        t: "table", k: "rows", rows: 7, rowH: 118, linked: "doctorRounds", addLabel: "Add a note",
        cols: [{ k: "date", label: "Date", w: 11, type: "date" }, { k: "note", label: "Doctor's Note", w: 49, type: "textarea" }, { k: "treatment", label: "Treatment", w: 22, type: "textarea" }, { k: "lab", label: "Lab", w: 18, type: "textarea" }],
      },
    ],
  },
  {
    key: "progress_note",
    title: "Progress note",
    heading: "PROGRESS NOTE",
    scope: "single",
    linkedNote: "Daily nursing notes written in the IPD section appear here.",
    blocks: [
      { t: "title", text: "PROGRESS NOTE" },
      { t: "patient", items: ["name", "ipd", "bed"] },
      {
        t: "table", k: "rows", rows: 3, rowH: 250, linked: "dailyNotes", addLabel: "Add a note",
        cols: [
          { k: "mo", label: "Date, Time & Name of MO", w: 26, stack: [{ k: "date", label: "Date" }, { k: "time", label: "Time" }, { k: "mo", label: "MO" }] },
          {
            k: "note", label: "Progress Note", w: 54,
            stack: [{ k: "sbDr", label: "S/B DR" }, { k: "condition", label: "Pt's Condition" }, { k: "tpr", label: "TPR -" }, { k: "bp", label: "BP -" }, { k: "spo2", label: "SPO2 -", suffix: "%" }, { k: "seRs", label: "S/E - RS -" }, { k: "cvs", label: "CVS -" }, { k: "pa", label: "P/A -" }, { k: "other", label: "Other -" }],
          },
          { k: "remarks", label: "Remarks", w: 20, type: "textarea" },
        ],
      },
    ],
  },
  {
    key: "treatment_sheet",
    title: "Daily treatment sheet",
    heading: "DAILY TREATMENT SHEET",
    scope: "date",
    linkedNote: "Medicines ordered in the IPD section (with the doses nurses have given) and the patient's prescriptions appear here for each day.",
    blocks: [
      { t: "title", text: "DAILY TREATMENT SHEET" },
      { t: "patient", items: ["name", "ipd", "uhid", "age", "sex", "diet"] },
      { t: "fields", cols: 2, items: [{ k: "postOpDay", label: "Post Opp. Day" }] },
      {
        t: "table", k: "inj", rows: 9, rowH: 30, linked: "medsInjection", addLabel: "Add injection / infusion",
        cols: [
          { k: "medication", label: "Injections / Infusions", w: 34 }, { k: "dose", label: "Dose", w: 12 }, { k: "route", label: "Route", w: 10 },
          { k: "s1", label: "8am to 2pm", w: 11, center: true }, { k: "s2", label: "2pm to 8pm", w: 11, center: true }, { k: "s3", label: "8pm to 2am", w: 11, center: true }, { k: "s4", label: "2am to 8am", w: 11, center: true },
        ],
      },
      {
        t: "table", k: "oral", rows: 9, rowH: 30, linked: "medsOral", addLabel: "Add tablet / capsule / liquid",
        cols: [
          { k: "medication", label: "Tab / Cap / Liq. / Inhalation", w: 34 }, { k: "dose", label: "Dose", w: 12 }, { k: "route", label: "Route", w: 10 },
          { k: "s1", label: "8am to 2pm", w: 11, center: true }, { k: "s2", label: "2pm to 8pm", w: 11, center: true }, { k: "s3", label: "8pm to 2am", w: 11, center: true }, { k: "s4", label: "2am to 8am", w: 11, center: true },
        ],
      },
      lines("planToday", 2, "Plan for Today / Ref :-"),
      lines("planTomorrow", 2, "Plan for Tomorrow"),
      { t: "fields", cols: 2, items: [txt("rmoSign", "Name, Sign of RMO  Date & Time"), txt("nurseSign", "Name, Sign of Nurse  Date & Time")] },
    ],
  },
  {
    key: "nursing_handover",
    title: "Nursing hand-over note",
    heading: "NURSING HAND - OVER NOTE",
    scope: "date",
    linkedNote: "Shift handover notes from the nurse station appear under Illness Description for their shift.",
    blocks: [
      { t: "title", text: "NURSING HAND - OVER NOTE" },
      { t: "patient", items: ["name", "ipd", "bed"] },
      { t: "heading", text: "Patient Summary" },
      {
        t: "grid", k: "grid", rowH: 118, labelW: 20, linked: "handoverShifts",
        rows: [{ k: "illness", label: "Illness Description" }, { k: "action", label: "Action List" }, { k: "sac", label: "Situation Awareness Contingency Planning" }, { k: "by", label: "Handing Over By" }, { k: "taken", label: "Handing Over Taken By" }],
        cols: [{ k: "night", label: "Night Shift (8 pm)" }, { k: "morning", label: "Morning Shift (8 am)" }, { k: "evening", label: "Evening Shift (2 pm)" }],
      },
      lines("verbal", 6, "Verbal Order (if any) :"),
      { t: "note", text: "(SHCH:014)" },
    ],
  },
  {
    key: "tpr_chart",
    title: "TPR - B.P. chart",
    heading: "TPR - B.P. CHART",
    scope: "single",
    linkedNote: "Vitals recorded in the nurse station appear here (temperature in °F).",
    blocks: [
      { t: "title", text: "TPR - B.P. CHART" },
      { t: "patient", items: ["name", "ipd", "bed"] },
      {
        t: "table", k: "rows", rows: 26, rowH: 31, linked: "vitals", addLabel: "Add a reading",
        cols: [
          { k: "date", label: "Date", w: 12, type: "date" }, { k: "time", label: "Time", w: 9, type: "time" }, { k: "temp", label: "Temp", w: 10 }, { k: "pulse", label: "Pulse", w: 9 }, { k: "rr", label: "R.R.", w: 8 },
          { k: "bp", label: "B.P.", w: 11 }, { k: "spo2", label: "SpO2", w: 9 }, { k: "remark", label: "Remark", w: 18 }, { k: "sign", label: "Sign", w: 14 },
        ],
      },
    ],
  },
  {
    key: "io_chart",
    title: "Input / output chart",
    heading: "INPUT / OUTPUT - CHART",
    scope: "date",
    linkedNote: "IV fluids started in the nurse station appear under IN TAKE IV for their day.",
    blocks: [
      { t: "title", text: "INPUT / OUTPUT - CHART" },
      { t: "patient", items: ["name", "ipd", "bed"] },
      {
        t: "table", k: "rows", rows: 20, rowH: 32, linked: "ivLines", addLabel: "Add a row",
        cols: [
          { k: "time", label: "Time", w: 8, type: "time" }, { k: "food", label: "Food", w: 11 }, { k: "ml", label: "ML", w: 7 }, { k: "rtAspi", label: "RT Aspi", w: 8 }, { k: "colour", label: "Colour", w: 9 },
          { k: "intakeIv", label: "IN TAKE IV", w: 17 }, { k: "uop", label: "UOP", w: 8 }, { k: "ag", label: "AG (CM)", w: 8 }, { k: "total", label: "Total In/Out", w: 11 }, { k: "others", label: "Others", w: 13 },
        ],
      },
      { t: "fields", cols: 2, items: [txt("inOutTotal", "IN OUT : TOTAL :"), txt("totalOut", "TOTAL OUT PUT :"), txt("rtFeeding", "RT FEEDING :"), txt("uopTotal", "UOP:"), txt("ivIn", "IV IN :"), txt("rtAspiTotal", "RT ASPI:")] },
    ],
  },
  {
    key: "investigation_sheet",
    title: "Investigation sheet",
    heading: "INVESTIGATION SHEET",
    scope: "sheet",
    linkedNote: "Lab tests ordered for this patient are listed under the sheet.",
    blocks: [
      { t: "title", text: "INVESTIGATION SHEET" },
      { t: "patient", items: ["name", "ipd", "bed", "age", "sex"] },
      {
        t: "grid", k: "grid", rowH: 21, labelW: 24,
        rows: [
          { k: "date", label: "Date", group: "", input: "date" }, { k: "time", label: "Time", group: "", input: "time" },
          ...["Hb", "PCV", "TC", "DC", "ESR", "M.P.", "Platelets", "PT / aPTT", "INR"].map((l) => ({ k: `h_${l}`, label: l, group: "HAEMATOLOGY" })),
          ...["Alb.", "SUG.", "Micro"].map((l) => ({ k: `u_${l}`, label: l, group: "URINE" })),
          ...["RBS", "FBS", "PP2BS"].map((l) => ({ k: `s_${l}`, label: l, group: "BLOOD SUGAR" })),
          ...["NA+", "K+", "Cl-", "HCO2-", "Urea", "Creatinine", "Osmolality", "Total Proteins"].map((l) => ({ k: `r_${l}`, label: l, group: "RENAL" })),
          ...["Albumin", "Globulin", "Total Bilirubin", "Direct Bilirubin", "SGOT / SGPT", "ALKPO2 / S.Amylase", "S. Lipase"].map((l) => ({ k: `p_${l}`, label: l, group: "HEPATIC" })),
          ...["HIV", "Hbs Ag", "", "Blood Group"].map((l, i) => ({ k: `o_${i}`, label: l, group: "OTHERS" })),
        ],
        cols: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ k: `c${n}` })),
      },
      { t: "fields", cols: 2, items: [txt("signRmo", "Signature of RMO"), txt("signStaff", "Signature of Staff")] },
      { t: "linkedlist", linked: "labTests", title: "Tests ordered from the Lab" },
    ],
  },
  {
    key: "room_charges",
    title: "Room charge list",
    heading: "ROOM CHARGE LIST",
    scope: "single",
    blocks: [
      { t: "title", text: "ROOM CHARGE LIST" },
      { t: "fields", cols: 3, items: [{ k: "admDate", label: "DATE ADMISSION:", type: "date" }, { k: "admTime", label: "ADMISSION TIME", type: "time" }, { k: "roomNo", label: "ROOM NO." }] },
      { t: "patient", items: ["name"] },
      {
        t: "table", k: "rates", rows: 9, rowH: 34, addLabel: "Add a room type",
        defaults: [
          { room: "ISOLATION ICU", charge: "4000", nursing: "1500", doctor: "1500 X 2" }, { room: "ICU", charge: "3500", nursing: "1000", doctor: "1000 x 2" },
          { room: "DELUX & HDU", charge: "3000", nursing: "800", doctor: "800 x 2" }, { room: "SPECIAL ROOM", charge: "2500", nursing: "700", doctor: "700 x 2" },
          { room: "SEMI SPECIAL ROOM", charge: "2000", nursing: "600", doctor: "600 x 2" }, { room: "ECONOMY & GENERAL WARD", charge: "1000", nursing: "500", doctor: "500 x 2" },
          { room: "OPD TREATMENT CHARGE", charge: "1000", nursing: "", doctor: "500" },
        ],
        cols: [{ k: "room", label: "ROOM DETAILS", w: 38 }, { k: "charge", label: "ROOM CHARGES", w: 20 }, { k: "nursing", label: "NURSING CHARGES", w: 20 }, { k: "doctor", label: "DOCTOR VISITING CHARGES", w: 22 }],
      },
      { t: "note", text: "1) I.P.D CHARGES WILL BE FROM 12 NOON TO 12 NOON.   2) I HAVE READ AND UNDERSTOOD THE ABOVE CHARGES DETAILS. I AM READY TO PAY THESE CHARGES ON TIME." },
      { t: "fields", cols: 1, items: [txt("relativeName", "PATIENT RELATIVE NAME:"), txt("relativeSign", "PATIENT RELATIVE SIGN:")] },
    ],
  },
  {
    key: "room_handover",
    title: "Room handover",
    heading: "ROOM HANDOVER",
    scope: "single",
    blocks: [
      { t: "title", text: "ROOM HANDOVER" },
      { t: "patient", items: ["name", "uhid", "bed"] },
      { t: "fields", cols: 2, items: [{ k: "admDate", label: "ADMISSION DATE / TIME :" }, { k: "roomNo", label: "ROOM NO :" }] },
      {
        t: "table", k: "items", rows: 5, rowH: 52, addLabel: "Add an item",
        defaults: [{ item: "T.V REMOTE" }, { item: "SET UP BOX REMOTE" }, { item: "A.C REMOTE" }, { item: "HAND WASH" }, { item: "MOSQUITO LIQUID" }],
        cols: [{ k: "item", label: "DETAILS", w: 28 }, { k: "taken", label: "TAKEN (YES OR NO) WRITE", w: 36, type: "yesno", center: true }, { k: "received", label: "RECEIVED (YES OR NO)", w: 36, type: "yesno", center: true }],
      },
      {
        t: "fields", cols: 1, items: [txt("relativeName", "PATIENT RELATIVE NAME :"), txt("relativeSign", "PATIENT RELATIVE SIGN :"), txt("staffName", "STAFF NAME"), txt("staffSign", "STAFF SIGN :"), { k: "date", label: "DATE :", type: "date" }, { k: "time", label: "TIME :", type: "time" }],
      },
    ],
  },
];

export const FORM_BY_KEY: Record<string, FormDef> = Object.fromEntries(FORMS.map((f) => [f.key, f]));
