import { type Bed } from "@shared/types";

export const beds: Bed[] = [
  // General Ward (10 beds)
  { id: 1,  bedNumber: "G-01", ward: "General Ward",    patientName: "Suresh Kumar",   patientId: "HMS-0012", status: "Occupied"     },
  { id: 2,  bedNumber: "G-02", ward: "General Ward",    status: "Available"  },
  { id: 3,  bedNumber: "G-03", ward: "General Ward",    status: "Available"  },
  { id: 4,  bedNumber: "G-04", ward: "General Ward",    patientName: "Grace Mitchell", patientId: "HMS-0007", status: "Occupied"  },
  { id: 5,  bedNumber: "G-05", ward: "General Ward",    status: "Reserved"   },
  { id: 6,  bedNumber: "G-06", ward: "General Ward",    status: "Available"  },
  { id: 7,  bedNumber: "G-07", ward: "General Ward",    patientName: "Suresh Kumar",   patientId: "HMS-0012", status: "Occupied"  },
  { id: 8,  bedNumber: "G-08", ward: "General Ward",    status: "Maintenance"},
  { id: 9,  bedNumber: "G-09", ward: "General Ward",    status: "Available"  },
  { id: 10, bedNumber: "G-10", ward: "General Ward",    status: "Available"  },

  // ICU (6 beds)
  { id: 11, bedNumber: "I-01", ward: "ICU",             patientName: "Noah Carter",    patientId: "HMS-0006", status: "Occupied"  },
  { id: 12, bedNumber: "I-02", ward: "ICU",             patientName: "Rajan Mehta",    patientId: "HMS-0011", status: "Occupied"  },
  { id: 13, bedNumber: "I-03", ward: "ICU",             status: "Available"  },
  { id: 14, bedNumber: "I-04", ward: "ICU",             status: "Reserved"   },
  { id: 15, bedNumber: "I-05", ward: "ICU",             status: "Available"  },
  { id: 16, bedNumber: "I-06", ward: "ICU",             status: "Maintenance"},

  // Cardiology Ward (6 beds)
  { id: 17, bedNumber: "C-01", ward: "Cardiology Ward", status: "Available"  },
  { id: 18, bedNumber: "C-02", ward: "Cardiology Ward", patientName: "Rajan Mehta",    patientId: "HMS-0011", status: "Occupied"  },
  { id: 19, bedNumber: "C-03", ward: "Cardiology Ward", status: "Available"  },
  { id: 20, bedNumber: "C-04", ward: "Cardiology Ward", status: "Reserved"   },
  { id: 21, bedNumber: "C-05", ward: "Cardiology Ward", status: "Available"  },
  { id: 22, bedNumber: "C-06", ward: "Cardiology Ward", status: "Available"  },

  // Surgery Ward (8 beds)
  { id: 23, bedNumber: "S-01", ward: "Surgery Ward",    status: "Available"  },
  { id: 24, bedNumber: "S-02", ward: "Surgery Ward",    status: "Available"  },
  { id: 25, bedNumber: "S-03", ward: "Surgery Ward",    patientName: "Divya Patel",    patientId: "HMS-0014", status: "Occupied"  },
  { id: 26, bedNumber: "S-04", ward: "Surgery Ward",    status: "Reserved"   },
  { id: 27, bedNumber: "S-05", ward: "Surgery Ward",    status: "Available"  },
  { id: 28, bedNumber: "S-06", ward: "Surgery Ward",    status: "Maintenance"},
  { id: 29, bedNumber: "S-07", ward: "Surgery Ward",    status: "Available"  },
  { id: 30, bedNumber: "S-08", ward: "Surgery Ward",    status: "Available"  },

  // Maternity Ward (6 beds)
  { id: 31, bedNumber: "M-01", ward: "Maternity Ward",  patientName: "Meena Reddy",    patientId: "HMS-0013", status: "Occupied"  },
  { id: 32, bedNumber: "M-02", ward: "Maternity Ward",  status: "Available"  },
  { id: 33, bedNumber: "M-03", ward: "Maternity Ward",  status: "Available"  },
  { id: 34, bedNumber: "M-04", ward: "Maternity Ward",  status: "Reserved"   },
  { id: 35, bedNumber: "M-05", ward: "Maternity Ward",  status: "Available"  },
  { id: 36, bedNumber: "M-06", ward: "Maternity Ward",  status: "Available"  },
];
