export interface Icd10Code {
  code: string;
  description: string;
  category: string;
}

export const icd10Codes: Icd10Code[] = [
  { code: "J00",   description: "Acute nasopharyngitis (common cold)",              category: "Respiratory" },
  { code: "J06.9", description: "Acute upper respiratory infection, unspecified",   category: "Respiratory" },
  { code: "J18.9", description: "Pneumonia, unspecified organism",                  category: "Respiratory" },
  { code: "J45.9", description: "Asthma, unspecified",                              category: "Respiratory" },
  { code: "R50.9", description: "Fever, unspecified",                               category: "Symptoms" },
  { code: "R05",   description: "Cough",                                            category: "Symptoms" },
  { code: "R51",   description: "Headache",                                         category: "Symptoms" },
  { code: "R10.4", description: "Other and unspecified abdominal pain",             category: "Symptoms" },
  { code: "R42",   description: "Dizziness and giddiness",                          category: "Symptoms" },
  { code: "R53",   description: "Malaise and fatigue",                              category: "Symptoms" },
  { code: "E11.9", description: "Type 2 diabetes mellitus without complications",   category: "Endocrine" },
  { code: "E11.6", description: "Type 2 diabetes mellitus with other complications",category: "Endocrine" },
  { code: "E03.9", description: "Hypothyroidism, unspecified",                      category: "Endocrine" },
  { code: "E05.9", description: "Thyrotoxicosis, unspecified",                      category: "Endocrine" },
  { code: "I10",   description: "Essential (primary) hypertension",                 category: "Cardiovascular" },
  { code: "I25.1", description: "Atherosclerotic heart disease of native coronary artery", category: "Cardiovascular" },
  { code: "I50.9", description: "Heart failure, unspecified",                       category: "Cardiovascular" },
  { code: "I21.9", description: "Acute myocardial infarction, unspecified",         category: "Cardiovascular" },
  { code: "K21.0", description: "Gastro-oesophageal reflux disease with oesophagitis", category: "Gastrointestinal" },
  { code: "K29.7", description: "Gastritis, unspecified",                           category: "Gastrointestinal" },
  { code: "K58.9", description: "Irritable bowel syndrome without diarrhoea",       category: "Gastrointestinal" },
  { code: "K80.2", description: "Calculus of gallbladder without cholecystitis",    category: "Gastrointestinal" },
  { code: "M54.5", description: "Low back pain",                                    category: "Musculoskeletal" },
  { code: "M54.2", description: "Cervicalgia",                                      category: "Musculoskeletal" },
  { code: "M17.1", description: "Primary osteoarthritis of knee",                   category: "Musculoskeletal" },
  { code: "G43.9", description: "Migraine, unspecified",                            category: "Neurological" },
  { code: "G40.9", description: "Epilepsy, unspecified",                            category: "Neurological" },
  { code: "F32.9", description: "Major depressive disorder, single episode, unspecified", category: "Mental Health" },
  { code: "F41.1", description: "Generalized anxiety disorder",                     category: "Mental Health" },
  { code: "L30.9", description: "Dermatitis, unspecified",                          category: "Dermatology" },
];
