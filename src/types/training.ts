/**
 * Training & tours: the lessons the app teaches, and which roles each is recommended to. Shared by the screen (which runs the tours
 * and draws the cards) and the server (which counts a person's progress against what is recommended to their role).
 * The steps of each tour live with the screen that plays them — see src/lib/training/tours.ts.
 */

export type LessonGroup = "Start here" | "Front desk" | "Clinical" | "Wards" | "Money" | "People" | "Set up" | "Reports";

export interface LessonMeta {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  /** A lucide icon name, resolved by the screen. */
  icon: string;
  group: LessonGroup;
  /** The permission needed to try the lesson on a real screen; lessons a role can't use are not offered to it. */
  needs?: { resource: string; action?: "read" | "write" };
  /** Roles this is recommended to; "all" means everyone. */
  roles: string[] | "all";
}

const FRONT = ["Receptionist", "Tele Caller"];
const CLINICAL = ["Doctor", "Head Nurse"];
const ADMINS = ["Super Admin", "IT Admin"];

export const LESSONS: LessonMeta[] = [
  { id: "getting-started", title: "Getting started", summary: "Find your way around: the sidebar, search, notifications and your account.", minutes: 2, icon: "Compass", group: "Start here", roles: "all" },
  { id: "ask-ai", title: "Ask the AI assistant", summary: "Ask about a patient, your day or the hospital in plain words — answers come from your hospital's own records.", minutes: 1, icon: "Sparkles", group: "Start here", needs: { resource: "chat" }, roles: ["Super Admin", "Doctor", "Head Nurse", "Receptionist", "Billing Exec"] },
  { id: "walk-in", title: "Walk-in: check a patient in", summary: "A patient walks in: find or register them, pick the doctor, take the vitals and issue the token.", minutes: 3, icon: "ListOrdered", group: "Front desk", needs: { resource: "opd", action: "write" }, roles: ["Super Admin", "Receptionist"] },
  { id: "patients", title: "Patients", summary: "Find any patient in seconds, register new ones and open their record.", minutes: 2, icon: "Users", group: "Front desk", needs: { resource: "patients" }, roles: ["Super Admin", "Receptionist", "Doctor", "MRD Officer"] },
  { id: "appointments", title: "Appointments", summary: "Book, reschedule and check patients in against each doctor's calendar.", minutes: 2, icon: "CalendarDays", group: "Front desk", needs: { resource: "appointments" }, roles: ["Super Admin", "Receptionist", "Tele Caller", "Doctor"] },
  { id: "enquiries", title: "Enquiries & follow-ups", summary: "Capture a lead, log each call-back, and turn it into a patient — and keep planned return visits on track.", minutes: 2, icon: "Inbox", group: "Front desk", needs: { resource: "enquiries" }, roles: [...FRONT] },
  { id: "prescriptions", title: "Write a prescription", summary: "Pick the patient, add medicines with dose and duration, and save it for the pharmacy.", minutes: 2, icon: "FileText", group: "Clinical", needs: { resource: "prescriptions", action: "write" }, roles: ["Doctor", "Pharmacist"] },
  { id: "lab-worklist", title: "Lab worklist", summary: "Order a test, collect the sample, upload the report — with the urgent ones first.", minutes: 2, icon: "FlaskConical", group: "Clinical", needs: { resource: "lab" }, roles: ["Lab Technician", "Lab Partner", "Doctor"] },
  { id: "radiology-worklist", title: "Radiology worklist", summary: "Order a study, mark the scan done and publish the report.", minutes: 2, icon: "ScanLine", group: "Clinical", needs: { resource: "radiology" }, roles: ["Radiology Partner"] },
  { id: "pharmacy", title: "Pharmacy stock", summary: "Add stock, watch what is running low or about to expire, and dispense against a prescription.", minutes: 2, icon: "Pill", group: "Clinical", needs: { resource: "pharmacy" }, roles: ["Pharmacist"] },
  { id: "admit-patient", title: "Admit a patient", summary: "One screen: the patient, admission type, doctor, a free bed and the deposit — then the stay opens.", minutes: 3, icon: "BedDouble", group: "Wards", needs: { resource: "ipd", action: "write" }, roles: ["Super Admin", "Doctor", "Head Nurse"] },
  { id: "nurse-station", title: "Nurse station", summary: "Doses due, vitals rounds, IV bottles and handover for your ward, with alerts you can acknowledge.", minutes: 3, icon: "HeartPulse", group: "Wards", needs: { resource: "nursing" }, roles: ["Head Nurse"] },
  { id: "housekeeping", title: "Housekeeping board", summary: "See which beds are being cleaned, raise a task, and sign it off when the room is ready.", minutes: 2, icon: "SprayCan", group: "Wards", needs: { resource: "beds" }, roles: ["Super Admin", "Head Nurse"] },
  { id: "tasks", title: "Create and track a task", summary: "Put a task on the board, give it an owner and a deadline, and move it along until it's closed.", minutes: 2, icon: "ClipboardList", group: "People", needs: { resource: "tasks" }, roles: ["Super Admin", "IT Admin", "Doctor", "Head Nurse", "HR Manager", "Receptionist", "CSSD Technician"] },
  { id: "apply-leave", title: "Apply for leave", summary: "Check your balance, pick the dates and apply.", minutes: 2, icon: "CalendarOff", group: "People", needs: { resource: "hr" }, roles: ["Super Admin", "Doctor", "Head Nurse", "Receptionist", "Tele Caller", "Billing Exec", "Pharmacist", "Lab Technician", "MRD Officer", "HR Manager", "CSSD Technician"] },
  { id: "approve-leave", title: "Approve leave requests", summary: "See who is asking, who else is off those days, and approve or reject with a note.", minutes: 2, icon: "CalendarCheck", group: "People", needs: { resource: "hr", action: "write" }, roles: ["Super Admin", "HR Manager"] },
  { id: "add-staff", title: "Add a staff member", summary: "Create a colleague's login with the right role, hand over the first password, and adjust access.", minutes: 3, icon: "UserPlus", group: "People", needs: { resource: "staff", action: "write" }, roles: ["Super Admin", "IT Admin", "HR Manager"] },
  { id: "billing", title: "Billing", summary: "Raise bills, collect payments and look a bill up.", minutes: 2, icon: "Receipt", group: "Money", needs: { resource: "billing" }, roles: ["Super Admin", "Billing Exec", "Receptionist"] },
  { id: "hospital-setup", title: "Hospital setup", summary: "Identity and GST, charges and posting, and the clinical policies the hospital runs on.", minutes: 1, icon: "Building2", group: "Set up", needs: { resource: "admin" }, roles: [...ADMINS] },
  { id: "masters", title: "Masters", summary: "The reference lists everything else uses: services, prices, payers, departments.", minutes: 1, icon: "Layers", group: "Set up", needs: { resource: "admin" }, roles: [...ADMINS] },
  { id: "settings", title: "Settings", summary: "Clinic profile and branding, billing, notifications, security and appearance.", minutes: 1, icon: "Settings", group: "Set up", needs: { resource: "admin" }, roles: [...ADMINS] },
  { id: "analytics", title: "Analytics", summary: "The trend of collections and footfall, with today's numbers for revenue, OPD, beds, pharmacy and lab.", minutes: 1, icon: "BarChart3", group: "Reports", needs: { resource: "reports" }, roles: ["Super Admin", "Billing Exec"] },
  { id: "reports", title: "Reports", summary: "Ready-made reports for cashiers, billing, registers, clinical work and accounts.", minutes: 1, icon: "FileBarChart", group: "Reports", needs: { resource: "reports" }, roles: ["Super Admin", "Billing Exec", "IT Admin"] },
  { id: "audit", title: "Audit", summary: "A tamper-evident record of who did what, ready for inspectors.", minutes: 1, icon: "ScrollText", group: "Reports", needs: { resource: "admin" }, roles: [...ADMINS] },
];

/** Roles that have a recommended list of their own. A role not named anywhere is shown the "everyone" lessons only. */
export const lessonById = (id: string): LessonMeta | undefined => LESSONS.find((l) => l.id === id);

export const isRecommended = (lesson: LessonMeta, role: string): boolean => lesson.roles === "all" || lesson.roles.includes(role);

/** The lessons recommended to a role, in the order they should be taken. */
export const recommendedFor = (role: string): LessonMeta[] => LESSONS.filter((l) => isRecommended(l, role));

/** Roles used by `CLINICAL` etc. are listed above; exported so tests can check every role gets something. */
export const KNOWN_ROLES = ["Super Admin", "IT Admin", "Doctor", "Head Nurse", "Receptionist", "Tele Caller", "Billing Exec", "Insurance Exec", "Pharmacist", "Lab Technician", "MRD Officer", "HR Manager", "CSSD Technician", "Driver", "Radiology Partner", "Lab Partner"] as const;
void CLINICAL;
