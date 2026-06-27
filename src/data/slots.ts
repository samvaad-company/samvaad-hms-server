export interface Slot {
  time: string;
  available: boolean;
  period: "Morning" | "Evening";
}

export interface DoctorSlots {
  doctorId: number;
  doctorName: string;
  date: string;
  slots: Slot[];
}

const generateSlots = (morningStart: string, eveningStart: string): Slot[] => {
  const morning: Slot[] = [
    { time: "9:00 AM",  available: false, period: "Morning" },
    { time: "9:15 AM",  available: true,  period: "Morning" },
    { time: "9:30 AM",  available: false, period: "Morning" },
    { time: "9:45 AM",  available: true,  period: "Morning" },
    { time: "10:00 AM", available: false, period: "Morning" },
    { time: "10:15 AM", available: true,  period: "Morning" },
    { time: "10:30 AM", available: true,  period: "Morning" },
    { time: "10:45 AM", available: false, period: "Morning" },
    { time: "11:00 AM", available: true,  period: "Morning" },
    { time: "11:15 AM", available: true,  period: "Morning" },
    { time: "11:30 AM", available: false, period: "Morning" },
    { time: "11:45 AM", available: true,  period: "Morning" },
  ];
  const evening: Slot[] = [
    { time: "4:00 PM",  available: true,  period: "Evening" },
    { time: "4:15 PM",  available: true,  period: "Evening" },
    { time: "4:30 PM",  available: false, period: "Evening" },
    { time: "4:45 PM",  available: true,  period: "Evening" },
    { time: "5:00 PM",  available: false, period: "Evening" },
    { time: "5:15 PM",  available: true,  period: "Evening" },
    { time: "5:30 PM",  available: true,  period: "Evening" },
    { time: "5:45 PM",  available: false, period: "Evening" },
    { time: "6:00 PM",  available: true,  period: "Evening" },
    { time: "6:15 PM",  available: true,  period: "Evening" },
  ];
  void morningStart; void eveningStart;
  return [...morning, ...evening];
};

export const doctorSlots: DoctorSlots[] = [
  { doctorId: 1, doctorName: "Dr. Olivia Turner",  date: "2025-11-19", slots: generateSlots("9:00 AM", "4:00 PM") },
  { doctorId: 2, doctorName: "Dr. Sophia Adams",   date: "2025-11-19", slots: generateSlots("9:00 AM", "4:00 PM") },
  { doctorId: 4, doctorName: "Dr. Ethan Miller",   date: "2025-11-19", slots: generateSlots("9:00 AM", "4:00 PM") },
  { doctorId: 5, doctorName: "Dr. Daniel Reed",    date: "2025-11-19", slots: generateSlots("9:00 AM", "4:00 PM") },
  { doctorId: 6, doctorName: "Dr. Ava Johnson",    date: "2025-11-19", slots: generateSlots("9:00 AM", "4:00 PM") },
  { doctorId: 9, doctorName: "Dr. James Parker",   date: "2025-11-19", slots: generateSlots("9:00 AM", "4:00 PM") },
  { doctorId: 10, doctorName: "Dr. Priya Sharma",  date: "2025-11-19", slots: generateSlots("9:00 AM", "4:00 PM") },
];
