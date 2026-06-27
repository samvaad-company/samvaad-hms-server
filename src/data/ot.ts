import { type OtRecord } from "@/types";

export const otRecords: OtRecord[] = [
  { id: 1, patientName: "Divya Patel",    procedure: "Laparoscopic Cholecystectomy",     otRoom: "OT-1", surgeon: "Dr. Ava Johnson",    anesthetist: "Dr. Priya Sharma", scheduledDate: "15 Nov 2025", scheduledTime: "8:00 AM",  status: "Completed"  },
  { id: 2, patientName: "Karan Joshi",    procedure: "Open Reduction Internal Fixation",  otRoom: "OT-2", surgeon: "Dr. James Parker",   anesthetist: "Dr. Priya Sharma", scheduledDate: "8 Nov 2025",  scheduledTime: "9:00 AM",  status: "Completed"  },
  { id: 3, patientName: "Rajan Mehta",    procedure: "Coronary Angioplasty (PTCA)",       otRoom: "OT-3", surgeon: "Dr. Noah Carter",    anesthetist: "Dr. Emily Cooper", scheduledDate: "11 Nov 2025", scheduledTime: "7:30 AM",  status: "Completed"  },
  { id: 4, patientName: "Grace Mitchell", procedure: "Appendectomy (Emergency)",          otRoom: "OT-1", surgeon: "Dr. Ava Johnson",    anesthetist: "Dr. Emily Cooper", scheduledDate: "14 Nov 2025", scheduledTime: "11:00 PM", status: "Completed"  },
  { id: 5, patientName: "Suresh Kumar",   procedure: "Bronchoscopy + BAL",               otRoom: "OT-2", surgeon: "Dr. Ethan Miller",   anesthetist: "Dr. Priya Sharma", scheduledDate: "10 Nov 2025", scheduledTime: "10:00 AM", status: "Completed"  },
  { id: 6, patientName: "Anjali Singh",   procedure: "Lumbar Puncture (Diagnostic)",     otRoom: "OT-3", surgeon: "Dr. Grace Mitchell", anesthetist: "Dr. Emily Cooper", scheduledDate: "19 Nov 2025", scheduledTime: "9:30 AM",  status: "Scheduled"  },
  { id: 7, patientName: "Isabella Reed",  procedure: "Thyroidectomy (Partial)",          otRoom: "OT-1", surgeon: "Dr. James Parker",   anesthetist: "Dr. Priya Sharma", scheduledDate: "22 Nov 2025", scheduledTime: "8:00 AM",  status: "Scheduled"  },
  { id: 8, patientName: "William Scott",  procedure: "Discectomy L4-L5",                otRoom: "OT-2", surgeon: "Dr. James Parker",   anesthetist: "Dr. Emily Cooper", scheduledDate: "25 Nov 2025", scheduledTime: "7:30 AM",  status: "Scheduled"  },
];
