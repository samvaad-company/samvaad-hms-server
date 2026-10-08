/**
 * Tele-consult payment processing that happens outside a patient's request:
 * Razorpay's webhook, the lazy "has this been paid?" check when the patient app
 * asks, and the background sweep that catches whatever the first two missed.
 *
 * The goal is that a payment is never lost: whichever of these sees it first
 * confirms the booking (idempotently — see confirmBooking), the others find
 * nothing left to do, and anything that can't be resolved right now (gateway
 * down, slot conflict whose refund failed, Meet link not created) is retried.
 */
import {
  appointmentsRepo,
  teleconsultBookingsRepo,
} from "@/repositories";
import { type AppointmentRow, type TeleconsultBookingRow } from "@/db/tables";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { assertOwnedByHospital } from "@/services/hospital-scope";
import {
  capturePayment,
  gatewayMode,
  GatewayError,
  listOrderPayments,
  refundPayment,
  type GatewayPayment,
} from "@/services/payment-gateway";
import {
  findPaymentById,
  hasSeenEvent,
  paymentsForBooking,
  recordPayment,
} from "@/services/teleconsult-ledger";
import {
  appointmentStart,
  bookingWithAppointment,
  confirmBooking,
  consultationView,
  ensureMeetLink,
  refundBooking,
  TELECONSULT_TYPE,
} from "@/services/teleconsult-service";
import { googleStatus } from "@/services/google-meet";

const GATEWAY_MODES = new Set(["razorpay", "mock"]);
/** An unpaid booking stops holding its slot after this long (the slot hold itself is shorter). */
const EXPIRE_AFTER_MIN = 30;
/** Don't ask the gateway about a booking younger than this (the patient is probably still in checkout). */
const SWEEP_MIN_AGE_MS = 60_000;
/** Give up looking for a payment on a booking older than this. */
const SWEEP_MAX_AGE_MS = 24 * 3600_000;
const REFUND_RETRY_MAX_AGE_MS = 7 * 24 * 3600_000;
/** How long after the last failed attempt the sweep tries the Meet link again (overridable for tests). */
const meetRetryAfterMs = () => Number(process.env.TELECONSULT_MEET_RETRY_AFTER_MS ?? 5 * 60_000);

const ageOf = (iso: string) => Date.now() - new Date(iso).getTime();

// ── Webhook ──────────────────────────────────────────────────────────────────

interface WebhookBody {
  event?: string;
  payload?: {
    payment?: { entity?: GatewayPayment };
    order?: { entity?: { id?: string; receipt?: string; notes?: Record<string, string> | unknown[] } };
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number; status?: string } };
  };
}

function noteValue(notes: Record<string, string> | unknown[] | undefined, key: string): string | null {
  if (!notes || Array.isArray(notes)) return null;
  return typeof notes[key] === "string" ? notes[key] : null;
}

/** Find the booking a gateway payment belongs to: by order id, falling back to the booking id we put in the order's notes. */
async function resolveBooking(orderId: string | null, notes: Record<string, string> | unknown[] | undefined): Promise<TeleconsultBookingRow | null> {
  if (orderId) {
    const byOrder = await teleconsultBookingsRepo.findRow([{ column: "gateway_order_id", op: "eq", value: orderId }]);
    if (byOrder) return byOrder;
  }
  // Only orders this feature created carry our marker; other products on the same Razorpay account don't.
  if (noteValue(notes, "app") !== "samvaad-hms-teleconsult") return null;
  const bookingId = Number(noteValue(notes, "booking_id"));
  if (!Number.isInteger(bookingId) || bookingId < 1) return null;
  const byNotes = await teleconsultBookingsRepo.getRow(bookingId);
  if (!byNotes || (byNotes.gateway_order_id && orderId && byNotes.gateway_order_id !== orderId)) return null;
  if (!byNotes.gateway_order_id && orderId) return (await teleconsultBookingsRepo.update(byNotes.id, { gateway_order_id: orderId }))!;
  return byNotes;
}

/**
 * Process one verified webhook delivery. Returns a short outcome string for the
 * log. Throws only for things worth a retry from Razorpay (database or gateway
 * trouble); everything else — unknown orders, duplicates, odd events — returns
 * normally so Razorpay stops resending.
 */
