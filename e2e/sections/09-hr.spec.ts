import { sectionTests, switchTo } from "../support/sections";

sectionTests("HR", [
  {
    name: "HR overview",
    href: "/hr",
    heading: "HR",
    texts: ["Leave waiting & today", "Licences to renew", "On duty today"],
  },
  {
    name: "Staff",
    href: "/staff",
    heading: "Staff directory",
    controls: ["Add Staff", "All Staff", "Access Control", "Attendance", "All", "Active", "On Leave"],
    steps: async (page) => { await switchTo(page, "Access Control"); await switchTo(page, "All Staff"); },
  },
  {
    name: "Attendance",
    href: "/attendance",
    heading: "Attendance",
    controls: ["Daily check", "Monthly register", "Punch history"],
    steps: async (page) => { await switchTo(page, "Monthly register"); await switchTo(page, "Punch history"); await switchTo(page, "Daily check"); },
  },
  {
    name: "Leave",
    href: "/hr/leave",
    heading: "Leave",
    controls: ["+ Apply for leave", "Requests", "Balances", "Calendar", "Leave types"],
    steps: async (page) => { for (const tab of ["Balances", "Calendar", "Leave types", "Requests"]) await switchTo(page, tab); },
  },
  {
    name: "Shifts & roster",
    href: "/hr/roster",
    heading: "Shifts & roster",
    controls: ["Weekly roster", "Duty list", "Shifts", "This week"],
    steps: async (page) => { await switchTo(page, "Duty list"); await switchTo(page, "Shifts"); await switchTo(page, "Weekly roster"); },
  },
  {
    name: "Payroll",
    href: "/hr/payroll",
    heading: "Payroll",
    controls: ["Run payroll", "Payroll runs", "Salaries"],
    steps: async (page) => { await switchTo(page, "Salaries"); await switchTo(page, "Payroll runs"); },
  },
]);
