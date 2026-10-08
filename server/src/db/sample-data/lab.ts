import { type LabTest } from "@shared/types";

export const labTests: LabTest[] = [
  { id: 1,  patientName: "Olivia Turner",   patientAge: 28, testName: "Complete Blood Count",    sampleStatus: "Collected", reportStatus: "Ready",   date: "8 Nov 2025",  amount: 350,  status: "Report Ready"    },
  { id: 2,  patientName: "Ethan Miller",    patientAge: 18, testName: "Lipid Profile",           sampleStatus: "Collected", reportStatus: "Pending", date: "8 Nov 2025",  amount: 600,  status: "Sample Collected"},
  { id: 3,  patientName: "Noah Carter",     patientAge: 65, testName: "HbA1c + Fasting Glucose", sampleStatus: "Collected", reportStatus: "Ready",   date: "9 Nov 2025",  amount: 800,  status: "Report Ready"    },
  { id: 4,  patientName: "Isabella Reed",   patientAge: 45, testName: "Thyroid Function Test",   sampleStatus: "Pending",   reportStatus: "Pending", date: "10 Nov 2025", amount: 750,  status: "Pending"         },
  { id: 5,  patientName: "Priya Sharma",    patientAge: 40, testName: "T3 T4 TSH",               sampleStatus: "Collected", reportStatus: "Ready",   date: "9 Nov 2025",  amount: 950,  status: "Report Ready"    },
  { id: 6,  patientName: "Ava Johnson",     patientAge: 36, testName: "Stool Routine",           sampleStatus: "Pending",   reportStatus: "Pending", date: "12 Nov 2025", amount: 200,  status: "Pending"         },
  { id: 7,  patientName: "William Scott",   patientAge: 55, testName: "X-Ray Lumbar Spine",      sampleStatus: "Collected", reportStatus: "Ready",   date: "8 Nov 2025",  amount: 1200, status: "Report Ready"    },
  { id: 8,  patientName: "Karan Joshi",     patientAge: 38, testName: "IgE Allergy Panel",       sampleStatus: "Collected", reportStatus: "Pending", date: "8 Nov 2025",  amount: 2500, status: "Sample Collected"},
  { id: 9,  patientName: "Rajan Mehta",     patientAge: 62, testName: "ECG + Echo",              sampleStatus: "Collected", reportStatus: "Ready",   date: "11 Nov 2025", amount: 1800, status: "Report Ready"    },
  { id: 10, patientName: "Grace Mitchell",  patientAge: 35, testName: "Colonoscopy",             sampleStatus: "Pending",   reportStatus: "Pending", date: "17 Nov 2025", amount: 5000, status: "Pending"         },
];
