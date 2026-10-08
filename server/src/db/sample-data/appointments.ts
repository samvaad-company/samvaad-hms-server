import { type Appointment } from "@shared/types";

export const appointments: Appointment[] = [
  { id: 1,  patientName: "Olivia Turner",   patientAge: 28, doctor: "Dr. Ethan Miller",    date: "8 Nov 2025",  time: "11:30 AM", type: "Booked",  reason: "Dizziness or weakness",           status: "Completed" },
  { id: 2,  patientName: "Ethan Miller",    patientAge: 18, doctor: "Dr. Sophia Adams",    date: "8 Nov 2025",  time: "12:30 PM", type: "Booked",  reason: "Routine health check-up",         status: "Today"     },
  { id: 3,  patientName: "Sophia Adams",    patientAge: 10, doctor: "Dr. Emily Cooper",    date: "9 Nov 2025",  time: "1:30 PM",  type: "Walk-in", reason: "Fever or flu symptoms",           status: "Upcoming"  },
  { id: 4,  patientName: "Liam Brooks",     patientAge: 32, doctor: "Dr. Ethan Miller",    date: "9 Nov 2025",  time: "2:00 PM",  type: "Booked",  reason: "Cough and cold",                 status: "Cancelled" },
  { id: 5,  patientName: "Ava Johnson",     patientAge: 36, doctor: "Dr. Olivia Turner",   date: "12 Nov 2025", time: "3:00 PM",  type: "Booked",  reason: "Body pain or fatigue",           status: "Upcoming"  },
  { id: 6,  patientName: "Noah Carter",     patientAge: 65, doctor: "Dr. Daniel Reed",     date: "13 Nov 2025", time: "3:30 PM",  type: "Walk-in", reason: "Diabetes management",            status: "Upcoming"  },
  { id: 7,  patientName: "Grace Mitchell",  patientAge: 35, doctor: "Dr. Ava Johnson",     date: "17 Nov 2025", time: "4:30 PM",  type: "Booked",  reason: "Stomach ache",                   status: "Completed" },
  { id: 8,  patientName: "James Parker",    patientAge: 22, doctor: "Dr. Grace Mitchell",  date: "20 Nov 2025", time: "5:30 PM",  type: "Walk-in", reason: "Dizziness or weakness",           status: "Cancelled" },
  { id: 9,  patientName: "Isabella Reed",   patientAge: 45, doctor: "Dr. Daniel Reed",     date: "22 Nov 2025", time: "10:00 AM", type: "Booked",  reason: "Hypertension follow-up",          status: "Upcoming"  },
  { id: 10, patientName: "William Scott",   patientAge: 55, doctor: "Dr. Emily Cooper",    date: "8 Nov 2025",  time: "9:00 AM",  type: "Walk-in", reason: "Back pain",                       status: "Today"     },
];
