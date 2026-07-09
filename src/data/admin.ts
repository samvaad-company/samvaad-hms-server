export const hospitalSettings = {
  name: "Samvaad Multispecialty Hospital",
  logo: null,
  address: "42, Health City Road, Andheri East",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400069",
  phone: "+91 22 4567 8900",
  mobile: "+91 98765 43000",
  email: "admin@samvaadhospital.in",
  website: "www.samvaadhospital.in",
  gstNumber: "27AABCS1429B1Z2",
  panNumber: "AABCS1429B",
  regNumber: "MH/HO/2015/0042",
  workingHours: [
    { day: "Monday",    morning: "9:00 AM – 1:00 PM", evening: "4:00 PM – 8:00 PM", open: true  },
    { day: "Tuesday",   morning: "9:00 AM – 1:00 PM", evening: "4:00 PM – 8:00 PM", open: true  },
    { day: "Wednesday", morning: "9:00 AM – 1:00 PM", evening: "4:00 PM – 8:00 PM", open: true  },
    { day: "Thursday",  morning: "9:00 AM – 1:00 PM", evening: "4:00 PM – 8:00 PM", open: true  },
    { day: "Friday",    morning: "9:00 AM – 1:00 PM", evening: "4:00 PM – 8:00 PM", open: true  },
    { day: "Saturday",  morning: "9:00 AM – 2:00 PM", evening: "—",                  open: true  },
    { day: "Sunday",    morning: "—",                  evening: "—",                  open: false },
  ],
};

export const departments = [
  { id: 1,  name: "OPD",             head: "Dr. Olivia Turner",   ext: "101" },
  { id: 2,  name: "Paediatrics",     head: "Dr. Sophia Adams",    ext: "102" },
  { id: 3,  name: "Physiotherapy",   head: "Dr. Emily Cooper",    ext: "103" },
  { id: 4,  name: "Pulmonology",     head: "Dr. Ethan Miller",    ext: "104" },
  { id: 5,  name: "Internal Medicine",head: "Dr. Daniel Reed",    ext: "105" },
  { id: 6,  name: "Surgery",         head: "Dr. Ava Johnson",     ext: "106" },
  { id: 7,  name: "Neurology",       head: "Dr. Grace Mitchell",  ext: "107" },
  { id: 8,  name: "Cardiology",      head: "Dr. Noah Carter",     ext: "108" },
  { id: 9,  name: "Orthopaedics",    head: "Dr. James Parker",    ext: "109" },
  { id: 10, name: "Dermatology",     head: "Dr. Priya Sharma",    ext: "110" },
  { id: 11, name: "Pharmacy",        head: "Arun Tiwari",         ext: "201" },
  { id: 12, name: "Laboratory",      head: "Sunita Rao",          ext: "202" },
  { id: 13, name: "Radiology",       head: "Anita Pillai",        ext: "203" },
  { id: 14, name: "Administration",  head: "Deepak Nair",         ext: "301" },
  { id: 15, name: "Billing",         head: "Kavitha Krishnan",    ext: "302" },
];

export interface AdminUserSeed {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  lastLogin: string;
  status: string;
  /** Links a Doctor-role login to its doctor record (see src/data/doctors.ts). */
  doctorId?: number;
}

export const adminUsers: AdminUserSeed[] = [
  { id: 1,  name: "Dr. Kevin Carter",   email: "kevin.carter@samvaadhospital.in",   role: "Super Admin",    department: "Administration", lastLogin: "Today, 9:05 AM",  status: "Active"   },
  { id: 2,  name: "Deepak Nair",        email: "deepak.nair@samvaadhospital.in",    role: "Receptionist",   department: "Administration", lastLogin: "Today, 8:50 AM",  status: "Active"   },
  { id: 3,  name: "Kavitha Krishnan",   email: "kavitha.krishnan@samvaadhospital.in",role: "Billing Exec",  department: "Billing",        lastLogin: "Today, 9:30 AM",  status: "Active"   },
  { id: 4,  name: "Arun Tiwari",        email: "arun.tiwari@samvaadhospital.in",    role: "Pharmacist",     department: "Pharmacy",       lastLogin: "Today, 9:00 AM",  status: "Active"   },
  { id: 5,  name: "Sunita Rao",         email: "sunita.rao@samvaadhospital.in",     role: "Lab Technician", department: "Laboratory",     lastLogin: "Today, 8:45 AM",  status: "Active"   },
  { id: 6,  name: "Rekha Menon",        email: "rekha.menon@samvaadhospital.in",    role: "Head Nurse",     department: "ICU",            lastLogin: "Today, 8:00 AM",  status: "Active"   },
  { id: 7,  name: "Rahul Saxena",       email: "rahul.saxena@samvaadhospital.in",   role: "IT Admin",       department: "IT",             lastLogin: "Yesterday, 6 PM", status: "Active"   },
  { id: 8,  name: "Vijay Kumar",        email: "vijay.kumar@samvaadhospital.in",    role: "Driver",         department: "Emergency",      lastLogin: "3 days ago",       status: "Active"   },
  { id: 9,  name: "Dr. Sophia Adams",   email: "sophia.adams@samvaadhospital.in",   role: "Doctor",         department: "Paediatrics",    lastLogin: "Today, 9:15 AM",  status: "Active", doctorId: 2 },
  { id: 10, name: "Dr. Daniel Reed",    email: "daniel.reed@samvaadhospital.in",    role: "Doctor",         department: "Internal Medicine", lastLogin: "Today, 8:40 AM", status: "Active", doctorId: 5 },
];

export const rolePermissions = {
  "Super Admin":    { patients: true,  appointments: true,  billing: true,  pharmacy: true,  lab: true,  reports: true,  admin: true,  ipd: true  },
  "Receptionist":   { patients: true,  appointments: true,  billing: false, pharmacy: false, lab: false, reports: false, admin: false, ipd: false },
  "Billing Exec":   { patients: true,  appointments: true,  billing: true,  pharmacy: false, lab: false, reports: true,  admin: false, ipd: false },
  "Pharmacist":     { patients: false, appointments: false, billing: false, pharmacy: true,  lab: false, reports: false, admin: false, ipd: false },
  "Lab Technician": { patients: false, appointments: false, billing: false, pharmacy: false, lab: true,  reports: false, admin: false, ipd: false },
  "Head Nurse":     { patients: true,  appointments: true,  billing: false, pharmacy: true,  lab: true,  reports: false, admin: false, ipd: true  },
  "IT Admin":       { patients: false, appointments: false, billing: false, pharmacy: false, lab: false, reports: false, admin: true,  ipd: false },
};
