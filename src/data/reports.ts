import { type KpiStat, type ReportRow } from "@/types";

export const kpiStats: KpiStat[] = [
  { label: "Total Revenue",       value: "₹4,82,350", change: "+12.4%", positive: true  },
  { label: "Total Appointments",  value: "1,259",     change: "+8.2%",  positive: true  },
  { label: "New Patients",        value: "342",       change: "+5.1%",  positive: true  },
  { label: "Avg Wait Time",       value: "18 min",    change: "-3 min", positive: true  },
];

export const reportRows: ReportRow[] = [
  { id: 1,  doctor: "Dr. Daniel Reed",    specialty: "Endocrinologist",     patientsCount: 312, revenue: 93600,  satisfaction: "4.9 / 5", avgConsultTime: "22 min" },
  { id: 2,  doctor: "Dr. Ethan Miller",   specialty: "Pulmonologist",       patientsCount: 298, revenue: 89400,  satisfaction: "4.8 / 5", avgConsultTime: "18 min" },
  { id: 3,  doctor: "Dr. Olivia Turner",  specialty: "General Physician",   patientsCount: 276, revenue: 69000,  satisfaction: "4.7 / 5", avgConsultTime: "15 min" },
  { id: 4,  doctor: "Dr. Sophia Adams",   specialty: "Paediatrician",       patientsCount: 254, revenue: 76200,  satisfaction: "4.9 / 5", avgConsultTime: "20 min" },
  { id: 5,  doctor: "Dr. Priya Sharma",   specialty: "Dermatologist",       patientsCount: 240, revenue: 72000,  satisfaction: "4.6 / 5", avgConsultTime: "14 min" },
  { id: 6,  doctor: "Dr. James Parker",   specialty: "Orthopaedic Surgeon", patientsCount: 198, revenue: 99000,  satisfaction: "4.8 / 5", avgConsultTime: "25 min" },
  { id: 7,  doctor: "Dr. Ava Johnson",    specialty: "Gastroenterologist",  patientsCount: 186, revenue: 74400,  satisfaction: "4.7 / 5", avgConsultTime: "22 min" },
  { id: 8,  doctor: "Dr. Emily Cooper",   specialty: "Physiotherapist",     patientsCount: 175, revenue: 43750,  satisfaction: "4.8 / 5", avgConsultTime: "30 min" },
  { id: 9,  doctor: "Dr. Grace Mitchell", specialty: "Neurologist",         patientsCount: 162, revenue: 81000,  satisfaction: "4.6 / 5", avgConsultTime: "28 min" },
  { id: 10, doctor: "Dr. Noah Carter",    specialty: "Cardiologist",        patientsCount: 0,   revenue: 0,      satisfaction: "—",       avgConsultTime: "—"      },
];
