"use client";

/**
 * Reception attendance screen. Shows a QR that rotates every ~25 s; staff
 * scan it from the attendance app. Deliberately lives outside the dashboard
 * layout so it can run full-screen on a desk tablet or wall display.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { ArrowLeft, ShieldCheck, WifiOff } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";

interface QrPayload {
  code: string;
  expiresAt: number;
  refreshInSeconds: number;
}

export default function AttendanceKioskPage() {
  const { user, loading: authLoading, can } = useAuth();
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [cycle, setCycle] = useState(25);
  const nextAt = useRef(0);
  const allowed = !!user && can("attendance", "write");

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<QrPayload>("/attendance/qr");
      const url = await QRCode.toDataURL(data.code, {
        width: 520,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#11111c", light: "#ffffff" },
      });
      setQr(url);
      setError(null);
      setCycle(data.refreshInSeconds);
      nextAt.current = Date.now() + data.refreshInSeconds * 1000;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't refresh the code");
      nextAt.current = Date.now() + 5000;
    }
  }, []);

  // One timer drives both the countdown and the rotation, so they never drift apart.
  useEffect(() => {
    if (!allowed) return;
    const first = setTimeout(() => void refresh(), 0);
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((nextAt.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) void refresh();
    }, 500);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [allowed, refresh]);

  // Keep the display awake while it's the attendance screen.
  useEffect(() => {
    if (!allowed || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then(l => { lock = l; }).catch(() => {});
    return () => { void lock?.release(); };
  }, [allowed]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-[14px] text-[color:var(--ink-soft)]">Loading…</div>;
  }
  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[15px] text-[color:var(--ink)]">Your role can&apos;t open the attendance screen.</p>
        <Link href="/home" className="text-[13px] text-[color:var(--brand)] hover:underline">Back to dashboard</Link>
      </div>
    );
  }

  const pct = Math.min(100, Math.max(0, (secondsLeft / cycle) * 100));

  return (
    <div className="min-h-screen bg-[color:var(--canvas)] flex flex-col">
      <header className="flex items-center justify-between px-8 py-5">
        <Link href="/home" className="flex items-center gap-2 text-[13px] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] transition-colors">
          <ArrowLeft size={16} /> Back
        </Link>
        <div className="flex items-center gap-[10px]">
          <div className="w-[34px] h-[34px] rounded-[10px] bg-[color:var(--brand)] flex items-center justify-center">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <span className="text-[20px] font-medium text-[color:var(--ink)]">
            Samvaad <span className="text-[color:var(--brand)]">HMS</span>
          </span>
        </div>
        <span className="w-[60px]" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-7 px-6 pb-10">
        <div className="text-center">
          <h1 className="text-[30px] font-medium text-[color:var(--ink)] leading-9">Staff attendance</h1>
          <p className="text-[15px] font-light text-[color:var(--ink-soft)] mt-1">
            Open the Samvaad Attendance app and scan this code to check in or out.
          </p>
        </div>

        <div className="bg-[color:var(--surface)] rounded-[24px] border border-[color:var(--line)] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.05)]">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Attendance QR code" width={340} height={340} className="block" />
          ) : (
            <div className="w-[340px] h-[340px] flex items-center justify-center text-[14px] text-[color:var(--ink-soft)]">
              Generating code…
            </div>
          )}
        </div>

        <div className="w-[340px] flex flex-col gap-2">
          <div className="h-[6px] rounded-full bg-[#e6e6e8] overflow-hidden">
            <div className="h-full bg-[color:var(--brand)] transition-[width] duration-500 ease-linear" style={{ width: `${pct}%` }} />
          </div>
          {error ? (
            <p className="flex items-center justify-center gap-2 text-[13px] text-[#ff0004]">
              <WifiOff size={14} /> {error} — retrying
            </p>
          ) : (
            <p className="text-center text-[13px] font-light text-[color:var(--ink-soft)]">
              Code refreshes in {secondsLeft}s — a screenshot won&apos;t work for long
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
