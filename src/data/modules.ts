/**
 * Seed data for the service modules: blood bank, radiology, ambulance,
 * birth/death records, TPA, finance, and general inventory.
 */
import type {
  Gender,
  BloodGroup,
  BloodComponent,
  DonorStatus,
  BloodIssueStatus,
  RadiologyStatus,
  AmbulanceStatus,
  AmbulanceCallStatus,
  TpaStatus,
  ClaimStatus,
  InventoryStatus,
} from "@/types";

// ── Blood bank ───────────────────────────────────────────────────────────────

export interface BloodDonorSeed {
  id: number; name: string; age: number; gender: Gender; bloodGroup: BloodGroup;
  phone: string; lastDonationDate: string; totalDonations: number; status: DonorStatus;
}

export const bloodDonors: BloodDonorSeed[] = [
  { id: 1, name: "Vikram Singh",    age: 32, gender: "Male",   bloodGroup: "O+",  phone: "+91 98220 11223", lastDonationDate: "12 Sep 2025", totalDonations: 8, status: "Eligible" },
  { id: 2, name: "Anita Deshmukh",  age: 28, gender: "Female", bloodGroup: "A+",  phone: "+91 99870 44556", lastDonationDate: "3 Oct 2025",  totalDonations: 4, status: "Eligible" },
  { id: 3, name: "Ravi Patil",      age: 41, gender: "Male",   bloodGroup: "B+",  phone: "+91 98500 77889", lastDonationDate: "18 Aug 2025", totalDonations: 12, status: "Eligible" },
  { id: 4, name: "Meera Kulkarni",  age: 35, gender: "Female", bloodGroup: "AB+", phone: "+91 97650 22334", lastDonationDate: "25 Oct 2025", totalDonations: 6, status: "Deferred" },
  { id: 5, name: "Sanjay Gupta",    age: 45, gender: "Male",   bloodGroup: "O-",  phone: "+91 98230 55667", lastDonationDate: "9 Jul 2025",  totalDonations: 15, status: "Eligible" },
  { id: 6, name: "Pooja Sharma",    age: 26, gender: "Female", bloodGroup: "B-",  phone: "+91 99220 88990", lastDonationDate: "1 Nov 2025",  totalDonations: 2, status: "Eligible" },
];

export interface BloodStockSeed {
  id: number; bloodGroup: BloodGroup; component: BloodComponent; units: number;
}

export const bloodStock: BloodStockSeed[] = [
  { id: 1,  bloodGroup: "A+",  component: "Whole Blood", units: 12 },
  { id: 2,  bloodGroup: "A-",  component: "Whole Blood", units: 3 },
  { id: 3,  bloodGroup: "B+",  component: "Whole Blood", units: 9 },
  { id: 4,  bloodGroup: "B-",  component: "Whole Blood", units: 2 },
  { id: 5,  bloodGroup: "AB+", component: "Whole Blood", units: 5 },
  { id: 6,  bloodGroup: "AB-", component: "Whole Blood", units: 1 },
  { id: 7,  bloodGroup: "O+",  component: "Whole Blood", units: 15 },
  { id: 8,  bloodGroup: "O-",  component: "Whole Blood", units: 4 },
  { id: 9,  bloodGroup: "A+",  component: "Plasma",      units: 6 },
  { id: 10, bloodGroup: "B+",  component: "Plasma",      units: 4 },
  { id: 11, bloodGroup: "O+",  component: "Plasma",      units: 8 },
  { id: 12, bloodGroup: "A+",  component: "Platelets",   units: 3 },
  { id: 13, bloodGroup: "O+",  component: "Platelets",   units: 5 },
  { id: 14, bloodGroup: "B+",  component: "RBC",         units: 4 },
  { id: 15, bloodGroup: "O+",  component: "RBC",         units: 6 },
];

export interface BloodIssueSeed {
  id: number; patientName: string; bloodGroup: BloodGroup; component: BloodComponent;
  units: number; doctor: string; date: string; amount: number; status: BloodIssueStatus;
}

