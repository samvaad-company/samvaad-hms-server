"use client";

/**
 * Patient booking page — the link a tele-caller sends opens this. No login: the
 * signed token in the URL says who the patient is, and the server decides the
 * fee. Pick a doctor and a time, pay, and get the video link.
 */
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, CircleAlert, Loader2, Video } from "lucide-react";

interface Doctor { id: number; name: string; specialty: string; patientsPerHour?: number }
interface SessionInfo {
  hospitalName: string; patientFirstName: string; enabled: boolean;
  price: number | null; currency: string; paymentMode: "razorpay" | "mock" | "off"; doctors: Doctor[];
}
interface Slot { value: string; label: string; status?: "open" | "booked" | "full" }
interface SlotsInfo { isOpen: boolean; closedReason: string | null; slots: Slot[]; note?: string; hours?: { label: string; booked: number; capacity: number; full: boolean }[] }
interface Booking {
  id: number; status: string; amount: number; doctorName: string; date: string; time: string;
  videoUrl: string | null; failureReason: string | null;
}
interface PaymentInfo {
  mode: string; keyId: string | null; orderId: string; amountPaise: number; currency: string;
  hospitalName: string; prefill: { name: string; contact: string; email: string };
}
interface RazorpayResponse { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
interface RazorpayInstance { open: () => void; on: (event: string, cb: (r: { error?: { description?: string } }) => void) => void }
declare global { interface Window { Razorpay?: new (opts: Record<string, unknown>) => RazorpayInstance } }

/** Plain fetch — this page has no session, so it must not use the staff API client (which bounces 401s to login). */
async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/public/teleconsult${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { data?: T; error?: { message?: string } } | null;
  if (!res.ok) throw new Error(json?.error?.message ?? "Something went wrong. Please try again.");
  return json?.data as T;
}

function loadCheckout(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    document.body.appendChild(s);
  });
}

const todayIso = () => new Date().toLocaleDateString("en-CA");
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

const field = "w-full bg-[#f6f6f6] border border-[#dedee1] rounded-[10px] px-4 text-[15px] text-[#11111c] focus:outline-none focus:border-[#009598] focus:bg-white transition-colors";

