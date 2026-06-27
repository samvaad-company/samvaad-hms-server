export interface Medicine {
  id: number;
  name: string;
  generic: string;
  category: string;
  defaultDosage: string;
  defaultFrequency: string;
  defaultDuration: string;
  unit: string;
}

export const medicines: Medicine[] = [
  { id: 1,  name: "Paracetamol 500mg",     generic: "Acetaminophen",     category: "Analgesic",        defaultDosage: "500mg",  defaultFrequency: "TDS",   defaultDuration: "5 days",  unit: "Tablet" },
  { id: 2,  name: "Ibuprofen 400mg",        generic: "Ibuprofen",         category: "NSAID",            defaultDosage: "400mg",  defaultFrequency: "BD",    defaultDuration: "3 days",  unit: "Tablet" },
  { id: 3,  name: "Amoxicillin 500mg",      generic: "Amoxicillin",       category: "Antibiotic",       defaultDosage: "500mg",  defaultFrequency: "TDS",   defaultDuration: "7 days",  unit: "Capsule" },
  { id: 4,  name: "Azithromycin 500mg",     generic: "Azithromycin",      category: "Antibiotic",       defaultDosage: "500mg",  defaultFrequency: "OD",    defaultDuration: "5 days",  unit: "Tablet" },
  { id: 5,  name: "Cetirizine 10mg",        generic: "Cetirizine",        category: "Antihistamine",    defaultDosage: "10mg",   defaultFrequency: "OD",    defaultDuration: "5 days",  unit: "Tablet" },
  { id: 6,  name: "Metformin 500mg",        generic: "Metformin",         category: "Antidiabetic",     defaultDosage: "500mg",  defaultFrequency: "BD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 7,  name: "Metformin 1000mg",       generic: "Metformin",         category: "Antidiabetic",     defaultDosage: "1000mg", defaultFrequency: "BD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 8,  name: "Amlodipine 5mg",         generic: "Amlodipine",        category: "Antihypertensive", defaultDosage: "5mg",    defaultFrequency: "OD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 9,  name: "Amlodipine 10mg",        generic: "Amlodipine",        category: "Antihypertensive", defaultDosage: "10mg",   defaultFrequency: "OD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 10, name: "Telmisartan 40mg",       generic: "Telmisartan",       category: "Antihypertensive", defaultDosage: "40mg",   defaultFrequency: "OD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 11, name: "Atorvastatin 10mg",      generic: "Atorvastatin",      category: "Statin",           defaultDosage: "10mg",   defaultFrequency: "OD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 12, name: "Atorvastatin 20mg",      generic: "Atorvastatin",      category: "Statin",           defaultDosage: "20mg",   defaultFrequency: "OD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 13, name: "Pantoprazole 40mg",      generic: "Pantoprazole",      category: "PPI",              defaultDosage: "40mg",   defaultFrequency: "OD",    defaultDuration: "14 days", unit: "Tablet" },
  { id: 14, name: "Omeprazole 20mg",        generic: "Omeprazole",        category: "PPI",              defaultDosage: "20mg",   defaultFrequency: "BD",    defaultDuration: "14 days", unit: "Capsule" },
  { id: 15, name: "Ondansetron 4mg",        generic: "Ondansetron",       category: "Antiemetic",       defaultDosage: "4mg",    defaultFrequency: "TDS",   defaultDuration: "3 days",  unit: "Tablet" },
  { id: 16, name: "Domperidone 10mg",       generic: "Domperidone",       category: "Antiemetic",       defaultDosage: "10mg",   defaultFrequency: "TDS",   defaultDuration: "5 days",  unit: "Tablet" },
  { id: 17, name: "Levothyroxine 50mcg",    generic: "Levothyroxine",     category: "Thyroid",          defaultDosage: "50mcg",  defaultFrequency: "OD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 18, name: "Levothyroxine 100mcg",   generic: "Levothyroxine",     category: "Thyroid",          defaultDosage: "100mcg", defaultFrequency: "OD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 19, name: "Salbutamol Inhaler",     generic: "Salbutamol",        category: "Bronchodilator",   defaultDosage: "2 puffs",defaultFrequency: "PRN",   defaultDuration: "30 days", unit: "Inhaler" },
  { id: 20, name: "Montelukast 10mg",       generic: "Montelukast",       category: "Anti-asthmatic",   defaultDosage: "10mg",   defaultFrequency: "OD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 21, name: "Clobetasol Cream",       generic: "Clobetasol",        category: "Topical Steroid",  defaultDosage: "Apply",  defaultFrequency: "BD",    defaultDuration: "7 days",  unit: "Tube" },
  { id: 22, name: "Clindamycin Gel 1%",     generic: "Clindamycin",       category: "Topical Antibiotic",defaultDosage: "Apply", defaultFrequency: "BD",    defaultDuration: "30 days", unit: "Tube" },
  { id: 23, name: "Calamine Lotion",        generic: "Calamine",          category: "Topical",          defaultDosage: "Apply",  defaultFrequency: "TDS",   defaultDuration: "7 days",  unit: "Bottle" },
  { id: 24, name: "Dextromethorphan Syrup", generic: "Dextromethorphan",  category: "Cough Suppressant",defaultDosage: "10ml",   defaultFrequency: "TDS",   defaultDuration: "5 days",  unit: "Syrup" },
  { id: 25, name: "Ambroxol Syrup",         generic: "Ambroxol",          category: "Expectorant",      defaultDosage: "10ml",   defaultFrequency: "TDS",   defaultDuration: "5 days",  unit: "Syrup" },
  { id: 26, name: "Prednisolone 5mg",       generic: "Prednisolone",      category: "Corticosteroid",   defaultDosage: "5mg",    defaultFrequency: "OD",    defaultDuration: "5 days",  unit: "Tablet" },
  { id: 27, name: "Methylprednisolone 8mg", generic: "Methylprednisolone",category: "Corticosteroid",   defaultDosage: "8mg",    defaultFrequency: "OD",    defaultDuration: "5 days",  unit: "Tablet" },
  { id: 28, name: "Glibenclamide 5mg",      generic: "Glibenclamide",     category: "Antidiabetic",     defaultDosage: "5mg",    defaultFrequency: "BD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 29, name: "Sitagliptin 100mg",      generic: "Sitagliptin",       category: "Antidiabetic",     defaultDosage: "100mg",  defaultFrequency: "OD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 30, name: "Aspirin 75mg",           generic: "Aspirin",           category: "Antiplatelet",     defaultDosage: "75mg",   defaultFrequency: "OD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 31, name: "Clopidogrel 75mg",       generic: "Clopidogrel",       category: "Antiplatelet",     defaultDosage: "75mg",   defaultFrequency: "OD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 32, name: "Enalapril 5mg",          generic: "Enalapril",         category: "ACE Inhibitor",    defaultDosage: "5mg",    defaultFrequency: "BD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 33, name: "Losartan 50mg",          generic: "Losartan",          category: "ARB",              defaultDosage: "50mg",   defaultFrequency: "OD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 34, name: "Furosemide 40mg",        generic: "Furosemide",        category: "Diuretic",         defaultDosage: "40mg",   defaultFrequency: "OD",    defaultDuration: "7 days",  unit: "Tablet" },
  { id: 35, name: "Spironolactone 25mg",    generic: "Spironolactone",    category: "Diuretic",         defaultDosage: "25mg",   defaultFrequency: "OD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 36, name: "Diclofenac 50mg",        generic: "Diclofenac",        category: "NSAID",            defaultDosage: "50mg",   defaultFrequency: "BD",    defaultDuration: "5 days",  unit: "Tablet" },
  { id: 37, name: "Pregabalin 75mg",        generic: "Pregabalin",        category: "Neuropathic",      defaultDosage: "75mg",   defaultFrequency: "BD",    defaultDuration: "30 days", unit: "Capsule" },
  { id: 38, name: "Gabapentin 300mg",       generic: "Gabapentin",        category: "Neuropathic",      defaultDosage: "300mg",  defaultFrequency: "TDS",   defaultDuration: "30 days", unit: "Capsule" },
  { id: 39, name: "Fluoxetine 20mg",        generic: "Fluoxetine",        category: "Antidepressant",   defaultDosage: "20mg",   defaultFrequency: "OD",    defaultDuration: "30 days", unit: "Capsule" },
  { id: 40, name: "Clonazepam 0.5mg",       generic: "Clonazepam",        category: "Anxiolytic",       defaultDosage: "0.5mg",  defaultFrequency: "BD",    defaultDuration: "14 days", unit: "Tablet" },
  { id: 41, name: "Metronidazole 400mg",    generic: "Metronidazole",     category: "Antibiotic",       defaultDosage: "400mg",  defaultFrequency: "TDS",   defaultDuration: "7 days",  unit: "Tablet" },
  { id: 42, name: "Ciprofloxacin 500mg",    generic: "Ciprofloxacin",     category: "Antibiotic",       defaultDosage: "500mg",  defaultFrequency: "BD",    defaultDuration: "7 days",  unit: "Tablet" },
  { id: 43, name: "Doxycycline 100mg",      generic: "Doxycycline",       category: "Antibiotic",       defaultDosage: "100mg",  defaultFrequency: "BD",    defaultDuration: "7 days",  unit: "Capsule" },
  { id: 44, name: "Ranitidine 150mg",       generic: "Ranitidine",        category: "H2 Blocker",       defaultDosage: "150mg",  defaultFrequency: "BD",    defaultDuration: "14 days", unit: "Tablet" },
  { id: 45, name: "Loperamide 2mg",         generic: "Loperamide",        category: "Antidiarrheal",    defaultDosage: "2mg",    defaultFrequency: "PRN",   defaultDuration: "3 days",  unit: "Tablet" },
  { id: 46, name: "ORS Sachet",             generic: "Oral Rehydration",  category: "Rehydration",      defaultDosage: "1 sachet",defaultFrequency: "TDS",  defaultDuration: "3 days",  unit: "Sachet" },
  { id: 47, name: "Vitamin D3 60000 IU",    generic: "Cholecalciferol",   category: "Vitamin",          defaultDosage: "60000 IU",defaultFrequency: "Weekly",defaultDuration: "8 weeks", unit: "Capsule" },
  { id: 48, name: "Vitamin B12 1500mcg",    generic: "Cyanocobalamin",    category: "Vitamin",          defaultDosage: "1500mcg",defaultFrequency: "OD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 49, name: "Calcium + Vit D3",       generic: "Calcium Carbonate", category: "Supplement",       defaultDosage: "500mg",  defaultFrequency: "BD",    defaultDuration: "30 days", unit: "Tablet" },
  { id: 50, name: "Iron + Folic Acid",      generic: "Ferrous Sulfate",   category: "Supplement",       defaultDosage: "1 tab",  defaultFrequency: "OD",    defaultDuration: "30 days", unit: "Tablet" },
];

export const prescriptionTemplates = {
  fever: [
    { medicineId: 1, dosage: "500mg", frequency: "TDS", duration: "5 days", instructions: "After food" },
    { medicineId: 5, dosage: "10mg",  frequency: "OD",  duration: "5 days", instructions: "At night" },
    { medicineId: 25, dosage: "10ml", frequency: "TDS", duration: "5 days", instructions: "After food" },
  ],
  diabetes: [
    { medicineId: 6, dosage: "500mg", frequency: "BD", duration: "30 days", instructions: "With meals" },
    { medicineId: 49, dosage: "500mg", frequency: "BD", duration: "30 days", instructions: "After food" },
    { medicineId: 30, dosage: "75mg",  frequency: "OD", duration: "30 days", instructions: "After breakfast" },
  ],
  hypertension: [
    { medicineId: 8,  dosage: "5mg",  frequency: "OD", duration: "30 days", instructions: "Morning" },
    { medicineId: 10, dosage: "40mg", frequency: "OD", duration: "30 days", instructions: "Morning" },
    { medicineId: 12, dosage: "20mg", frequency: "OD", duration: "30 days", instructions: "At night" },
  ],
  cold: [
    { medicineId: 1,  dosage: "500mg", frequency: "TDS", duration: "5 days", instructions: "After food" },
    { medicineId: 5,  dosage: "10mg",  frequency: "OD",  duration: "5 days", instructions: "At night" },
    { medicineId: 24, dosage: "10ml",  frequency: "TDS", duration: "5 days", instructions: "After food" },
  ],
  acidity: [
    { medicineId: 13, dosage: "40mg", frequency: "OD", duration: "14 days", instructions: "Before breakfast" },
    { medicineId: 16, dosage: "10mg", frequency: "TDS",duration: "5 days",  instructions: "Before meals" },
  ],
};
