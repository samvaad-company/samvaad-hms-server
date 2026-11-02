import { dialogOpensAndCloses, expect, sectionTests, switchTo } from "../support/sections";

sectionTests("Clinical", [
  {
    name: "OPD — the queue",
    href: "/opd",
    heading: "OPD Queue",
    controls: ["New Check-in", "All", "Waiting", "In Consultation", "Completed"],
    texts: [/Active Tokens/],
    steps: async (page) => {
      for (const column of ["Token", "Patient", "Doctor", "Status"]) await expect(page.locator("main").getByText(column, { exact: true }).first()).toBeVisible();
      await switchTo(page, "Waiting");
      await switchTo(page, "All");
      await dialogOpensAndCloses(page, "New Check-in");
    },
  },
  {
    name: "Patients — list and patient record",
    href: "/patients",
    heading: "Patients",
    controls: ["All", "Overview", "Documents & consents", "Medical history", "Visits", "Vitals"],
    steps: async (page) => {
      await switchTo(page, "Visits");
      await switchTo(page, "Documents & consents");
      await switchTo(page, "Overview");
    },
  },
  {
    name: "Enquiries",
    href: "/enquiries",
    heading: "Enquiries",
    controls: ["New enquiry", "All", "Open", "Contacted", "Converted", "Closed"],
    steps: async (page) => {
      await switchTo(page, "Open");
      await dialogOpensAndCloses(page, "New enquiry");
    },
  },
  {
    name: "Follow-ups",
    href: "/followups",
    heading: "Follow-ups",
    controls: ["Follow-ups", "Analytics", "+ Schedule", "Pending", "Done", "Missed", "All"],
    steps: async (page) => {
      await switchTo(page, "Analytics");
      await switchTo(page, "Follow-ups");
    },
  },
  {
    name: "Doctors",
    href: "/doctors",
    heading: "Doctors",
    controls: ["Add Doctor", "All", "Active", "In OPD", "On Leave"],
    steps: async (page) => {
      await switchTo(page, "Active");
      await dialogOpensAndCloses(page, "Add Doctor");
    },
  },
  {
    name: "Prescriptions",
    href: "/prescriptions",
    heading: "Prescriptions",
    controls: ["New Prescription", "All", "Dispensed", "Pending", "Draft"],
    steps: async (page) => { await switchTo(page, "Pending"); },
  },
]);
