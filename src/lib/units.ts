"use client";

/**
 * Measurement units are a per-device choice (a nurse may prefer °F and lb while the chart stays metric): readings are always
 * stored in metric, and these helpers convert for entry and display. Remembered in this browser.
 */
export interface Units { temperature: "C" | "F"; height: "cm" | "ftin"; weight: "kg" | "lb"; glucose: "mgdl" | "mmol" }
export const DEFAULT_UNITS: Units = { temperature: "C", height: "cm", weight: "kg", glucose: "mgdl" };
const KEY = "samvaad.units";

export function readUnits(): Units {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Units>;
    return {
      temperature: raw.temperature === "F" ? "F" : "C", height: raw.height === "ftin" ? "ftin" : "cm",
      weight: raw.weight === "lb" ? "lb" : "kg", glucose: raw.glucose === "mmol" ? "mmol" : "mgdl",
    };
  } catch { return DEFAULT_UNITS; }
}

export function saveUnits(u: Units): void {
  try { localStorage.setItem(KEY, JSON.stringify(u)); } catch { /* the choice just isn't remembered */ }
}

export const cToF = (c: number) => Math.round((c * 9 / 5 + 32) * 10) / 10;
export const fToC = (f: number) => Math.round(((f - 32) * 5 / 9) * 10) / 10;
export const kgToLb = (kg: number) => Math.round(kg * 2.20462 * 10) / 10;
export const lbToKg = (lb: number) => Math.round(lb / 2.20462 * 10) / 10;
export const mgdlToMmol = (v: number) => Math.round(v / 18.016 * 10) / 10;
export const mmolToMgdl = (v: number) => Math.round(v * 18.016);
export const cmToFtIn = (cm: number) => { const inches = Math.round(cm / 2.54); return { ft: Math.floor(inches / 12), in: inches % 12 }; };
export const ftInToCm = (ft: number, inch: number) => Math.round((ft * 12 + inch) * 2.54);
