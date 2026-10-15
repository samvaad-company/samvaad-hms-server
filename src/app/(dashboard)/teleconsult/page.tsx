"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, IndianRupee, Link2Off, Plus, Send, Video } from "lucide-react";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { useItem, useList } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/shared/PageHeader";
import { TabBar } from "@/components/shared/TabBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConsultLinkActions } from "@/components/teleconsult/ConsultLinkActions";
import { BookConsultModal } from "@/components/teleconsult/BookConsultModal";
import { BookingLinkModal } from "@/components/teleconsult/BookingLinkModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { api } from "@/lib/api/client";
import type { AppointmentDTO, TeleconsultConfigDTO, TeleconsultPaymentsDTO } from "@/types/api";

const COLS = "minmax(150px,1.2fr) minmax(140px,1fr) 130px 110px 110px minmax(280px,1.5fr) 90px";
const PAY_COLS = "minmax(110px,1fr) minmax(100px,0.9fr) 92px 72px 112px minmax(130px,1fr) minmax(200px,1.7fr) 100px";

const MODE_LABEL: Record<string, string> = { razorpay: "Online (Razorpay)", mock: "Online (test)", cash: "Cash", upi: "UPI", card: "Card", waived: "Waived", free: "Free" };
const PAY_BADGE: Record<string, string> = {
  Paid: "bg-[#dffff3] text-[#00955c]", Refunded: "bg-[#fff2e0] text-[#ff9000]", Waived: "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]",
  Free: "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]", "Awaiting payment": "bg-[#d6eaff] text-[#007cff]", "Slot lost": "bg-[#ffe9e9] text-[#ff0004]",
  Cancelled: "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]", Failed: "bg-[#ffe9e9] text-[#ff0004]", Expired: "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]",
};

/** "4:30 PM" → minutes, for ordering within a day. */
function minutesOf(t: string): number {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(t.trim());
  if (!m) return 0;
  return (Number(m[1]) % 12) * 60 + Number(m[2]) + (m[3]?.toUpperCase() === "PM" ? 720 : 0);
}