export async function processWebhookEvent(body: WebhookBody, eventId: string | null): Promise<string> {
  const event = body.event ?? "";
  const payment = body.payload?.payment?.entity;
  const orderEntity = body.payload?.order?.entity;

  if (event === "refund.processed") return handleRefundProcessed(body.payload?.refund?.entity, eventId);

  if (!["payment.captured", "payment.authorized", "payment.failed", "order.paid"].includes(event)) return "ignored-event";
  if (!payment?.id) return "ignored-no-payment";

  const orderId = payment.order_id ?? orderEntity?.id ?? null;
  const booking = await resolveBooking(orderId, payment.notes ?? orderEntity?.notes);
  if (!booking) return "unknown-order";
  // A repeat of an event we already acted on needs nothing. (A repeat of one that FAILED part-way — Razorpay
  // retrying after our 500 — must be processed again, so only a confirmed booking counts as done.)
  if (booking.status === "confirmed" && (await hasSeenEvent(payment.id, eventId))) return "duplicate-event";

  const evt = { event, id: eventId };
  const money = { amount: payment.amount / 100, currency: payment.currency };

  if (event === "payment.failed") {
    await recordPayment({
      booking, paymentId: payment.id, orderId, amount: money.amount, currency: money.currency,
      mode: booking.payment_mode, method: payment.method ?? null, status: "failed", via: "webhook",
      errorCode: payment.error_code ?? null, errorDescription: payment.error_description ?? null,
      email: payment.email ?? null, contact: payment.contact ?? null, event: evt,
    });
    if (booking.status === "pending_payment" || booking.status === "expired") {
      await teleconsultBookingsRepo.update(booking.id, { failure_reason: payment.error_description || "The payment failed" });
    }
    return "failure-recorded";
  }

  // captured / authorized / order.paid — money has moved (or is held).
  if (payment.amount !== Math.round(booking.amount * 100) || payment.currency !== booking.currency) {
    logger.error("teleconsult.webhook.amount_mismatch", { bookingId: booking.id, paymentId: payment.id, expected: booking.amount * 100, got: payment.amount });
    await recordPayment({
      booking, paymentId: payment.id, orderId, amount: money.amount, currency: money.currency, mode: booking.payment_mode,
      method: payment.method ?? null, status: payment.status === "authorized" ? "authorized" : "captured", via: "webhook",
      note: `Amount mismatch: gateway ${money.amount} ${money.currency}, booking ${booking.amount} ${booking.currency} — needs staff review`,
      email: payment.email ?? null, contact: payment.contact ?? null, event: evt,
    });
    return "amount-mismatch";
  }

  if (booking.status === "confirmed") {
    await recordPayment({
      booking, paymentId: payment.id, orderId, amount: booking.amount, currency: booking.currency, mode: booking.payment_mode,
      method: payment.method ?? null, status: "captured", signatureVerified: true, via: "webhook",
      email: payment.email ?? null, contact: payment.contact ?? null, event: evt, appointmentId: booking.appointment_id,
    });
    return "already-confirmed";
  }

  if (booking.status !== "pending_payment" && booking.status !== "expired") {
    // Money arrived for a booking that is already closed (cancelled, slot lost): record it and give it back.
    await recordPayment({
      booking, paymentId: payment.id, orderId, amount: booking.amount, currency: booking.currency, mode: booking.payment_mode,
      method: payment.method ?? null, status: "captured", via: "webhook", event: evt,
      note: `Payment arrived for a ${booking.status.replace("_", " ")} booking`,
    });
    if (booking.gateway_payment_id !== payment.id) return (await refundStrayPayment(booking, payment)) ? "refunded-closed-booking" : "refund-pending";
    return `ignored-${booking.status}`;
  }

  let settled = payment;
  if (payment.status === "authorized") settled = await capturePayment(payment.id, payment.amount, payment.currency);

  const confirmed = await confirmBooking(booking.id, {
    mode: booking.payment_mode, paymentId: payment.id, via: "webhook", gatewayPayment: settled,
    signatureVerified: true, event: evt, waitForMeet: false,
  });
  return confirmed.status;
}

