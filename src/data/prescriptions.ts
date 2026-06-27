import { type Prescription } from "@/types";

export const prescriptions: Prescription[] = [
  { id: 1,  rxNumber: "RX-20251101", patientName: "Olivia Turner",   patientAge: 28, doctor: "Dr. Ethan Miller",   diagnosis: "Vertigo (Benign Positional)",  medicineCount: 3, date: "8 Nov 2025",  status: "Dispensed" },
  { id: 2,  rxNumber: "RX-20251102", patientName: "Ethan Miller",    patientAge: 18, doctor: "Dr. Sophia Adams",   diagnosis: "Routine Wellness Check",       medicineCount: 1, date: "8 Nov 2025",  status: "Pending"   },
  { id: 3,  rxNumber: "RX-20251103", patientName: "Sophia Adams",    patientAge: 10, doctor: "Dr. Emily Cooper",   diagnosis: "Viral Fever",                  medicineCount: 4, date: "9 Nov 2025",  status: "Dispensed" },
  { id: 4,  rxNumber: "RX-20251104", patientName: "Noah Carter",     patientAge: 65, doctor: "Dr. Daniel Reed",    diagnosis: "Type 2 Diabetes",              medicineCount: 5, date: "13 Nov 2025", status: "Dispensed" },
  { id: 5,  rxNumber: "RX-20251105", patientName: "Ava Johnson",     patientAge: 36, doctor: "Dr. Olivia Turner",  diagnosis: "Fibromyalgia",                 medicineCount: 3, date: "12 Nov 2025", status: "Pending"   },
  { id: 6,  rxNumber: "RX-20251106", patientName: "Grace Mitchell",  patientAge: 35, doctor: "Dr. Ava Johnson",    diagnosis: "Irritable Bowel Syndrome",     medicineCount: 4, date: "17 Nov 2025", status: "Dispensed" },
  { id: 7,  rxNumber: "RX-20251107", patientName: "Isabella Reed",   patientAge: 45, doctor: "Dr. Daniel Reed",    diagnosis: "Hypertension Stage 1",         medicineCount: 2, date: "22 Nov 2025", status: "Pending"   },
  { id: 8,  rxNumber: "RX-20251108", patientName: "William Scott",   patientAge: 55, doctor: "Dr. Emily Cooper",   diagnosis: "Lumbar Spondylosis",           medicineCount: 3, date: "8 Nov 2025",  status: "Dispensed" },
  { id: 9,  rxNumber: "RX-20251109", patientName: "Priya Sharma",    patientAge: 40, doctor: "Dr. Daniel Reed",    diagnosis: "Hypothyroidism",               medicineCount: 1, date: "9 Nov 2025",  status: "Draft"     },
  { id: 10, rxNumber: "RX-20251110", patientName: "Karan Joshi",     patientAge: 38, doctor: "Dr. Sophia Adams",   diagnosis: "Allergic Rhinitis",            medicineCount: 3, date: "8 Nov 2025",  status: "Dispensed" },
];
