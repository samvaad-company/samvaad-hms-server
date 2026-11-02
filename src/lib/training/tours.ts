/**
 * The steps of every guided tour. A step names where it happens (`route`), what it points at (`target`) and what to say.
 *  - hint "click": the target is something to click — doing it moves on, and Next does it for you.
 *  - hint "try":   the target is something to use; press Next when done.
 *  - neither:      just look.
 * A step with no target is a card in the middle of the screen.
 */
import type { Target } from "./target";

export interface Step {
  title: string;
  body: string;
  target?: Target;
  route?: string;
  hint?: "click" | "try";
  shortcut?: string;
}

const nav = (href: string): Target => ({ css: `aside a[href="${href}"]` });
const btn = (text: string, scope: "auto" | "main" | "dialog" = "auto"): Target => ({ text, scope, kind: "button" });
const field = (text: string, kind: "input" | "label" = "label"): Target => ({ text, scope: "dialog", kind });
const open = (href: string, label: string, shortcut?: string): Step => ({ title: "Open it from the sidebar", body: `Click ${label} in the sidebar to open it.`, target: nav(href), hint: "click", shortcut });

export const TOURS: Record<string, Step[]> = {
  "getting-started": [
    { title: "Welcome to Samvaad HMS", body: "A two-minute tour of the parts you'll use every day. Use Next to move on, the arrow to go back, or Skip tour whenever you like.", route: "/home" },
    { title: "Everything is in the sidebar", body: "Your role only shows what you can use. Each group folds away, and the arrow at the bottom collapses the whole bar for more room.", target: { css: "aside" }, route: "/home" },
    { title: "Search from anywhere", body: "Find a patient, doctor or appointment without leaving the screen you're on.", target: { css: 'button[aria-label="Search"]' }, shortcut: "⌘ K" },
    { title: "Notifications", body: "Things that need you show up here — a result ready, a request waiting.", target: { css: "svg.lucide-bell" } },
    { title: "Settings and light or dark", body: "Settings holds the clinic profile, security and appearance. The moon switches between light and dark.", target: { css: 'a[aria-label="Settings"]' } },
    { title: "Your account", body: "Your profile, your password and sign out are under your name.", target: { css: '[data-tour="profile"]' } },
    { title: "Ask the assistant", body: "The AI button in the top bar opens the assistant in a side panel on any screen. Ask about a patient, your day or the hospital.", target: { css: '[data-tour="ai-launcher"]' } },
    { title: "That's the tour", body: "Open Training in the sidebar any time for lessons on each screen — they're picked for your role." },
  ],
  "ask-ai": [
    open("/chat", "AI Chat", "C"),
    { title: "Ask in plain words", body: "Type a question — \"who is waiting in OPD?\", \"what did we collect today?\" — and the answer comes from your hospital's own records.", target: { text: "Ask about", scope: "main", kind: "input" }, route: "/chat", hint: "try" },
    { title: "Start a fresh chat", body: "Each question thread is kept, so you can come back to it. New Chat starts a clean one.", target: btn("New Chat", "main"), route: "/chat" },
    { title: "Check what matters", body: "The assistant can be wrong. Open the patient's record from its answer to confirm anything important." },
  ],
  "walk-in": [
    open("/opd", "OPD", "O"),
    { title: "The OPD queue", body: "Every token for today, by status. New Check-in is how a walk-in gets one.", target: btn("New Check-in", "main"), route: "/opd", hint: "click" },
    { title: "Find the patient", body: "Search by name, ID or phone. A patient who isn't registered yet is registered first, then checked in.", target: { text: "Search patient", scope: "dialog", kind: "button" }, hint: "try" },
    { title: "Pick the doctor", body: "Choose who the patient will see. Each doctor has their own token numbers, starting again at 1 every day.", target: field("Doctor") },
    { title: "Why they came", body: "A short chief complaint, and a priority — emergencies jump the queue.", target: field("Chief Complaint") },
    { title: "Vitals, if you have them", body: "Blood pressure, pulse, temperature and oxygen can be taken now or by the nurse later.", target: field("Blood Pressure") },
    { title: "Issue the token", body: "That's all it takes. The token joins the waiting list and the doctor calls it from their screen.", target: { text: "Issue Token", scope: "dialog", kind: "button" } },
  ],
  patients: [
    open("/patients", "Patients", "P"),
    { title: "Find anyone fast", body: "Type a name, mobile number or patient ID — the list narrows as you type.", target: { text: "Search name", scope: "main", kind: "input" }, route: "/patients", hint: "try" },
    { title: "Filter the list", body: "All, today's patients, completed or cancelled.", target: btn("All", "main"), route: "/patients" },
    { title: "Register a new patient", body: "New patient opens the registration form. Name, gender, age and mobile are all it needs; the patient ID is issued automatically.", target: btn("New patient", "main"), route: "/patients" },
  ],
  appointments: [
    open("/appointments", "Appointments", "A"),
    { title: "Book an appointment", body: "Pick the patient, the doctor and a free slot. Booking from here puts it on the doctor's calendar straight away.", target: btn("New Appointment", "main"), route: "/appointments" },
    { title: "Live queue", body: "Today's patients as they check in, against each doctor.", target: btn("Live Queue", "main") },
    { title: "Doctor wise", body: "One doctor's whole calendar at a glance.", target: btn("Doctor Wise", "main") },
    { title: "Search and filter", body: "Find a booking by patient or doctor, or filter to today, upcoming, completed or cancelled.", target: { text: "Search by patient", scope: "main", kind: "input" } },
  ],
  enquiries: [
    open("/enquiries", "Enquiries", "3"),
    { title: "Capture the lead", body: "Someone asks about a service — write them down once, with what they want and when to call back.", target: btn("New enquiry", "main"), route: "/enquiries" },
    { title: "Work the list", body: "Open, Contacted, Converted, Closed. Log each contact and convert the lead into a patient when they come.", target: btn("Open", "main") },
    open("/followups", "Follow-ups", "4"),
    { title: "Plan the return visit", body: "A follow-up is a planned visit for an existing patient. Schedule one with a due date and a reason.", target: btn("+ Schedule", "main"), route: "/followups" },
  ],
  prescriptions: [
    open("/prescriptions", "Prescriptions", "R"),
    { title: "Start a prescription", body: "New Prescription opens the form for the patient and doctor.", target: btn("New Prescription", "main"), route: "/prescriptions", hint: "click" },
    { title: "Patient and doctor", body: "Search for the patient and the prescribing doctor.", target: { text: "Patient", scope: "main", kind: "label" } },
    { title: "Add the medicines", body: "Add Medicine gives a line for the drug, dose, frequency and duration.", target: btn("Add Medicine", "main") },
    { title: "Save it", body: "Saving sends it to the pharmacy to dispense.", target: btn("Save Prescription", "main") },
  ],
  "lab-worklist": [
    open("/lab", "Lab", "L"),
    { title: "Order a test", body: "Pick the patient and the tests, set the priority, and the order lands on the worklist.", target: btn("Order Test", "main"), route: "/lab" },
    { title: "The worklist", body: "Every order by stage: ordered, sample collected, published.", target: btn("Worklist", "main") },
    { title: "Urgent first", body: "STAT and urgent orders are flagged — filter to them to work the most important first.", target: btn("STAT", "main") },
    { title: "Reports", body: "Published reports are here, ready to view or share.", target: btn("Reports", "main") },
  ],
  "radiology-worklist": [
    open("/radiology", "Radiology", "X"),
    { title: "Order a study", body: "Pick the patient and the study; it joins the worklist.", target: btn("Order Study", "main"), route: "/radiology" },
    { title: "The worklist", body: "Ordered, scanned, published — work each study along.", target: btn("Worklist", "main") },
    { title: "Reports", body: "Published reports are kept here.", target: btn("Reports", "main") },
  ],
  pharmacy: [
    open("/pharmacy", "Pharmacy", "M"),
    { title: "Add stock", body: "Add an item with its stock, minimum level and expiry.", target: btn("Add Item", "main"), route: "/pharmacy" },
    { title: "What's running low", body: "Filter to Low Stock or Out of Stock to see what to reorder.", target: btn("Low Stock", "main") },
    { title: "About to expire", body: "Batches close to their expiry date, soonest first.", target: btn("About to Expire", "main") },
    { title: "Alerts", body: "Low stock and expiry alerts gathered in one place.", target: btn("Alerts", "main") },
  ],
  "admit-patient": [
    open("/ipd", "IPD", "I"),
    { title: "Start the admission", body: "Admit patient opens one screen for everything.", target: btn("Admit patient", "main"), route: "/ipd", hint: "click" },
    { title: "The patient", body: "Search and pick the patient. A new patient is registered first.", target: { text: "Search patient", scope: "dialog", kind: "button" }, hint: "try" },
    { title: "Why they're coming in", body: "Emergency, planned, day care, maternity or transfer in. An emergency can be admitted now and completed later.", target: btn("Emergency", "dialog") },
    { title: "Pick a bed", body: "Each free bed shows its daily rate, and the wards filter them. No bed ready? Leave 'Assign later' picked.", target: btn("All wards", "dialog") },
    { title: "Admit", body: "The deposit and primary nurse are optional now. Admit patient opens the stay.", target: { text: "Admit patient", scope: "dialog", kind: "button" } },
  ],
  "nurse-station": [
    open("/nurse-station", "Nurse station", "6"),
    { title: "The board", body: "Your ward's patients at a glance, with what needs attention.", target: btn("Board", "main"), route: "/nurse-station" },
    { title: "Medicines", body: "Doses due, given and missed.", target: btn("Medicines", "main") },
    { title: "Vitals round", body: "Who is due for vitals and who has been done.", target: btn("Vitals round", "main") },
    { title: "IV bottles", body: "Running bottles and when each runs out.", target: btn("IV bottles", "main") },
    { title: "Handover", body: "Notes for the next shift, kept with each patient.", target: btn("Handover", "main") },
    { title: "Acknowledge alerts", body: "Alerts stay until someone acknowledges them, so nothing is lost between shifts.", target: btn("Acknowledge", "main") },
  ],
  housekeeping: [
    open("/housekeeping", "Housekeeping"),
    { title: "The cleaning board", body: "Pending, in progress and completed jobs. A bed is turned around automatically when a patient is discharged.", target: btn("Tasks", "main"), route: "/housekeeping" },
    { title: "Raise a job", body: "For a spill in a corridor or the OT lobby — say where, and who should do it.", target: btn("New task", "main") },
    { title: "Is the room ready?", body: "Every bed: ready, being cleaned, waiting to be verified, or occupied.", target: btn("Room readiness", "main") },
    { title: "Linen", body: "Where every sheet and gown is: store, wards, soiled, laundry.", target: btn("Linen", "main") },
  ],
  tasks: [
    open("/tasks", "Task Board", "T"),
    { title: "Create a task", body: "A title, who it's for, a priority and a due date.", target: btn("New Task", "main"), route: "/tasks", hint: "click" },
    { title: "Give it a title", body: "Say what needs doing in a few words.", target: field("Task Title") },
    { title: "Give it an owner", body: "Pick who is responsible — they'll see it on their board.", target: field("Assign To") },
    { title: "Set a deadline", body: "A due date keeps it from being forgotten.", target: field("Due Date") },
    { title: "Create it", body: "It appears on the board; move it along as work progresses.", target: { text: "Create Task", scope: "dialog", kind: "button" } },
  ],
  "apply-leave": [
    open("/hr/leave", "Leave"),
    { title: "Apply for leave", body: "Opens the request form.", target: btn("+ Apply for leave", "main"), route: "/hr/leave", hint: "click" },
    { title: "Choose the type", body: "Casual, sick, earned or without pay — your balance for each is shown.", target: btn("Casual leave", "dialog") },
    { title: "Send it", body: "Your manager is told and decides. You can follow it under Requests.", target: { text: "Apply", scope: "dialog", kind: "button" } },
    { title: "Check your balance", body: "Balances shows what you have left of each kind.", target: btn("Balances", "main") },
  ],
  "approve-leave": [
    open("/hr/leave", "Leave"),
    { title: "Requests", body: "Everyone's requests, newest first.", target: btn("Requests", "main"), route: "/hr/leave" },
    { title: "Waiting for you", body: "Filter to the requests nobody has decided yet.", target: btn("Waiting", "main") },
    { title: "Who else is off", body: "The calendar shows who is away on those days before you approve.", target: btn("Calendar", "main") },
  ],
  "add-staff": [
    open("/staff", "Staff", "Z"),
    { title: "Add a colleague", body: "Creates their login and their place in the directory.", target: btn("Add Staff", "main"), route: "/staff", hint: "click" },
    { title: "Name and role", body: "The role decides what they can see and do.", target: field("Full Name") },
    { title: "Pick the role", body: "Doctor, nurse, receptionist, pharmacist… each has its own access.", target: field("Role") },
    { title: "Fine-tune access", body: "Access Control shows what each role can do and lets you adjust it.", target: btn("Access Control", "main") },
  ],
  billing: [
    open("/billing", "Billing", "G"),
    { title: "Raise a bill", body: "Pick the patient, add the charges and take payment now or later.", target: btn("New Bill", "main"), route: "/billing" },
    { title: "Look one up", body: "Find a bill by number or patient.", target: btn("Bill Lookup", "main") },
    { title: "Payouts", body: "What is owed to doctors and referrers from these bills.", target: btn("Payouts", "main") },
    { title: "Unpaid bills", body: "Filter to Pending to see what still has to be collected.", target: btn("Pending", "main") },
  ],
  "hospital-setup": [
    open("/hospital-setup", "Hospital setup"),
    { title: "Identity and branches", body: "The hospital's name, GST, address and branches.", target: btn("Identity & branches", "main"), route: "/hospital-setup" },
    { title: "Charges and posting", body: "How charges are rounded, taxed and posted to accounts.", target: btn("Charges & posting", "main") },
    { title: "Clinical policies", body: "Approval limits and the rules clinical staff work to.", target: btn("Clinical policies", "main") },
  ],
  masters: [
    open("/masters", "Masters"),
    { title: "Everything else uses these", body: "Services, prices, payers, departments — set them once, and registration, billing and reports all use them.", target: btn("Services", "main"), route: "/masters" },
    { title: "Find a master", body: "Search the lists by name.", target: { text: "Find a master", scope: "main", kind: "input" }, hint: "try" },
  ],
  settings: [
    open("/settings", "Settings"),
    { title: "Clinic profile", body: "The name, logo and colour the whole app wears.", target: btn("Profile & branding", "main"), route: "/settings" },
    { title: "Billing", body: "Invoice details and tax defaults.", target: btn("Billing", "main") },
    { title: "Security", body: "Password rules and sign-in settings.", target: btn("Security", "main") },
    { title: "Appearance", body: "Light or dark, and the brand colour.", target: btn("Appearance", "main") },
  ],
  analytics: [
    open("/analytics", "Analytics", "S"),
    { title: "The trend", body: "Collections and footfall for the day, week or month, set against the period before.", target: { text: "Day", scope: "main", kind: "button" }, route: "/analytics" },
    { title: "Reports in one place", body: "The Reports tab lists every report; AI monitor shows how the AI features are used.", target: btn("Reports", "main") },
  ],
  reports: [
    open("/reports", "Reports"),
    { title: "Pick a category", body: "Cashier, billing, registers, clinical, accounts, retention and stores.", target: btn("Cashier & collection", "main"), route: "/reports" },
    { title: "Or search", body: "Type part of a report's name.", target: { text: "Search reports", scope: "main", kind: "input" }, hint: "try" },
    { title: "Open one", body: "Choose a date range, then export to CSV or print it.", target: btn("Day book - OPD", "main") },
  ],
  audit: [
    open("/audit", "Audit"),
    { title: "Every change, recorded", body: "Who did what and when, newest first. Open a row for the detail.", target: { text: "Search summary", scope: "main", kind: "input" }, route: "/audit" },
    { title: "Filter it", body: "By module, action, person or date.", target: { text: "Module", scope: "main", kind: "input" } },
    { title: "Prove it hasn't been altered", body: "Each entry is linked to the one before it. Verify chain checks nothing was edited or removed.", target: btn("Verify chain", "main") },
  ],
};