export const bloodIssues: BloodIssueSeed[] = [
  { id: 1, patientName: "Rajan Mehta",   bloodGroup: "B+", component: "Whole Blood", units: 2, doctor: "Dr. Priya Sharma",  date: "2 Nov 2025", amount: 3000, status: "Issued" },
  { id: 2, patientName: "Noah Carter",   bloodGroup: "O+", component: "Platelets",   units: 1, doctor: "Dr. Arjun Patel",   date: "4 Nov 2025", amount: 2200, status: "Issued" },
  { id: 3, patientName: "Grace Mitchell",bloodGroup: "A+", component: "Plasma",      units: 2, doctor: "Dr. Kavita Reddy",  date: "6 Nov 2025", amount: 2800, status: "Pending" },
];

// ── Radiology ────────────────────────────────────────────────────────────────

export interface RadiologySeed {
  id: number; patientName: string; patientAge: number; testName: string;
  scanStatus: "Pending" | "Done"; reportStatus: "Pending" | "Ready";
  date: string; amount: number; status: RadiologyStatus;
}

export const radiologyTests: RadiologySeed[] = [
  { id: 1, patientName: "Aarav Sharma",   patientAge: 34, testName: "X-Ray Chest PA",       scanStatus: "Done",    reportStatus: "Ready",   date: "3 Nov 2025", amount: 400,  status: "Report Ready" },
  { id: 2, patientName: "Grace Mitchell", patientAge: 58, testName: "CT Scan Brain",         scanStatus: "Done",    reportStatus: "Pending", date: "5 Nov 2025", amount: 3500, status: "Scan Done" },
  { id: 3, patientName: "Rajan Mehta",    patientAge: 61, testName: "Ultrasound Abdomen",    scanStatus: "Pending", reportStatus: "Pending", date: "7 Nov 2025", amount: 900,  status: "Pending" },
  { id: 4, patientName: "Ishita Verma",   patientAge: 29, testName: "MRI Knee",              scanStatus: "Done",    reportStatus: "Ready",   date: "6 Nov 2025", amount: 6000, status: "Report Ready" },
  { id: 5, patientName: "Noah Carter",    patientAge: 45, testName: "X-Ray Left Femur",      scanStatus: "Pending", reportStatus: "Pending", date: "8 Nov 2025", amount: 450,  status: "Pending" },
];

// ── Ambulance ────────────────────────────────────────────────────────────────

export interface AmbulanceSeed {
  id: number; vehicleNumber: string; model: string; driverName: string;
  driverPhone: string; status: AmbulanceStatus;
}

export const ambulances: AmbulanceSeed[] = [
  { id: 1, vehicleNumber: "MH-12-AB-4471", model: "Force Traveller (ALS)", driverName: "Ramesh Jadhav",  driverPhone: "+91 98220 33445", status: "Available" },
  { id: 2, vehicleNumber: "MH-12-CD-8892", model: "Maruti Eeco (BLS)",     driverName: "Sunil Pawar",    driverPhone: "+91 99870 66778", status: "On Call" },
  { id: 3, vehicleNumber: "MH-14-EF-2210", model: "Tata Winger (ALS)",     driverName: "Ganesh More",    driverPhone: "+91 98500 99001", status: "Available" },
  { id: 4, vehicleNumber: "MH-12-GH-5567", model: "Mahindra Bolero (BLS)", driverName: "Vijay Shinde",   driverPhone: "+91 97650 11223", status: "Maintenance" },
];

export interface AmbulanceCallSeed {
  id: number; patientName: string; phone: string; pickupLocation: string; dropLocation: string;
  ambulanceId: number | null; vehicleNumber: string; driverName: string;
  date: string; time: string; amount: number; status: AmbulanceCallStatus;
}

export const ambulanceCalls: AmbulanceCallSeed[] = [
  { id: 1, patientName: "Suresh Kumar",  phone: "+91 98220 12121", pickupLocation: "Kothrud, Pune",     dropLocation: "Samvaad Hospital", ambulanceId: 2, vehicleNumber: "MH-12-CD-8892", driverName: "Sunil Pawar",   date: "8 Nov 2025", time: "9:40 AM",  amount: 1500, status: "Dispatched" },
  { id: 2, patientName: "Leela Nair",    phone: "+91 99870 34343", pickupLocation: "Baner, Pune",       dropLocation: "Samvaad Hospital", ambulanceId: 1, vehicleNumber: "MH-12-AB-4471", driverName: "Ramesh Jadhav", date: "6 Nov 2025", time: "3:15 PM",  amount: 1200, status: "Completed" },
  { id: 3, patientName: "Mohan Joshi",   phone: "+91 98500 56565", pickupLocation: "Samvaad Hospital",  dropLocation: "Deenanath Hospital", ambulanceId: 3, vehicleNumber: "MH-14-EF-2210", driverName: "Ganesh More", date: "4 Nov 2025", time: "11:05 AM", amount: 2000, status: "Completed" },
];

