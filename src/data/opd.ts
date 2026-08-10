import { type OpdRecord } from "@/types";

/**
 * Seed shape for the OPD queue. Reason, priority and vitals readings are
 * derived when the rows are built (see server/db/seed.ts), so they are not
 * repeated here.
 */
export type OpdSeed = Omit<OpdRecord, "reason" | "priority" | "vitals">;

export const opdRecords: OpdSeed[] = [
  { id: 1,  tokenNumber: "T-001", patientName: "William Scott",   patientAge: 55, doctor: "Dr. Emily Cooper",   vitalsRecorded: true,  waitTime: "5 min",  checkInTime: "9:05 AM",  status: "In Consultation" },
  { id: 2,  tokenNumber: "T-002", patientName: "Ethan Miller",    patientAge: 18, doctor: "Dr. Sophia Adams",   vitalsRecorded: true,  waitTime: "12 min", checkInTime: "9:18 AM",  status: "Waiting"         },
  { id: 3,  tokenNumber: "T-003", patientName: "Priya Sharma",    patientAge: 40, doctor: "Dr. Daniel Reed",    vitalsRecorded: false, waitTime: "20 min", checkInTime: "9:30 AM",  status: "Waiting"         },
  { id: 4,  tokenNumber: "T-004", patientName: "Rajan Mehta",     patientAge: 62, doctor: "Dr. Olivia Turner",  vitalsRecorded: true,  waitTime: "8 min",  checkInTime: "9:45 AM",  status: "Waiting"         },
  { id: 5,  tokenNumber: "T-005", patientName: "Anjali Singh",    patientAge: 27, doctor: "Dr. Ethan Miller",   vitalsRecorded: false, waitTime: "30 min", checkInTime: "10:00 AM", status: "Waiting"         },
  { id: 6,  tokenNumber: "T-006", patientName: "Noah Carter",     patientAge: 65, doctor: "Dr. Daniel Reed",    vitalsRecorded: true,  waitTime: "—",      checkInTime: "10:15 AM", status: "Completed"       },
  { id: 7,  tokenNumber: "T-007", patientName: "Divya Patel",     patientAge: 34, doctor: "Dr. Ava Johnson",    vitalsRecorded: true,  waitTime: "—",      checkInTime: "10:30 AM", status: "Completed"       },
  { id: 8,  tokenNumber: "T-008", patientName: "Suresh Kumar",    patientAge: 50, doctor: "Dr. Grace Mitchell", vitalsRecorded: false, waitTime: "45 min", checkInTime: "10:45 AM", status: "Waiting"         },
  { id: 9,  tokenNumber: "T-009", patientName: "Meena Reddy",     patientAge: 29, doctor: "Dr. Emily Cooper",   vitalsRecorded: true,  waitTime: "—",      checkInTime: "11:00 AM", status: "Completed"       },
  { id: 10, tokenNumber: "T-010", patientName: "Karan Joshi",     patientAge: 38, doctor: "Dr. Sophia Adams",   vitalsRecorded: true,  waitTime: "15 min", checkInTime: "11:15 AM", status: "In Consultation" },
];
