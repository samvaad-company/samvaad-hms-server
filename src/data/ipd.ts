import { type IpdRecord } from "@/types";

export const ipdRecords: IpdRecord[] = [
  { id: 1, patientName: "Grace Mitchell",  patientAge: 35, patientId: "HMS-0007", admissionDate: "14 Nov 2025", ward: "General",   bed: "G-04", doctor: "Dr. Ava Johnson",    diagnosis: "Appendicitis (post-op)",    status: "Admitted"   },
  { id: 2, patientName: "Rajan Mehta",     patientAge: 62, patientId: "HMS-0011", admissionDate: "10 Nov 2025", ward: "Cardiology", bed: "C-02", doctor: "Dr. Noah Carter",    diagnosis: "Acute Myocardial Infarction",status: "ICU"       },
  { id: 3, patientName: "Suresh Kumar",    patientAge: 50, patientId: "HMS-0012", admissionDate: "8 Nov 2025",  ward: "General",   bed: "G-07", doctor: "Dr. Ethan Miller",   diagnosis: "Severe Pneumonia",          status: "Admitted"   },
  { id: 4, patientName: "Meena Reddy",     patientAge: 29, patientId: "HMS-0013", admissionDate: "5 Nov 2025",  ward: "Maternity", bed: "M-01", doctor: "Dr. Sophia Adams",   diagnosis: "Normal Delivery (post-natal)",status: "Discharged"},
  { id: 5, patientName: "Divya Patel",     patientAge: 34, patientId: "HMS-0014", admissionDate: "12 Nov 2025", ward: "Surgery",   bed: "S-03", doctor: "Dr. Ava Johnson",    diagnosis: "Cholecystitis (laparoscopic)", status: "Admitted" },
  { id: 6, patientName: "Noah Carter",     patientAge: 65, patientId: "HMS-0006", admissionDate: "1 Nov 2025",  ward: "ICU",       bed: "I-01", doctor: "Dr. Daniel Reed",    diagnosis: "Diabetic Ketoacidosis",     status: "ICU"        },
  { id: 7, patientName: "Anjali Singh",    patientAge: 27, patientId: "HMS-0015", admissionDate: "11 Nov 2025", ward: "Neurology", bed: "N-02", doctor: "Dr. Grace Mitchell", diagnosis: "Migraine with Aura (obs.)", status: "Admitted"   },
  { id: 8, patientName: "Karan Joshi",     patientAge: 38, patientId: "HMS-0010", admissionDate: "7 Nov 2025",  ward: "Ortho",     bed: "O-05", doctor: "Dr. James Parker",   diagnosis: "Fracture Tibia (ORIF)",     status: "Discharged" },
];