// ── Birth & death records ────────────────────────────────────────────────────

export interface BirthRecordSeed {
  id: number; childName: string; gender: Gender; date: string; time: string;
  weightKg: number; motherName: string; fatherName: string; phone: string; address: string;
}

export const birthRecords: BirthRecordSeed[] = [
  { id: 1, childName: "Baby of Sneha Kale",  gender: "Female", date: "2 Nov 2025", time: "4:32 AM",  weightKg: 3.1, motherName: "Sneha Kale",   fatherName: "Amit Kale",    phone: "+91 98220 77665", address: "Kothrud, Pune" },
  { id: 2, childName: "Baby of Ritu Saxena", gender: "Male",   date: "5 Nov 2025", time: "11:18 PM", weightKg: 2.8, motherName: "Ritu Saxena",  fatherName: "Deepak Saxena",phone: "+91 99870 33221", address: "Aundh, Pune" },
];

export interface DeathRecordSeed {
  id: number; deceasedName: string; gender: Gender; age: number; date: string; time: string;
  guardianName: string; cause: string; phone: string; address: string;
}

export const deathRecords: DeathRecordSeed[] = [
  { id: 1, deceasedName: "Shantaram Bhosale", gender: "Male", age: 82, date: "1 Nov 2025", time: "6:50 AM", guardianName: "Prakash Bhosale", cause: "Cardiac arrest", phone: "+91 98500 44332", address: "Karve Nagar, Pune" },
];

// ── TPA ──────────────────────────────────────────────────────────────────────

export interface TpaSeed {
  id: number; name: string; code: string; contactPerson: string; phone: string;
  email: string; address: string; status: TpaStatus;
}

export const tpas: TpaSeed[] = [
  { id: 1, name: "MediAssist India",       code: "TPA-001", contactPerson: "Rahul Verma",   phone: "+91 80 4011 2233", email: "claims@mediassist.in",    address: "Bengaluru", status: "Active" },
  { id: 2, name: "Star Health TPA",        code: "TPA-002", contactPerson: "Sunita Iyer",   phone: "+91 44 2830 4455", email: "tpa@starhealth.in",       address: "Chennai",   status: "Active" },
  { id: 3, name: "Paramount Health",       code: "TPA-003", contactPerson: "Nikhil Shah",   phone: "+91 22 6662 7788", email: "support@phspl.com",       address: "Mumbai",    status: "Active" },
  { id: 4, name: "Vidal Health TPA",       code: "TPA-004", contactPerson: "Asha Menon",    phone: "+91 80 4126 9900", email: "care@vidalhealth.com",    address: "Bengaluru", status: "Inactive" },
];

export interface TpaClaimSeed {
  id: number; tpaId: number; tpaName: string; patientName: string; billNumber: string;
  claimAmount: number; approvedAmount: number; date: string; status: ClaimStatus;
}

export const tpaClaims: TpaClaimSeed[] = [
  { id: 1, tpaId: 1, tpaName: "MediAssist India", patientName: "Rajan Mehta",    billNumber: "INV-00000004", claimAmount: 48000, approvedAmount: 45000, date: "3 Nov 2025", status: "Approved" },
  { id: 2, tpaId: 2, tpaName: "Star Health TPA",  patientName: "Grace Mitchell", billNumber: "INV-00000007", claimAmount: 32000, approvedAmount: 0,     date: "6 Nov 2025", status: "In Review" },
  { id: 3, tpaId: 3, tpaName: "Paramount Health", patientName: "Noah Carter",    billNumber: "INV-00000002", claimAmount: 15500, approvedAmount: 15500, date: "28 Oct 2025", status: "Settled" },
];

// ── Finance ──────────────────────────────────────────────────────────────────

