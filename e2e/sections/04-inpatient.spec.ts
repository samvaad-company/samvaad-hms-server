import { dialogOpensAndCloses, sectionTests, switchTo } from "../support/sections";

sectionTests("Inpatient", [
  {
    name: "IPD — inpatients",
    href: "/ipd",
    heading: "Inpatients",
    controls: ["Admit patient", "Admitted now", "Discharged", "All", "My patients", "Doses due"],
    steps: async (page) => { await switchTo(page, "Discharged"); await switchTo(page, "Admitted now"); },
  },
  {
    name: "Nurse Station",
    href: "/nurse-station",
    heading: "Nurse station",
    controls: ["Board", "Medicines", "Vitals round", "IV bottles", "Handover", "Diet"],
    texts: [/^Alerts \(/, "This shift"],
    steps: async (page) => { for (const tab of ["Medicines", "Vitals round", "IV bottles", "Handover", "Diet", "Board"]) await switchTo(page, tab); },
  },
  {
    name: "Checklists",
    href: "/checklists",
    heading: "Checklists",
    controls: ["In progress", "Complete", "Cancelled", "Templates", "Start checklist"],
    steps: async (page) => { await switchTo(page, "Templates"); await switchTo(page, "Complete"); await switchTo(page, "In progress"); },
  },
  {
    name: "OT — operation theatre",
    href: "/ot",
    heading: "Operation Theatre",
    controls: ["Book", "Rooms", "Equipment", "Table", "Day", "Week", "Register"],
    steps: async (page) => { await switchTo(page, "Week"); await switchTo(page, "Register"); await switchTo(page, "Day"); await switchTo(page, "Table"); },
  },
  {
    name: "Beds & Wards",
    href: "/beds",
    heading: "Beds & Wards",
    controls: ["Add Bed", "Bed Status", "Transfers", "All"],
    steps: async (page) => {
      await switchTo(page, "Transfers");
      await switchTo(page, "Bed Status");
      await dialogOpensAndCloses(page, "Add Bed");
    },
  },
]);
