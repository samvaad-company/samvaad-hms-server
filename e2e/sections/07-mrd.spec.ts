import { sectionTests, switchTo } from "../support/sections";

sectionTests("MRD", [
  {
    name: "File tracking",
    href: "/file-tracking",
    heading: "File tracking",
    controls: ["Files", "Requests", "Locations", "Dashboard"],
    steps: async (page) => { for (const tab of ["Requests", "Locations", "Dashboard", "Files"]) await switchTo(page, tab); },
  },
  {
    name: "Documents",
    href: "/documents",
    heading: "Documents",
    controls: ["Retention queue", "Policies", "Folders"],
    steps: async (page) => { await switchTo(page, "Policies"); await switchTo(page, "Folders"); await switchTo(page, "Retention queue"); },
  },
  {
    name: "Signatures",
    href: "/signatures",
    heading: "Signatures",
    controls: ["Consents", "Templates", "Not sent yet", "Waiting to be signed", "Signed", "Refused", "Expired or cancelled"],
    steps: async (page) => { await switchTo(page, "Templates"); await switchTo(page, "Consents"); await switchTo(page, "Signed"); },
  },
  {
    name: "MRD coding",
    href: "/mrd",
    heading: "MRD coding",
    controls: ["Coding queue", "Registers", "Dashboard", "All", "Pending", "In review", "Deficient"],
    steps: async (page) => { await switchTo(page, "Registers"); await switchTo(page, "Dashboard"); await switchTo(page, "Coding queue"); },
  },
]);