export default function TeleconsultPage() {
  const { can } = useAuth();
  const canWrite = can("teleconsult", "write");
  const [tab, setTab] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [booking, setBooking] = useState(false);
  const [linking, setLinking] = useState(false);
  const [cancelling, setCancelling] = useState<AppointmentDTO | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { item: config } = useItem<TeleconsultConfigDTO>("/teleconsult/config");
  const { items, reload } = useList<AppointmentDTO>("/appointments", { all: true, type: "Tele-consult" });
  const { item: payments, reload: reloadPayments } = useItem<TeleconsultPaymentsDTO>("/teleconsult/payments");
  const refreshAll = () => { reload(); reloadPayments(); };

  async function confirmCancel() {
    if (!cancelling) return;
    setCancelBusy(true);
    try {
      const res = await api.post<{ refund: { done: boolean; reference: string; manual: boolean } }>(`/teleconsult/${cancelling.id}/cancel`, { refund: true });
      setNotice(
        res.refund.done
          ? res.refund.manual && !res.refund.reference.startsWith("mock_") && !res.refund.reference.startsWith("rfnd_")
            ? `Cancelled. ${res.refund.reference}.`
            : `Cancelled and refunded (${res.refund.reference}).`
          : "Cancelled. No online payment to refund.",
      );
      refreshAll();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't cancel this consultation.");
    } finally {
      setCancelBusy(false);
      setCancelling(null);
    }
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(a => {
        if (tab === "upcoming" && !(a.status === "Today" || a.status === "Upcoming")) return false;
        if (tab === "completed" && a.status !== "Completed") return false;
        if (tab === "cancelled" && a.status !== "Cancelled") return false;
        return !q || a.patientName.toLowerCase().includes(q) || a.doctor.toLowerCase().includes(q);
      })
      // Soonest first for what's coming; newest first for history.
      .sort((a, b) => {
        const d = a.date.localeCompare(b.date) || minutesOf(a.time) - minutesOf(b.time);
        return tab === "upcoming" ? d : -d;
      });
  }, [items, tab, search]);

  const open = items.filter(a => a.status === "Today" || a.status === "Upcoming");
  const pending = open.filter(a => !a.videoUrl).length;
  const collected = items.filter(a => a.status !== "Cancelled").reduce((sum, a) => sum + (a.consultAmount ?? 0), 0);

  const TABS = [
    { id: "upcoming", label: "Upcoming", count: open.length },
    { id: "completed", label: "Completed" },
    { id: "cancelled", label: "Cancelled" },
    { id: "all", label: "All" },
    { id: "payments", label: "Payments", count: payments?.totals.count },
  ];

  return (
    <>
      <BookConsultModal open={booking} onClose={() => setBooking(false)} onBooked={refreshAll} config={config} />
      <BookingLinkModal open={linking} onClose={() => setLinking(false)} config={config} />
      <ConfirmDialog open={!!cancelling} title="Cancel video consultation"
        message={cancelling ? `Cancel ${cancelling.patientName}'s consultation with ${cancelling.doctor} on ${formatDate(cancelling.date)} at ${cancelling.time}? ${cancelling.consultAmount ? `The ₹${cancelling.consultAmount.toLocaleString("en-IN")} fee will be refunded.` : ""}` : ""}
        confirmLabel="Cancel & refund" cancelLabel="Keep it" loading={cancelBusy} onConfirm={confirmCancel} onCancel={() => setCancelling(null)} />
      <PageHeader
        title="Video Consultations"
        subtitle="Paid tele-consults booked from the patient app or by the tele-caller, with their video links."
        stats={[
          { icon: CalendarClock, value: `${open.length}`, label: "Upcoming" },
          { icon: Link2Off, value: `${pending}`, label: "Link Pending" },
          { icon: IndianRupee, value: `₹${(payments?.totals.collected ?? collected).toLocaleString("en-IN")}`, label: "Collected" },
        ]}
        action={canWrite && config?.enabled ? { label: "Book Consultation", icon: Plus, onClick: () => setBooking(true) } : undefined}
        dateRange={false}
      />

      {config && !config.enabled && (
        <div className={`${tw.gutterX} mb-3`}>
          <div className="text-[13px] text-[#ff9000] bg-[#fff2e0] rounded-[10px] px-4 py-3">
            Video consultations are switched off, so patients can&apos;t book them.{" "}
            <Link href="/admin" className="underline">Turn them on in Admin → Settings</Link> (Super Admin).
          </div>
        </div>
      )}
      {config?.enabled && !config.google.connected && (
        <div className={`${tw.gutterX} mb-3`}>
          <div className={`text-[13px] rounded-[10px] px-4 py-3 border ${config.google.needsReconnect ? "text-[#ff9000] bg-[#fff2e0] border-[#ff9000]/30" : "text-[color:var(--ink-soft)] bg-[color:var(--subtle)] border-[color:var(--line)]"}`}>
            {config.google.needsReconnect ? (
              <>
                Google Meet needs to be reconnected: {config.google.lastError ?? "access was revoked or never granted"}.{" "}
                <Link href="/admin" className="underline">Reconnect in Admin → Settings</Link> — missing links are then created automatically within a few minutes.
              </>
            ) : (
              <>Google Meet isn&apos;t connected, so links aren&apos;t created automatically — add them by hand with &ldquo;Add link&rdquo;, or connect Google in Admin → Settings.</>
            )}
          </div>
        </div>
      )}

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 560 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
          {notice && (
            <div className="flex items-start justify-between gap-3 mx-5 mt-3 text-[13px] text-[color:var(--ink)] bg-[color:var(--brand-soft)] border border-[#b8e5e6] rounded-[10px] px-4 py-3">
              <span>{notice}</span>
              <button onClick={() => setNotice(null)} className="text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] shrink-0 cursor-pointer">✕</button>
            </div>
          )}
          <div className="px-5 py-3 mt-3 border-y border-[color:var(--line)] bg-[color:var(--subtle)] flex items-center gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by patient or doctor…"
              className="h-[34px] w-full max-w-[320px] bg-[color:var(--surface)] border border-[color:var(--line)] rounded-[8px] px-3 text-[13px] focus:outline-none focus:border-[color:var(--brand)]" />
            {canWrite && config?.enabled && (
              <button onClick={() => setLinking(true)}
                className="ml-auto inline-flex items-center gap-2 text-[13px] text-[color:var(--brand)] border border-[color:var(--brand)] px-4 py-[7px] rounded-full hover:bg-[color:var(--brand-soft)] transition-colors cursor-pointer whitespace-nowrap">
                <Send size={14} /> Send booking link
              </button>
            )}
          </div>
          {tab === "payments" ? (
            <PaymentsTable data={payments} search={search} canWrite={canWrite} onChanged={refreshAll} />
          ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 1060 }}>
              <div className="grid items-center px-5 h-10 bg-[color:var(--subtle-3)] text-[12px] font-medium text-[color:var(--ink)]" style={{ gridTemplateColumns: COLS }}>
                <span>Patient</span><span>Doctor</span><span>When</span><span>Fee</span><span>Status</span><span>Video</span><span />
              </div>
              {rows.length === 0 ? (
                <div className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">
                  <Video size={28} className="mx-auto mb-2 text-[color:var(--line)]" />
                  No video consultations here yet.
                </div>
              ) : rows.map(a => (
                <div key={a.id} className="grid items-center px-5 min-h-[60px] py-2 border-b border-[color:var(--subtle-2)] hover:bg-[color:var(--faint)] transition-colors" style={{ gridTemplateColumns: COLS }}>
                  <div className="min-w-0">
                    <Link href={`/appointments/${a.id}`} className="block text-[13px] font-medium text-[color:var(--ink)] truncate hover:underline">{a.patientName}</Link>
                    <span className="block text-[11px] font-light text-[color:var(--ink-soft)] truncate">{a.reason}</span>
                  </div>
                  <span className="text-[13px] text-[color:var(--ink)] truncate pr-2">{a.doctor}</span>
                  <span className="text-[13px] text-[color:var(--ink)]">{formatDate(a.date)}<span className="block text-[11px] font-light text-[color:var(--ink-soft)]">{a.time}</span></span>
                  <span className="text-[13px] text-[color:var(--ink)]">
                    {a.consultAmount != null ? `₹${a.consultAmount.toLocaleString("en-IN")}` : "—"}
                    {a.paymentStatus && <span className="block text-[11px] font-light text-[color:var(--ink-soft)]">{a.paymentStatus}</span>}
                  </span>
                  <div><StatusBadge status={a.status} /></div>
                  <ConsultLinkActions appt={a} canWrite={canWrite} onChanged={reload} />
                  <div className="flex justify-end">
                    {canWrite && (a.status === "Today" || a.status === "Upcoming") && (
                      <button onClick={() => setCancelling(a)}
                        className="text-[12px] text-[#ff0004] border border-[#ff0004]/40 px-3 py-[5px] rounded-full hover:bg-[#ffe9e9] transition-colors cursor-pointer">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      </div>
    </>
  );
}

const VIA_LABEL: Record<string, string> = { verify: "patient's confirmation", webhook: "Razorpay webhook", sweep: "background check", staff: "recorded by staff", system: "system" };

function PaymentsTable({ data, search, canWrite, onChanged }: { data: TeleconsultPaymentsDTO | null; search: string; canWrite: boolean; onChanged: () => void }) {
  const [checking, setChecking] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const q = search.trim().toLowerCase();
  // Search matches names and any of the ids staff might paste: payment, order, receipt, appointment.
  const rows = (data?.items ?? []).filter(i => !q
    || i.patientName.toLowerCase().includes(q) || i.doctorName.toLowerCase().includes(q)
    || (i.paymentId ?? "").toLowerCase().includes(q) || (i.orderId ?? "").toLowerCase().includes(q)
    || String(i.appointmentId ?? "") === q);

  async function check(id: number) {
    setChecking(id);
    setMessage(null);
    try {
      const r = await api.post<{ status: string; changed: boolean }>(`/teleconsult/payments/${id}/sync`);
      setMessage(r.changed ? `Payment found — booking is now ${r.status.replace("_", " ")}.` : "No new payment found at the gateway for that booking.");
      onChanged();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't check the payment.");
    } finally {
      setChecking(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      {data && (
        <div className="flex gap-8 px-5 py-3 border-b border-[color:var(--subtle-2)] text-[13px] items-center">
          <span><span className="text-[color:var(--ink-soft)]">Collected </span><b className="text-[#00955c]">₹{data.totals.collected.toLocaleString("en-IN")}</b></span>
          <span><span className="text-[color:var(--ink-soft)]">Refunded </span><b className="text-[#ff9000]">₹{data.totals.refunded.toLocaleString("en-IN")}</b></span>
          {message && <span className="text-[12px] text-[color:var(--ink-soft)] ml-auto">{message}</span>}
        </div>
      )}
      <div style={{ minWidth: 1020 }}>
        <div className="grid items-center px-5 h-10 bg-[color:var(--subtle-3)] text-[12px] font-medium text-[color:var(--ink)]" style={{ gridTemplateColumns: PAY_COLS }}>
          <span>Patient</span><span>Doctor</span><span>Consultation</span><span>Amount</span><span>Status</span><span>Paid via</span><span>Payment · Order · Appointment</span><span />
        </div>
        {rows.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">No payments{q ? " match that search" : " yet"}.</div>
        ) : rows.map(i => (
          <div key={i.id} className="grid items-center px-5 min-h-[64px] py-2 border-b border-[color:var(--subtle-2)] hover:bg-[color:var(--faint)] transition-colors text-[13px]" style={{ gridTemplateColumns: PAY_COLS }}>
            <span className="font-medium text-[color:var(--ink)] truncate pr-2">{i.patientName}</span>
            <span className="truncate pr-2">{i.doctorName}</span>
            <span>{formatDate(i.date)}<span className="block text-[11px] font-light text-[color:var(--ink-soft)]">{i.time}</span></span>
            <span>{i.amount > 0 ? `₹${i.amount.toLocaleString("en-IN")}` : "—"}</span>
            <span title={i.note ?? undefined}><span className={`inline-block text-[11px] px-[10px] py-[3px] rounded-full ${PAY_BADGE[i.status] ?? ""}`}>{i.status}</span></span>
            <span className="text-[12px] text-[color:var(--ink-soft)]">
              {MODE_LABEL[i.mode] ?? i.mode}{i.method ? ` · ${i.method.toUpperCase()}` : ""}
              <span className="block text-[11px] font-light">
                {i.source === "link" ? "booking link" : i.source === "portal" ? "patient app" : "front desk"}
                {i.recordedVia ? ` · ${VIA_LABEL[i.recordedVia] ?? i.recordedVia}` : ""}
              </span>
            </span>
            <span className="text-[11px] text-[color:var(--ink-soft)] break-all pr-2 leading-4">
              {i.paymentId && <span className="block"><span className="text-[#a0a0a8]">Pay </span>{i.paymentId}</span>}
              {i.orderId && <span className="block"><span className="text-[#a0a0a8]">Order </span>{i.orderId}</span>}
              {i.appointmentId && <Link href={`/appointments/${i.appointmentId}`} className="block text-[color:var(--brand)] hover:underline">Appointment #{i.appointmentId} →</Link>}
              {i.refundReference && <span className="block text-[#ff9000]">Refund {i.refundReference}</span>}
              {!i.paymentId && !i.orderId && !i.appointmentId && "—"}
            </span>
            <span className="flex justify-end">
              {canWrite && (i.status === "Awaiting payment" || i.status === "Expired") && i.orderId && (
                <button onClick={() => check(i.id)} disabled={checking === i.id}
                  className="text-[12px] text-[color:var(--brand)] border border-[color:var(--brand)] px-3 py-[5px] rounded-full hover:bg-[color:var(--brand-soft)] disabled:opacity-60 cursor-pointer whitespace-nowrap">
                  {checking === i.id ? "Checking…" : "Check status"}
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
