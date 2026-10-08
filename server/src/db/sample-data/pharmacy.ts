import { type PharmacyItem } from "@shared/types";

export const pharmacyItems: PharmacyItem[] = [
  { id: 1,  name: "Paracetamol 500mg",     category: "Analgesic",     stock: 2400, minStock: 500,  expiryDate: "Mar 2027", supplier: "MedPharma Ltd.",    status: "In Stock"    },
  { id: 2,  name: "Metformin 500mg",       category: "Antidiabetic",  stock: 180,  minStock: 200,  expiryDate: "Jun 2026", supplier: "HealthPlus Corp.",   status: "Low Stock"   },
  { id: 3,  name: "Amlodipine 5mg",        category: "Antihypertensive", stock: 620, minStock: 300, expiryDate: "Jan 2027", supplier: "Pharma India Pvt.", status: "In Stock"    },
  { id: 4,  name: "Pantoprazole 40mg",     category: "PPI",           stock: 0,    minStock: 150,  expiryDate: "Sep 2026", supplier: "MedPharma Ltd.",    status: "Out of Stock"},
  { id: 5,  name: "Cetirizine 10mg",       category: "Antihistamine", stock: 850,  minStock: 200,  expiryDate: "Dec 2026", supplier: "BioWell Pharma",    status: "In Stock"    },
  { id: 6,  name: "Amoxicillin 500mg",     category: "Antibiotic",    stock: 95,   minStock: 300,  expiryDate: "Feb 2026", supplier: "HealthPlus Corp.",   status: "Low Stock"   },
  { id: 7,  name: "Atorvastatin 20mg",     category: "Statin",        stock: 440,  minStock: 200,  expiryDate: "Nov 2026", supplier: "Pharma India Pvt.", status: "In Stock"    },
  { id: 8,  name: "Salbutamol Inhaler",    category: "Bronchodilator",stock: 60,   minStock: 80,   expiryDate: "Oct 2025", supplier: "BioWell Pharma",    status: "Expired"     },
  { id: 9,  name: "Levothyroxine 50mcg",   category: "Thyroid",       stock: 310,  minStock: 150,  expiryDate: "Jul 2027", supplier: "MedPharma Ltd.",    status: "In Stock"    },
  { id: 10, name: "Ondansetron 4mg",       category: "Antiemetic",    stock: 125,  minStock: 100,  expiryDate: "Apr 2026", supplier: "HealthPlus Corp.",   status: "In Stock"    },
  { id: 11, name: "Ibuprofen 400mg",       category: "NSAID",         stock: 0,    minStock: 200,  expiryDate: "May 2027", supplier: "Pharma India Pvt.", status: "Out of Stock"},
  { id: 12, name: "Azithromycin 500mg",    category: "Antibiotic",    stock: 70,   minStock: 100,  expiryDate: "Aug 2026", supplier: "BioWell Pharma",    status: "Low Stock"   },
];
