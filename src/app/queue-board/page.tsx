"use client";

/**
 * Waiting-room token display board. Full-screen (no dashboard chrome),
 * auto-refreshing — meant to be shown on a TV at the OPD desk.
 */
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { OpdRecordDTO } from "@/types/api";

const REFRESH_MS = 10_000;

export default function QueueBoardPage() {
  const [records, setRecords] = useState<OpdRecordDTO[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let active = true;
    const load = () =>
      api.list<OpdRecordDTO>("/opd", { all: true })
        .then(res => { if (active) setRecords(res.data); })
        .catch(() => {});
    load();
    const dataTimer = setInterval(load, REFRESH_MS);
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      active = false;
      clearInterval(dataTimer);
      clearInterval(clockTimer);
    };
  }, []);

  const serving = records.filter(r => r.status === "In Consultation");
  const waiting = records.filter(r => r.status === "Waiting");

  return (
    <div className="min-h-screen bg-[#11111c] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-10 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-[36px] h-[36px] rounded-[10px] bg-[#009598] flex items-center justify-center">
            <span className="text-white text-[16px] font-medium">S</span>
          </div>
          <span className="text-[24px] font-medium">Samvaad <span className="text-[#009598]">HMS</span> — OPD Queue</span>
        </div>
        <div className="text-right">
          <div className="text-[28px] font-medium tabular-nums">
            {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
          </div>
          <div className="text-[13px] text-white/60">
            {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-8 p-10">
        {/* Now serving */}
        <div className="flex flex-col gap-6">
          <h2 className="text-[18px] font-medium uppercase tracking-[0.2em] text-[#00d4d8]">Now Serving</h2>
          {serving.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-white/40 text-[20px]">
              No patient in consultation
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {serving.map(r => (
                <div key={r.id} className="bg-[#009598] rounded-[20px] px-10 py-8 flex items-center justify-between">
                  <div>
                    <div className="text-[64px] font-semibold leading-none tabular-nums">{r.tokenNumber}</div>
                    <div className="text-[20px] mt-2 text-white/90">{r.patientName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] uppercase tracking-wider text-white/70">Consulting</div>
                    <div className="text-[22px] font-medium">{r.doctor}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Waiting */}
        <div className="flex flex-col gap-6">
          <h2 className="text-[18px] font-medium uppercase tracking-[0.2em] text-[#ff9000]">
            Waiting <span className="text-white/50 normal-case tracking-normal">({waiting.length})</span>
          </h2>
          {waiting.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-white/40 text-[20px]">
              Queue is clear
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 content-start">
              {waiting.map((r, i) => (
                <div key={r.id} className={`rounded-[14px] px-6 py-5 flex items-center justify-between ${i === 0 ? "bg-[#ff9000]/20 border border-[#ff9000]" : "bg-white/5 border border-white/10"}`}>
                  <div>
                    <div className="text-[36px] font-semibold leading-none tabular-nums">{r.tokenNumber}</div>
                    <div className="text-[14px] mt-1 text-white/70">{r.patientName}</div>
                  </div>
                  <div className="text-right text-[13px] text-white/60">
                    <div>{r.doctor}</div>
                    {i === 0 && <div className="text-[#ff9000] font-medium mt-1">Next</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-10 py-4 border-t border-white/10 text-center text-[13px] text-white/40">
        Please wait for your token number to be called · Refreshes automatically
      </div>
    </div>
  );
}