/** Return a payment that landed on a booking that can no longer use it. False if the gateway refused (the sweep can't see it, so staff are told via the ledger note). */
async function refundStrayPayment(booking: TeleconsultBookingRow, payment: GatewayPayment): Promise<boolean> {
  try {
    const r = await refundPayment(payment.id, payment.amount / 100);
    if (!r.refunded) return false;
    await recordPayment({
      booking, paymentId: payment.id, amount: payment.amount / 100, currency: payment.currency, mode: booking.payment_mode,
      status: "refunded", via: "webhook", refundId: r.reference, refundedAt: new Date().toISOString(),
      note: `Returned automatically: it arrived for a ${booking.status.replace("_", " ")} booking`,
    });
    return true;
  } catch (err) {
    logger.error("teleconsult.refund.stray_failed", { bookingId: booking.id, paymentId: payment.id, error: err instanceof Error ? err.message : String(err) });
    await recordPayment({
      booking, paymentId: payment.id, amount: payment.amount / 100, currency: payment.currency, mode: booking.payment_mode,
      status: "captured", via: "webhook", note: "NEEDS REFUND: automatic refund failed — refund this payment from the Razorpay dashboard",
    });
    return false;
  }
}

async function handleRefundProcessed(
  refund: { id?: string; payment_id?: string; amount?: number; status?: string } | undefined,
  eventId: string | null,
): Promise<string> {
  if (!refund?.payment_id) return "ignored-no-payment";
  const row = await findPaymentById(refund.payment_id);
  if (!row) return "unknown-payment";
  const booking = await teleconsultBookingsRepo.getRow(row.booking_id);
  if (!booking) return "unknown-booking";
  const at = new Date().toISOString();
  await recordPayment({
    booking, paymentId: refund.payment_id, amount: booking.amount, mode: booking.payment_mode, status: "refunded",
    via: "webhook", refundId: refund.id ?? null, refundedAt: at, event: { event: "refund.processed", id: eventId },
  });
  if (!booking.refunded_at) {
    await teleconsultBookingsRepo.update(booking.id, { refund_reference: refund.id ?? "refunded-in-gateway", refunded_at: at });
  }
  if (booking.appointment_id) await appointmentsRepo.update(booking.appointment_id, { payment_status: "Refunded" });
  return "refund-recorded";
}

// ── Looking the payment up at the gateway ────────────────────────────────────

/**
 * Ask the gateway whether a still-unpaid booking has actually been paid, and
 * confirm it if so. This is what rescues a payment when the webhook never
 * arrived and the patient's own confirmation call never reached us.
 */
export async function syncBooking(
  booking: TeleconsultBookingRow,
  via: "sweep" | "verify" | "staff" = "sweep",
): Promise<TeleconsultBookingRow> {
  if (gatewayMode() !== "razorpay" || !booking.gateway_order_id) return booking;
  if (booking.status !== "pending_payment" && booking.status !== "expired") return booking;

  let items: GatewayPayment[];
  try {
    items = await listOrderPayments(booking.gateway_order_id);
  } catch (err) {
    // The gateway has no such order (or won't show it to these keys): there is nothing to find. Network trouble is thrown on.
    if (err instanceof GatewayError && !err.transient) {
      logger.warn("teleconsult.sync.order_not_found", { bookingId: booking.id, orderId: booking.gateway_order_id, status: err.httpStatus });
      return booking;
    }
    throw err;
  }
  for (const p of items.filter((i) => i.status === "failed")) {
    await recordPayment({
      booking, paymentId: p.id, orderId: booking.gateway_order_id, amount: p.amount / 100, currency: p.currency,
      mode: booking.payment_mode, method: p.method ?? null, status: "failed", via,
      errorCode: p.error_code ?? null, errorDescription: p.error_description ?? null,
    });
  }
  let paid = items.find((i) => i.status === "captured") ?? items.find((i) => i.status === "authorized");
  if (!paid) return booking;

  if (paid.amount !== Math.round(booking.amount * 100) || paid.currency !== booking.currency) {
    await recordPayment({
      booking, paymentId: paid.id, orderId: booking.gateway_order_id, amount: paid.amount / 100, currency: paid.currency,
      mode: booking.payment_mode, status: "captured", via,
      note: `Amount mismatch: gateway ${paid.amount / 100} ${paid.currency}, booking ${booking.amount} ${booking.currency} — needs staff review`,
    });
    return booking;
  }
  if (paid.status === "authorized") paid = await capturePayment(paid.id, paid.amount, paid.currency);

  return confirmBooking(booking.id, {
    mode: booking.payment_mode, paymentId: paid.id, via, gatewayPayment: paid, signatureVerified: false, waitForMeet: false,
  });
}

