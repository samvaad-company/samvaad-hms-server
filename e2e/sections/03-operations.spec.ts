import { dialogOpensAndCloses, sectionTests, switchTo } from "../support/sections";

sectionTests("Operations", [
  {
    name: "Appointments",
    href: "/appointments",
    heading: "Appointments",
    controls: ["New Appointment", "All Appointments", "Live Queue", "Doctor Wise"],
    steps: async (page) => {
      await switchTo(page, "Live Queue");
      await switchTo(page, "Doctor Wise");
      await switchTo(page, "All Appointments");
    },
  },
  {
    name: "Video Consults",
    href: "/teleconsult",
    heading: "Video Consultations",
    controls: ["Book Consultation", "Upcoming", "Completed", "Cancelled", "All", "Payments", "Send booking link"],
    steps: async (page) => { await switchTo(page, "Payments"); await switchTo(page, "Upcoming"); },
  },
  {
    name: "Pharmacy",
    href: "/pharmacy",
    heading: "Pharmacy",
    controls: ["Add Item", "Inventory", "Purchase", "Sales", "About to Expire", "Alerts"],
    steps: async (page) => { await switchTo(page, "Purchase"); await switchTo(page, "Sales"); await switchTo(page, "Alerts"); },
  },
  {
    name: "Lab",
    href: "/lab",
    heading: "Laboratory",
    controls: ["Order Test", "Worklist", "By Patient", "New Booking", "Reports"],
    steps: async (page) => { await switchTo(page, "By Patient"); await switchTo(page, "Reports"); await switchTo(page, "Worklist"); },
  },
  {
    name: "Radiology",
    href: "/radiology",
    heading: "Radiology",
    controls: ["Order Study", "Worklist", "By Patient", "New Order", "Reports"],
    steps: async (page) => { await switchTo(page, "By Patient"); await switchTo(page, "Reports"); await switchTo(page, "Worklist"); },
  },
  {
    name: "Task Board",
    href: "/tasks",
    heading: "Task Board",
    controls: ["New Task", "Board", "List"],
    steps: async (page) => { await switchTo(page, "List"); await switchTo(page, "Board"); await dialogOpensAndCloses(page, "New Task"); },
  },
]);