export interface FinanceEntrySeed {
  id: number; category: string; description: string; invoiceNumber: string;
  amount: number; date: string;
}

export const financeIncomes: FinanceEntrySeed[] = [
  { id: 1, category: "Canteen Rent",        description: "November canteen rent",          invoiceNumber: "INC-0001", amount: 25000, date: "1 Nov 2025" },
  { id: 2, category: "Parking Fees",        description: "October parking collections",    invoiceNumber: "INC-0002", amount: 18400, date: "2 Nov 2025" },
  { id: 3, category: "Health Campaign",     description: "Corporate health-checkup camp",  invoiceNumber: "INC-0003", amount: 62000, date: "5 Nov 2025" },
];

export const financeExpenses: FinanceEntrySeed[] = [
  { id: 1, category: "Electricity Bill",      description: "October electricity bill",     invoiceNumber: "EXP-0001", amount: 84500, date: "3 Nov 2025" },
  { id: 2, category: "Generator Fuel",        description: "Diesel top-up 200L",           invoiceNumber: "EXP-0002", amount: 19200, date: "4 Nov 2025" },
  { id: 3, category: "Equipment Maintenance", description: "AMC — ventilators Q3",         invoiceNumber: "EXP-0003", amount: 45000, date: "6 Nov 2025" },
  { id: 4, category: "Housekeeping",          description: "Housekeeping contract Nov",    invoiceNumber: "EXP-0004", amount: 38000, date: "7 Nov 2025" },
];

// ── Inventory (non-pharmacy) ─────────────────────────────────────────────────

export interface InventoryItemSeed {
  id: number; name: string; category: string; unit: string; stock: number;
  minStock: number; supplier: string; status: InventoryStatus;
}

export const inventoryItems: InventoryItemSeed[] = [
  { id: 1, name: "Bed Sheets (White)",     category: "Linen",             unit: "pcs",   stock: 140, minStock: 50, supplier: "Shree Textiles",      status: "In Stock" },
  { id: 2, name: "Disposable Syringes 5ml",category: "Consumables",       unit: "boxes", stock: 12,  minStock: 20, supplier: "MedEquip Supplies",   status: "Low Stock" },
  { id: 3, name: "Surgical Gloves (M)",    category: "PPE",               unit: "boxes", stock: 65,  minStock: 30, supplier: "SafeHands Ltd",       status: "In Stock" },
  { id: 4, name: "N95 Masks",              category: "PPE",               unit: "boxes", stock: 0,   minStock: 25, supplier: "SafeHands Ltd",       status: "Out of Stock" },
  { id: 5, name: "IV Stands",              category: "Medical Equipment", unit: "pcs",   stock: 28,  minStock: 10, supplier: "HospiEquip India",    status: "In Stock" },
  { id: 6, name: "Wheelchairs",            category: "Medical Equipment", unit: "pcs",   stock: 8,   minStock: 5,  supplier: "HospiEquip India",    status: "In Stock" },
  { id: 7, name: "Dressing Cotton Rolls",  category: "Surgical Supplies", unit: "rolls", stock: 45,  minStock: 60, supplier: "MedEquip Supplies",   status: "Low Stock" },
  { id: 8, name: "Staff Uniforms (Nurse)", category: "Uniforms",          unit: "sets",  stock: 34,  minStock: 15, supplier: "Shree Textiles",      status: "In Stock" },
];

export interface InventoryIssueSeed {
  id: number; itemId: number; itemName: string; department: string; quantity: number;
  issuedTo: string; date: string; note: string;
}

export const inventoryIssues: InventoryIssueSeed[] = [
  { id: 1, itemId: 1, itemName: "Bed Sheets (White)",      department: "General Ward", quantity: 20, issuedTo: "Sister Mary Thomas", date: "5 Nov 2025", note: "Weekly linen change" },
  { id: 2, itemId: 3, itemName: "Surgical Gloves (M)",     department: "OT",           quantity: 5,  issuedTo: "OT Store",           date: "6 Nov 2025", note: "" },
  { id: 3, itemId: 7, itemName: "Dressing Cotton Rolls",   department: "Emergency",    quantity: 10, issuedTo: "ER Desk",            date: "7 Nov 2025", note: "Trauma kit restock" },
];