// Don't hammer the gateway when a patient app polls: at most one lookup per booking every few seconds.
const lastLookup = new Map<number, number>();
const LOOKUP_EVERY_MS = 4_000;

async function syncIfDue(booking: TeleconsultBookingRow): Promise<TeleconsultBookingRow> {
  if (booking.status !== "pending_payment" && booking.status !== "expired") return booking;
  const last = lastLookup.get(booking.id) ?? 0;
  if (Date.now() - last < LOOKUP_EVERY_MS) return booking;
  lastLookup.set(booking.id, Date.now());
  if (lastLookup.size > 5000) lastLookup.clear();
  try {
    return await syncBooking(booking, "verify");
  } catch (err) {
    logger.warn("teleconsult.sync.failed", { bookingId: booking.id, error: err instanceof Error ? err.message : String(err) });
    return booking;
  }
}

/** Booking status for the patient app, checking the gateway if it is still unpaid. */
export async function getPortalBookingSynced(bookingId: number, patientId: number) {
  const booking = await teleconsultBookingsRepo.getRow(bookingId);
  if (!booking || booking.patient_id !== patientId) throw new NotFoundError("Booking");
  return bookingWithAppointment(await syncIfDue(booking));
}

export interface PaymentLookup {
  orderId?: string | null;
  paymentId?: string | null;
  bookingId?: number | null;
}

/**
 * "Find this transaction": by order id, payment id or booking id. Once the
 * payment is found and confirmed, returns the appointment details with it — the
 * patient app shows these straight after checkout.
 */
export async function lookupPortalPayment(patientId: number, q: PaymentLookup) {
  let booking: TeleconsultBookingRow | null = null;
  if (q.bookingId) booking = await teleconsultBookingsRepo.getRow(q.bookingId);
  if (!booking && q.orderId) booking = await teleconsultBookingsRepo.findRow([{ column: "gateway_order_id", op: "eq", value: q.orderId }]);
  if (!booking && q.paymentId) {
    const row = await findPaymentById(q.paymentId);
    booking = row
      ? await teleconsultBookingsRepo.getRow(row.booking_id)
      : await teleconsultBookingsRepo.findRow([{ column: "gateway_payment_id", op: "eq", value: q.paymentId }]);
  }
  if (!q.bookingId && !q.orderId && !q.paymentId) throw new BadRequestError("Provide orderId, paymentId or bookingId");
  if (!booking || booking.patient_id !== patientId) return { found: false as const };

  booking = await syncIfDue(booking);
  const appt = booking.appointment_id ? await appointmentsRepo.getRow(booking.appointment_id) : null;
  const payments = await paymentsForBooking(booking.id);
  const pay = (q.paymentId && payments.find((p) => p.payment_id === q.paymentId)) || payments[0] || null;

  return {
    found: true as const,
    booking: await bookingWithAppointment(booking),
    payment: pay
      ? {
          orderId: pay.order_id,
          paymentId: pay.payment_id,
          status: pay.status,
          amount: pay.amount,
          currency: pay.currency,
          method: pay.method,
          paidAt: booking.paid_at,
          refunded: !!pay.refunded_at,
          refundReference: pay.refund_id,
          signatureVerified: pay.signature_verified,
        }
      : null,
    consultation: appt ? consultationView(appt, booking) : null,
  };
}

/** Staff: re-check one booking's payment now. */
export async function syncBookingForStaff(bookingId: number, actor: Session) {
  const booking = await teleconsultBookingsRepo.getRow(bookingId);
  assertOwnedByHospital(booking, actor, "Booking");
  const before = booking.status;
  const after = await syncBooking(booking, "staff");
  await audit(actor, "sync-payment", "teleconsult", bookingId, { before, after: after.status });
  return { status: after.status, appointmentId: after.appointment_id, changed: before !== after.status };
}

// ── Sweep ────────────────────────────────────────────────────────────────────

export interface SweepStats {
  checked: number;
  confirmed: number;
  expired: number;
  refundsRetried: number;
  meetLinksCreated: number;
  errors: number;
}

