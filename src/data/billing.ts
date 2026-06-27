import { type Bill } from "@/types";

export const bills: Bill[] = [
  { id: 1,  billNumber: "INV-20251101", patientName: "Olivia Turner",   type: "OPD",      date: "8 Nov 2025",  amount: 500,   discount: 0,    gst: 45,   total: 545,   status: "Paid"    },
  { id: 2,  billNumber: "INV-20251102", patientName: "Olivia Turner",   type: "Lab",      date: "8 Nov 2025",  amount: 350,   discount: 0,    gst: 0,    total: 350,   status: "Paid"    },
  { id: 3,  billNumber: "INV-20251103", patientName: "Ethan Miller",    type: "OPD",      date: "8 Nov 2025",  amount: 500,   discount: 50,   gst: 40.5, total: 490.5, status: "Paid"    },
  { id: 4,  billNumber: "INV-20251104", patientName: "Noah Carter",     type: "Pharmacy", date: "13 Nov 2025", amount: 1240,  discount: 0,    gst: 111.6,total: 1351.6,status: "Paid"    },
  { id: 5,  billNumber: "INV-20251105", patientName: "Ava Johnson",     type: "OPD",      date: "12 Nov 2025", amount: 600,   discount: 0,    gst: 54,   total: 654,   status: "Pending" },
  { id: 6,  billNumber: "INV-20251106", patientName: "Grace Mitchell",  type: "IPD",      date: "17 Nov 2025", amount: 18500, discount: 1000, gst: 1575, total: 19075, status: "Partial" },
  { id: 7,  billNumber: "INV-20251107", patientName: "Isabella Reed",   type: "OPD",      date: "22 Nov 2025", amount: 500,   discount: 0,    gst: 45,   total: 545,   status: "Pending" },
  { id: 8,  billNumber: "INV-20251108", patientName: "William Scott",   type: "Lab",      date: "8 Nov 2025",  amount: 1200,  discount: 0,    gst: 0,    total: 1200,  status: "Paid"    },
  { id: 9,  billNumber: "INV-20251109", patientName: "Liam Brooks",     type: "OPD",      date: "9 Nov 2025",  amount: 500,   discount: 0,    gst: 45,   total: 545,   status: "Refunded"},
  { id: 10, billNumber: "INV-20251110", patientName: "Karan Joshi",     type: "Lab",      date: "8 Nov 2025",  amount: 2500,  discount: 200,  gst: 207,  total: 2507,  status: "Pending" },
];
