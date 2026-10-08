"use client";

/**
 * The times a doctor can be booked on a date, straight from the server: grouped
 * by hour with how many of the doctor's places in that hour are taken. A time
 * that is taken shows as Booked, and an hour whose places are used up as Full —
 * the same wording whoever is booking.
 */
import { Clock, Loader2 } from "lucide-react";
import { useItem } from "@/lib/api/hooks";
import type { SlotsDTO } from "@/types/api";

export function SlotPicker({
  doctorId, date, mode, value, onChange, excludeAppointmentId, refreshKey = 0, label = "Available times",
}: {
  doctorId: string | number | null | undefined;
  date: string;
  mode: "in_person" | "video";
  /** Selected time as "HH:mm". */
  value: string;
  /** Called with the time as "HH:mm" and its label ("10:30 AM"). */
  onChange: (value: string, label: string) => void;
  /** The appointment being moved, so its own place doesn't show as taken. */
  excludeAppointmentId?: number;
  /** Bump to refetch (e.g. after a booking was refused because the time had just gone). */
  refreshKey?: number;
  label?: string;
}) {
  const path = doctorId && date
    ? `/appointments/slots?doctorId=${doctorId}&date=${date}&mode=${mode}${excludeAppointmentId ? `&excludeAppointmentId=${excludeAppointmentId}` : ""}&r=${refreshKey}`
    : null;
  const { item, loading, error } = useItem<SlotsDTO>(path);

  if (!path) return <p className="text-[12px] font-light text-[#57575f]">Choose a doctor and a date to see the available times.</p>;
  if (loading && !item) return <Loader2 size={18} className="animate-spin text-[#57575f]" />;
  if (error) return <p className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</p>;
  if (!item) return null;
  if (!item.isOpen) return <p className="text-[13px] text-[#ff9000] bg-[#fff2e0] rounded-[8px] px-3 py-2">{item.closedReason ?? "No times available."}</p>;

  // Slots arrive in time order; group them by clock hour and pair each group with the server's per-hour counts.
  const groups: { hour: number; slots: SlotsDTO["slots"] }[] = [];
  for (const s of item.slots) {
    const hour = Number(s.value.slice(0, 2));
    const last = groups[groups.length - 1];
    if (last && last.hour === hour) last.slots.push(s);
    else groups.push({ hour, slots: [s] });
  }
  const noneOpen = !item.slots.some(s => s.status === "open");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12px] font-medium text-[#57575f] uppercase tracking-wider">{label}</p>
        <p className="text-[11px] font-light text-[#57575f]">{item.note}</p>
      </div>
      {item.closedReason && noneOpen && (
        <p className="text-[13px] text-[#ff9000] bg-[#fff2e0] rounded-[8px] px-3 py-2">{item.closedReason}</p>
      )}
      {groups.map((g, i) => {
        const meta = item.hours[i];
        return (
          <div key={g.hour} className="flex flex-col gap-[6px]">
            {meta && (
              <div className="flex items-center gap-2 text-[11px] text-[#57575f]">
                <span className="font-medium">{meta.label}</span>
                <span>· {meta.booked}/{meta.capacity} booked</span>
                {meta.full && <span className="px-[8px] py-[1px] rounded-full bg-[#ffe9e9] text-[#ff0004] font-medium">Full</span>}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {g.slots.map(s => {
                const open = s.status === "open";
                const active = value === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    disabled={!open}
                    onClick={() => onChange(s.value, s.label)}
                    title={s.status === "booked" ? "This time is already booked" : s.status === "full" ? "This hour is full" : undefined}
                    className={`flex items-center gap-1 px-4 py-[7px] rounded-full text-[13px] font-normal border transition-colors ${
                      !open ? "border-[#dedee1] text-[#a0a0a8] bg-[#f6f6f6] cursor-not-allowed"
                        : active ? "bg-[#009598] text-white border-[#009598] cursor-pointer"
                        : "border-[#dedee1] text-[#57575f] hover:border-[#009598] hover:text-[#009598] cursor-pointer"
                    }`}
                  >
                    <Clock size={12} /> {s.label}
                    {!open && <span className="text-[10px] ml-1 uppercase">{s.status}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
