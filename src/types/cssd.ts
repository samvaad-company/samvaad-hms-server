/**
 * CSSD (central sterile services): the sterilization methods, packaging, set types and the shelf lives a hospital starts
 * with. Pure data shared by the server (rules, seed) and the browser (pickers, settings).
 */

/** How a chamber sterilizes. */
export const STERILIZATION_METHODS = ["Autoclave (vacuum)", "Autoclave (gravity)", "Ethylene oxide", "Dry heat", "Plasma (H2O2)"] as const;
export type SterilizationMethod = (typeof STERILIZATION_METHODS)[number];

/** What a set is sealed in; it decides how long it stays sterile. */
export const PACKAGING = ["Pouched", "Wrapped", "Rigid container"] as const;
export type Packaging = (typeof PACKAGING)[number];

export const SET_TYPES = ["Surgical", "Obstetric", "Procedure", "Endoscopy", "Orthopaedic", "Dressing", "Other"] as const;
export type SetType = (typeof SET_TYPES)[number];

/** Days a set stays sterile after a passed cycle, by method × packaging. A hospital can override any cell. */
export const DEFAULT_SHELF_LIFE: Record<SterilizationMethod, Record<Packaging, number>> = {
  "Autoclave (gravity)": { Pouched: 30, Wrapped: 14, "Rigid container": 180 },
  "Autoclave (vacuum)": { Pouched: 30, Wrapped: 21, "Rigid container": 180 },
  "Ethylene oxide": { Pouched: 180, Wrapped: 60, "Rigid container": 365 },
  "Dry heat": { Pouched: 30, Wrapped: 7, "Rigid container": 90 },
  "Plasma (H2O2)": { Pouched: 180, Wrapped: 60, "Rigid container": 365 },
};

/** The chambers a new hospital starts with (rename, switch off or add as needed). */
export const DEFAULT_STERILIZERS: { name: string; method: SterilizationMethod; location: string }[] = [
  { name: "Autoclave 1 (Vacuum)", method: "Autoclave (vacuum)", location: "Ground Floor CSSD" },
  { name: "Autoclave 2 (Vacuum)", method: "Autoclave (vacuum)", location: "CSSD Main Hall" },
  { name: "Autoclave 3 (Gravity)", method: "Autoclave (gravity)", location: "OT Complex CSSD" },
  { name: "ETO Sterilizer", method: "Ethylene oxide", location: "CSSD Main Hall" },
  { name: "Hot Air Oven", method: "Dry heat", location: "OT Complex CSSD" },
  { name: "Plasma Sterilizer (H2O2)", method: "Plasma (H2O2)", location: "CSSD Main Hall" },
];

/** What a cycle runs at when the technician leaves the boxes as they are. */
export const DEFAULT_CYCLE = { tempC: 134, pressurePsi: 30, exposureMin: 20 } as const;

/** How long an issued set may be out before it counts as overdue, in hours. */
export const DEFAULT_ISSUE_HOURS = 24;
