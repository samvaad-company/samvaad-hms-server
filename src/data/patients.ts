import { type Patient } from "@/types";

export const patients: Patient[] = [
  { id: 1,  name: "Olivia Turner",   age: 28, phone: "+91 9876543210", gender: "Female", reason: "Dizziness or weakness",           doctor: "Dr. Olivia Turner",  status: "Completed", date: "8 Nov 2025",  time: "11:30 AM", patientId: "HMS-0001", bloodGroup: "B+" },
  { id: 2,  name: "Ethan Miller",    age: 18, phone: "+91 9876543211", gender: "Male",   reason: "Routine health check-up",         doctor: "Dr. Sophia Adams",   status: "Today",     date: "8 Nov 2025",  time: "12:30 PM", patientId: "HMS-0002", bloodGroup: "O+" },
  { id: 3,  name: "Sophia Adams",    age: 10, phone: "+91 9876543212", gender: "Female", reason: "Fever or flu symptoms",           doctor: "Dr. Emily Cooper",   status: "Upcoming",  date: "9 Nov 2025",  time: "1:30 PM",  patientId: "HMS-0003", bloodGroup: "A+" },
  { id: 4,  name: "Liam Brooks",     age: 32, phone: "+91 9876543213", gender: "Male",   reason: "Cough and cold",                 doctor: "Dr. Ethan Miller",   status: "Cancelled", date: "9 Nov 2025",  time: "2:00 PM",  patientId: "HMS-0004", bloodGroup: "AB+" },
  { id: 5,  name: "Ava Johnson",     age: 36, phone: "+91 9876543214", gender: "Female", reason: "Body pain or fatigue",           doctor: "Dr. Olivia Turner",  status: "Upcoming",  date: "12 Nov 2025", time: "3:00 PM",  patientId: "HMS-0005", bloodGroup: "B-" },
  { id: 6,  name: "Noah Carter",     age: 65, phone: "+91 9876543215", gender: "Male",   reason: "Diabetes management",            doctor: "Dr. Daniel Reed",    status: "Upcoming",  date: "13 Nov 2025", time: "3:30 PM",  patientId: "HMS-0006", bloodGroup: "O-" },
  { id: 7,  name: "Grace Mitchell",  age: 35, phone: "+91 9876543216", gender: "Female", reason: "Stomach ache or digestion issues", doctor: "Dr. Ava Johnson",  status: "Completed", date: "17 Nov 2025", time: "4:30 PM",  patientId: "HMS-0007", bloodGroup: "A-" },
  { id: 8,  name: "James Parker",    age: 22, phone: "+91 9876543217", gender: "Male",   reason: "Dizziness or weakness",           doctor: "Dr. Grace Mitchell", status: "Cancelled", date: "20 Nov 2025", time: "5:30 PM",  patientId: "HMS-0008", bloodGroup: "B+" },
  { id: 9,  name: "Isabella Reed",   age: 45, phone: "+91 9876543218", gender: "Female", reason: "Hypertension follow-up",          doctor: "Dr. Daniel Reed",    status: "Completed", date: "22 Nov 2025", time: "10:00 AM", patientId: "HMS-0009", bloodGroup: "O+" },
  { id: 10, name: "William Scott",   age: 55, phone: "+91 9876543219", gender: "Male",   reason: "Back pain & physiotherapy",       doctor: "Dr. Emily Cooper",   status: "Today",     date: "8 Nov 2025",  time: "9:00 AM",  patientId: "HMS-0010", bloodGroup: "AB-" },
];
