/**
 * Seed data for the workflow modules: staff task board and consultation
 * scribe notes.
 */
import type { TaskStatus, TaskPriority, ScribeStatus } from "@/types";

export interface TaskSeed {
  id: number;
  title: string;
  description: string;
  goal: string;
  assigneeId: number | null;
  assigneeName: string;
  assignedBy: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
}

export const tasks: TaskSeed[] = [
  { id: 1, title: "Sanitize OT-2 before evening list", description: "Deep clean and restock OT-2 ahead of the 4 PM surgical list.", goal: "OT Readiness", assigneeId: 3, assigneeName: "Sister Mary Thomas", assignedBy: "Dr. Kevin Carter", priority: "High", status: "To Do", dueDate: "14 Jul 2026" },
  { id: 2, title: "Audit expiring pharmacy stock", description: "Flag all medicines expiring within 30 days and move to quarantine shelf.", goal: "Inventory Compliance", assigneeId: 5, assigneeName: "Rahul Deshpande", assignedBy: "Dr. Kevin Carter", priority: "Medium", status: "In Progress", dueDate: "16 Jul 2026" },
  { id: 3, title: "Follow up on 6 pending TPA claims", description: "Call MediAssist and Star Health on claims older than 7 days.", goal: "Revenue Cycle", assigneeId: 7, assigneeName: "Anjali Mehta", assignedBy: "Dr. Kevin Carter", priority: "High", status: "In Progress", dueDate: "15 Jul 2026" },
  { id: 4, title: "Restock emergency crash carts", description: "Verify and replenish all 4 crash carts against the checklist.", goal: "Emergency Preparedness", assigneeId: 3, assigneeName: "Sister Mary Thomas", assignedBy: "Dr. Kevin Carter", priority: "Urgent", status: "Blocked", dueDate: "13 Jul 2026" },
  { id: 5, title: "Update ward duty roster for next week", description: "Publish the nursing duty roster for 14–20 Jul.", goal: "Staffing", assigneeId: 2, assigneeName: "Priya Nair", assignedBy: "Dr. Kevin Carter", priority: "Low", status: "Done", dueDate: "11 Jul 2026" },
  { id: 6, title: "Calibrate radiology CT scanner", description: "Schedule vendor calibration and log the service report.", goal: "Equipment Maintenance", assigneeId: 6, assigneeName: "Karan Joshi", assignedBy: "Dr. Kevin Carter", priority: "Medium", status: "To Do", dueDate: "18 Jul 2026" },
];

export interface ScribeNoteSeed {
  id: number;
  appointmentId: number | null;
  patientId: number | null;
  patientName: string;
  doctorId: number | null;
  doctorName: string;
  transcript: string;
  brief: string;
  language: string;
  durationSec: number;
  status: ScribeStatus;
}

export const scribeNotes: ScribeNoteSeed[] = [
  {
    id: 1,
    appointmentId: 1,
    patientId: 1,
    patientName: "Olivia Turner",
    doctorId: 4,
    doctorName: "Dr. Ethan Miller",
    transcript:
      "Patient reports intermittent dizziness and generalized weakness over the past five days, worse on standing. No chest pain or palpitations. Appetite reduced. On examination blood pressure is 100 over 62, pulse 88 and regular. No pallor. Advised hydration, ordered CBC and electrolytes, and started on oral rehydration.",
    brief:
      "S: 5-day history of intermittent dizziness and weakness, postural. No chest pain/palpitations.\nO: BP 100/62, HR 88 regular, no pallor.\nA: Likely dehydration / orthostatic hypotension.\nP: Oral rehydration, CBC + electrolytes, review in 3 days.",
    language: "en-IN",
    durationSec: 92,
    status: "Signed",
  },
];