let sweeping = false;

/**
 * One pass of the safety net. Idempotent and cheap when there is nothing to do,
 * so it can run on a timer in every server instance.
 */
export async function reconcile(): Promise<SweepStats> {
  const stats: SweepStats = { checked: 0, confirmed: 0, expired: 0, refundsRetried: 0, meetLinksCreated: 0, errors: 0 };
  if (sweeping) return stats;
  sweeping = true;
  try {
    // 1. Unpaid bookings: has the gateway seen a payment? If not and the hold is long gone, expire it.
    const { rows: open } = await teleconsultBookingsRepo.listRows({
      filters: [
        { column: "status", op: "in", value: ["pending_payment", "expired"] },
        { column: "created_at", op: "gte", value: new Date(Date.now() - SWEEP_MAX_AGE_MS).toISOString() },
      ],
      unpaged: true,
    });
    for (const b of open) {
      const age = ageOf(b.created_at);
      if (age > SWEEP_MAX_AGE_MS) continue;
      try {
        let current = b;
        if (b.gateway_order_id && age >= SWEEP_MIN_AGE_MS) {
          stats.checked++;
          current = await syncBooking(b, "sweep");
          if (current.status === "confirmed" || current.status === "slot_conflict") stats.confirmed++;
        }
        if (current.status === "pending_payment" && age > EXPIRE_AFTER_MIN * 60_000) {
          await teleconsultBookingsRepo.update(current.id, { status: "expired" });
          stats.expired++;
        }
      } catch (err) {
        stats.errors++;
        logger.warn("teleconsult.sweep.booking_failed", { bookingId: b.id, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // 2. Slots lost after paying whose automatic refund didn't go through: try again.
    const { rows: conflicts } = await teleconsultBookingsRepo.listRows({
      filters: [
        { column: "status", op: "eq", value: "slot_conflict" },
        { column: "created_at", op: "gte", value: new Date(Date.now() - REFUND_RETRY_MAX_AGE_MS).toISOString() },
      ],
      unpaged: true,
    });
    for (const b of conflicts) {
      if (b.refunded_at || !b.gateway_payment_id || !GATEWAY_MODES.has(b.payment_mode) || ageOf(b.created_at) > REFUND_RETRY_MAX_AGE_MS) continue;
      const r = await refundBooking(b, b.gateway_payment_id);
      if (r.done) {
        stats.refundsRetried++;
        await teleconsultBookingsRepo.update(b.id, {
          failure_reason: `That time was booked by someone else. Your payment has been refunded (${r.reference}).`,
        });
      } else stats.errors++;
    }

    // 3. Confirmed consultations still without a video link: retry Google Meet.
    const { rows: appts } = await appointmentsRepo.listRows({
      filters: [
        { column: "type", op: "eq", value: TELECONSULT_TYPE },
        { column: "status", op: "in", value: ["Upcoming", "Today"] },
      ],
      unpaged: true,
    });
    const googleByHospital = new Map<number, boolean>();
    let attempts = 0;
    for (const a of appts as AppointmentRow[]) {
      if (a.video_url || attempts >= 20 || ageOf(a.updated_at) < meetRetryAfterMs()) continue;
      // No point (and no calendar clutter) in creating a link for a consultation that is already over.
      const start = appointmentStart(a);
      if (!start || start.getTime() + 60 * 60_000 < Date.now()) continue;
      if (!googleByHospital.has(a.hospital_id)) googleByHospital.set(a.hospital_id, (await googleStatus(a.hospital_id)).connected);
      if (!googleByHospital.get(a.hospital_id)) continue;
      attempts++;
      const after = await ensureMeetLink(a.id);
      if (after.video_url) stats.meetLinksCreated++;
    }
  } finally {
    sweeping = false;
  }
  if (stats.confirmed || stats.expired || stats.refundsRetried || stats.meetLinksCreated || stats.errors) {
    logger.info("teleconsult.sweep", { ...stats });
  }
  return stats;
}

/** Run the sweep every minute for the life of the server. */
export function startReconciler(): void {
  const run = () => reconcile().catch((err) => logger.error("teleconsult.sweep.failed", { error: err instanceof Error ? err.message : String(err) }));
  setTimeout(run, 15_000).unref();
  setInterval(run, 60_000).unref();
}
