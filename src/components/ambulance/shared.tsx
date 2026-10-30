"use client";

import type { AmbulanceCallDTO, AmbulanceDTO } from "@/types/api";

export const CALL_TYPES = ["Emergency pickup", "Inter-hospital transfer", "Discharge drop", "Scheduled pickup", "Mortuary transfer"];
export const VEHICLE_TYPES = ["Basic Life Support (BLS)", "Advanced Life Support (ALS)", "Neonatal", "Patient transport", "Mortuary van"];

const BLUE = "border-[#b9c6f3] bg-[#e8eeff] text-[#2c43a8]";
const GREEN = "border-[#9fe3c6] bg-[#e9fbf2] text-[#0b7a47]";
const GREY = "border-[color:var(--line)] bg-[color:var(--subtle)] text-[color:var(--ink-soft)]";
const AMBER = "border-[#f1cf9b] bg-[#fff6e8] text-[#8a5300]";
const RED = "border-[#f3b4b4] bg-[#ffe9e9] text-[#a3001a]";

/** What the board calls each stored vehicle status. */
export const VEHICLE_STATUS: Record<AmbulanceDTO["status"], { label: string; tone: string }> = {
  Available: { label: "Available", tone: GREEN }, "On Call": { label: "Dispatched", tone: BLUE }, Maintenance: { label: "Off road", tone: GREY },
};
export const CALL_STATUS: Record<AmbulanceCallDTO["status"], { label: string; tone: string }> = {
  Queued: { label: "Queued", tone: AMBER }, Dispatched: { label: "En route to pickup", tone: BLUE }, "At scene": { label: "At scene", tone: BLUE },
  Transporting: { label: "Transporting", tone: BLUE }, Completed: { label: "Completed", tone: GREEN }, Cancelled: { label: "Cancelled", tone: RED },
};

export const Chip = ({ tone, children }: { tone: string; children: string }) => <span className={`inline-block whitespace-nowrap rounded-full border px-[10px] py-[1px] text-[12px] ${tone}`}>{children}</span>;
export const ghostBtn = "inline-flex cursor-pointer items-center gap-[6px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-[6px] text-[13px] font-medium hover:bg-[color:var(--subtle)] disabled:cursor-not-allowed disabled:opacity-50";
export const primaryBtn = "inline-flex cursor-pointer items-center gap-[6px] rounded-[8px] bg-[color:var(--brand)] px-3 py-[7px] text-[13px] font-medium text-white disabled:opacity-50";
export const Err = ({ message }: { message?: string }) => (message ? <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{message}</p> : null);
export const OPEN_STATUSES: AmbulanceCallDTO["status"][] = ["Queued", "Dispatched", "At scene", "Transporting"];
export const hhmm = (ts: string | null) => (ts ? new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—");
export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