export default function BookVideoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<SlotsInfo | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ booking: Booking; payment: PaymentInfo } | null>(null);
  const [done, setDone] = useState<Booking | null>(null);

  useEffect(() => {
    let alive = true;
    call<SessionInfo>("GET", `/session?token=${encodeURIComponent(token)}`)
      .then((d) => alive && setInfo(d))
      .catch((e: Error) => alive && setLoadError(e.message));
    return () => { alive = false; };
  }, [token]);

  const loadSlots = useCallback(async (doc: string, day: string) => {
    if (!doc || !day) return;
    setSlotsLoading(true);
    setTime("");
    try {
      setSlots(await call<SlotsInfo>("GET", `/slots?token=${encodeURIComponent(token)}&doctorId=${doc}&date=${day}`));
    } catch (e) {
      setSlots({ isOpen: false, closedReason: e instanceof Error ? e.message : "Couldn't load times.", slots: [] });
    } finally {
      setSlotsLoading(false);
    }
  }, [token]);

  // After paying, the video link may take a moment to appear — check a few times.
  useEffect(() => {
    if (!done || done.videoUrl) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      try {
        const b = await call<Booking>("GET", `/bookings/${done.id}?token=${encodeURIComponent(token)}`);
        if (b.videoUrl) { setDone(b); clearInterval(timer); }
      } catch { /* keep the confirmation on screen */ }
      if (tries >= 10) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [done, token]);

  const doctor = useMemo(() => info?.doctors.find((d) => String(d.id) === doctorId), [info, doctorId]);
  const ready = !!(doctorId && date && time && reason.trim().length >= 2);

  async function verify(booking: Booking, r: RazorpayResponse) {
    setBusy(true);
    setError(null);
    try {
      const confirmed = await call<Booking>("POST", `/bookings/${booking.id}/verify`, { token, ...r });
      if (confirmed.status === "confirmed") { setDone(confirmed); setPending(null); }
      else setError(confirmed.failureReason ?? "That time was taken just before your payment went through. Please pick another time.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't confirm your payment.");
    } finally {
      setBusy(false);
    }
  }

  async function openCheckout(booking: Booking, pay: PaymentInfo) {
    if (pay.mode !== "razorpay" || !pay.keyId) return; // mock mode is driven by its own button
    try {
      await loadCheckout();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the payment window.");
      return;
    }
    const rzp = new window.Razorpay!({
      key: pay.keyId,
      order_id: pay.orderId,
      amount: pay.amountPaise,
      currency: pay.currency,
      name: pay.hospitalName,
      description: "Video consultation",
      prefill: pay.prefill,
      theme: { color: "#009598" },
      handler: (r: RazorpayResponse) => void verify(booking, r),
      modal: { ondismiss: () => setError("Payment not completed. Your time is held for 15 minutes — tap Pay to try again.") },
    });
    rzp.on("payment.failed", (r) => setError(r.error?.description ?? "The payment failed. Please try again."));
    rzp.open();
  }

  async function pay() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await call<{ booking: Booking; payment: PaymentInfo | null }>("POST", "/bookings", {
        token, doctorId: Number(doctorId), date, time, reason: reason.trim(), email: email.trim() || undefined,
      });
      if (!res.payment) { setDone(res.booking); return; } // free consultation
      setPending({ booking: res.booking, payment: res.payment });
      await openCheckout(res.booking, res.payment);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't start the booking.";
      setError(msg);
      if (/booked|paying|past|outside/i.test(msg)) void loadSlots(doctorId, date);
    } finally {
      setBusy(false);
    }
  }

  // ── Screens ──
  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-[#f7f7f7] flex justify-center px-4 py-8">
      <div className="w-full max-w-[520px] flex flex-col gap-5">{children}</div>
    </div>
  );

  if (loadError) {
    return shell(
      <div className="bg-white border border-[#dedee1] rounded-[18px] p-8 text-center flex flex-col items-center gap-3">
        <CircleAlert size={44} strokeWidth={1.5} className="text-[#ff0004]" />
        <h1 className="text-[20px] font-medium text-[#11111c]">This link isn&apos;t working</h1>
        <p className="text-[14px] text-[#57575f]">{loadError}</p>
      </div>,
    );
  }
  if (!info) {
    return shell(<div className="py-24 text-center text-[#57575f]"><Loader2 className="animate-spin inline" size={22} /></div>);
  }
  if (!info.enabled || info.paymentMode === "off") {
    return shell(
      <div className="bg-white border border-[#dedee1] rounded-[18px] p-8 text-center flex flex-col items-center gap-3">
        <Video size={44} strokeWidth={1.5} className="text-[#57575f]" />
        <h1 className="text-[20px] font-medium text-[#11111c]">Video consultations aren&apos;t available right now</h1>
        <p className="text-[14px] text-[#57575f]">Please contact {info.hospitalName} to book an appointment.</p>
      </div>,
    );
  }

  if (done) {
    return shell(
      <div className="bg-white border border-[#dedee1] rounded-[18px] p-8 text-center flex flex-col items-center gap-3">
        <CheckCircle2 size={56} strokeWidth={1.5} className="text-[#00955c]" />
        <h1 className="text-[22px] font-medium text-[#11111c]">You&apos;re booked</h1>
        <p className="text-[14px] text-[#57575f]">
          Video consultation with <b className="text-[#11111c]">{done.doctorName}</b><br />
          {prettyDate(done.date)} · {done.time}
        </p>
        <p className="text-[13px] text-[#57575f]">Fee: {done.amount > 0 ? inr(done.amount) : "Free"}</p>
        {done.videoUrl ? (
          <a href={done.videoUrl} target="_blank" rel="noopener noreferrer"
            className="mt-2 h-[48px] px-8 inline-flex items-center gap-2 bg-[#009598] text-white text-[15px] font-medium rounded-full hover:bg-[#007f82] transition-colors">
            <Video size={18} /> Join video consultation
          </a>
        ) : (
          <p className="text-[13px] text-[#57575f] bg-[#f6f6f6] rounded-[10px] px-4 py-3 mt-2">
            Your video link will be shared with you before the appointment. Keep this page — it appears here as soon as it&apos;s ready.
          </p>
        )}
        <p className="text-[12px] font-light text-[#57575f] mt-2">{info.hospitalName}</p>
      </div>,
    );
  }

  return shell(
    <>
      <header>
        <p className="text-[13px] font-light text-[#57575f]">{info.hospitalName}</p>
        <h1 className="text-[24px] font-medium text-[#11111c] leading-8">Hi {info.patientFirstName}, book a video consultation</h1>
      </header>

      <section className="bg-white border border-[#dedee1] rounded-[18px] p-5 flex flex-col gap-4">
        <label className="flex flex-col gap-[6px]">
          <span className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">Doctor</span>
          <select className={`${field} h-[48px]`} value={doctorId}
            onChange={(e) => { setDoctorId(e.target.value); setError(null); void loadSlots(e.target.value, date); }}>
            <option value="">{info.doctors.length === 0 ? "No doctor is taking video consultations right now" : "Choose a doctor"}</option>
            {info.doctors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.specialty}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-[6px]">
          <span className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">Date</span>
          <input type="date" className={`${field} h-[48px]`} min={todayIso()} value={date}
            onChange={(e) => { setDate(e.target.value); setError(null); void loadSlots(doctorId, e.target.value); }} />
        </label>

        {doctorId && date && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider flex items-center gap-1">
              <CalendarClock size={12} /> Time
            </span>
            {slotsLoading ? (
              <Loader2 className="animate-spin text-[#57575f]" size={18} />
            ) : slots && slots.slots.length > 0 ? (
              <>
                {slots.note && <p className="text-[11px] font-light text-[#57575f]">{slots.note}</p>}
                {slots.closedReason && !slots.slots.some((s) => (s.status ?? "open") === "open") && (
                  <p className="text-[13px] text-[#ff9000] bg-[#fff2e0] rounded-[10px] px-4 py-3">{slots.closedReason}</p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {slots.slots.map((s) => {
                    const open = (s.status ?? "open") === "open";
                    return (
                      <button key={s.value} type="button" disabled={!open} onClick={() => { setTime(s.value); setError(null); }}
                        title={s.status === "booked" ? "This time is already booked" : s.status === "full" ? "This hour is full" : undefined}
                        className={`h-[40px] rounded-[10px] text-[13px] border transition-colors ${
                          !open ? "bg-[#f6f6f6] text-[#a0a0a8] border-[#dedee1] cursor-not-allowed"
                            : time === s.value ? "bg-[#009598] text-white border-[#009598] cursor-pointer"
                            : "bg-white text-[#11111c] border-[#dedee1] hover:border-[#009598] cursor-pointer"
                        }`}>
                        {s.label}{!open && <span className="block text-[9px] uppercase leading-none">{s.status}</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-[13px] text-[#ff9000] bg-[#fff2e0] rounded-[10px] px-4 py-3">{slots?.closedReason ?? "No times available."}</p>
            )}
          </div>
        )}

        <label className="flex flex-col gap-[6px]">
          <span className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">Reason for the visit</span>
          <textarea className={`${field} py-3 resize-none`} rows={2} maxLength={240} placeholder="e.g. Follow-up on my blood pressure"
            value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>

        <label className="flex flex-col gap-[6px]">
          <span className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">Email <span className="normal-case font-light">(optional — for the calendar invite)</span></span>
          <input type="email" className={`${field} h-[48px]`} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
      </section>

      {error && <p className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[10px] px-4 py-3">{error}</p>}

      {pending && pending.payment.mode === "mock" ? (
        <div className="bg-white border border-dashed border-[#ff9000] rounded-[18px] p-5 flex flex-col gap-3">
          <p className="text-[13px] text-[#57575f]"><b className="text-[#ff9000]">Test mode.</b> No real payment gateway is connected, so no money moves. Use the button to simulate a successful payment.</p>
          <button disabled={busy}
            onClick={() => void verify(pending.booking, { razorpay_order_id: pending.payment.orderId, razorpay_payment_id: `pay_mock_${Date.now().toString(36)}`, razorpay_signature: "mock" })}
            className="h-[48px] bg-[#ff9000] text-white text-[15px] font-medium rounded-full hover:bg-[#e68200] disabled:opacity-60 transition-colors cursor-pointer">
            {busy ? "Confirming…" : `Simulate payment of ${inr(pending.booking.amount)}`}
          </button>
        </div>
      ) : (
        <button onClick={pay} disabled={!ready || busy}
          className="h-[54px] bg-[#009598] text-white text-[16px] font-medium rounded-full hover:bg-[#007f82] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed">
          {busy ? <Loader2 size={20} className="animate-spin" /> : null}
          {busy ? "Please wait…" : info.price && info.price > 0 ? `Pay ${inr(info.price)} & book` : "Book consultation"}
        </button>
      )}
      <p className="text-[12px] font-light text-[#57575f] text-center">
        {doctor ? `${doctor.name} · ` : ""}Video consultation fee {info.price ? inr(info.price) : "—"}, set by {info.hospitalName}. You&apos;ll get a Google Meet link after payment.
      </p>
    </>,
  );
}
