/**
 * HR constants shared by the server (rules, seed) and the browser (pickers): the leave types and shifts a hospital starts
 * with, and the payroll rules.
 */

export const DEFAULT_LEAVE_TYPES: { name: string; code: string; daysPerYear: number; paid: boolean }[] = [
  { name: "Casual leave", code: "CL", daysPerYear: 12, paid: true },
  { name: "Sick leave", code: "SL", daysPerYear: 10, paid: true },
  { name: "Earned leave", code: "EL", daysPerYear: 15, paid: true },
  // Unpaid leave has no yearly limit; it is what payroll deducts.
  { name: "Leave without pay", code: "LWP", daysPerYear: 0, paid: false },
];

/** A shift is a named block of hours; one that ends before it starts runs past midnight (the night shift). */
export const DEFAULT_SHIFTS: { name: string; code: string; start: string; end: string }[] = [
  { name: "Morning", code: "M", start: "07:00", end: "15:00" },
  { name: "Evening", code: "E", start: "15:00", end: "23:00" },
  { name: "Night", code: "N", start: "23:00", end: "07:00" },
  { name: "General", code: "G", start: "09:00", end: "17:00" },
];

/** Employee provident fund: the employee's share, as a % of basic pay. */
export const DEFAULT_PF_PERCENT = 12;
/** Flat monthly professional tax, charged once gross pay reaches the threshold. */
export const DEFAULT_PROF_TAX = 200;
export const PROF_TAX_THRESHOLD = 15000;
