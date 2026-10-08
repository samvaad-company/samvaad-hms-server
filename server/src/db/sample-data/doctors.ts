import { type Doctor } from "@shared/types";

export const doctors: Doctor[] = [
  { id: 1,  name: "Dr. Olivia Turner",  specialty: "General Physician",   department: "OPD",          phone: "+91 9800000001", experience: "12 yrs", patientsToday: 18, status: "In OPD"   },
  { id: 2,  name: "Dr. Sophia Adams",   specialty: "Paediatrician",        department: "Paediatrics",  phone: "+91 9800000002", experience: "8 yrs",  patientsToday: 14, status: "In OPD"   },
  { id: 3,  name: "Dr. Emily Cooper",   specialty: "Physiotherapist",      department: "Rehab",        phone: "+91 9800000003", experience: "6 yrs",  patientsToday: 10, status: "Active"   },
  { id: 4,  name: "Dr. Ethan Miller",   specialty: "Pulmonologist",        department: "Respiratory",  phone: "+91 9800000004", experience: "15 yrs", patientsToday: 22, status: "In OPD"   },
  { id: 5,  name: "Dr. Daniel Reed",    specialty: "Endocrinologist",      department: "Internal Med", phone: "+91 9800000005", experience: "20 yrs", patientsToday: 25, status: "In OPD"   },
  { id: 6,  name: "Dr. Ava Johnson",    specialty: "Gastroenterologist",   department: "Surgery",      phone: "+91 9800000006", experience: "10 yrs", patientsToday: 12, status: "Active"   },
  { id: 7,  name: "Dr. Grace Mitchell", specialty: "Neurologist",          department: "Neurology",    phone: "+91 9800000007", experience: "18 yrs", patientsToday: 9,  status: "On Leave" },
  { id: 8,  name: "Dr. Noah Carter",    specialty: "Cardiologist",         department: "Cardiology",   phone: "+91 9800000008", experience: "22 yrs", patientsToday: 0,  status: "On Leave" },
  { id: 9,  name: "Dr. James Parker",   specialty: "Orthopaedic Surgeon",  department: "Ortho",        phone: "+91 9800000009", experience: "14 yrs", patientsToday: 16, status: "Active"   },
  { id: 10, name: "Dr. Priya Sharma",   specialty: "Dermatologist",        department: "Skin",         phone: "+91 9800000010", experience: "9 yrs",  patientsToday: 20, status: "In OPD"   },
];
