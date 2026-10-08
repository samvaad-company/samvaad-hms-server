/**
 * The tele-consult payment ledger: one row per gateway payment (or staff
 * receipt), tying the payment id and order id to the booking, the appointment,
 * the patient and the doctor.
 *
 * Several things can see the same payment at nearly the same moment — Razorpay's
 * webhook, the patient's own confirmation call, the reconciliation sweep — so
 * every write here is an upsert keyed on the payment id that only ever moves
 * forward (a "captured" row is never downgraded to "failed" by a late event)
 * and that survives losing a create race on the unique index.
 */
import { teleconsultPaymentsRepo } from "@/repositories";
import { type TeleconsultBookingRow, type TeleconsultPaymentRow } from "@/db/tables";
import { logger } from "@/lib/logger";

export type LedgerStatus = "created" | "authorized" | "captured" | "failed" | "refunded";

/** Higher wins: a payment only moves forward through these. */
const RANK: Record<string, number> = { created: 0, failed: 1, authorized: 2, captured: 3, refunded: 4 };

export function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null;
  return e?.code === 11000 || e?.code === "23505" || /duplicate key|E11000|unique constraint/i.test(String(e?.message ?? ""));
}

export interface LedgerInput {
  booking: TeleconsultBookingRow;
  paymentId: string;
  orderId?: string | null;
  /** Fee in INR (main units). */
  amount: number;
  currency?: string;
  mode: string;
  method?: string | null;
  status: LedgerStatus;
  signatureVerified?: boolean;
  via: string;
  errorCode?: string | null;
  errorDescription?: string | null;
  note?: string | null;
  email?: string | null;
  contact?: string | null;
  event?: { event: string; id: string | null };
  appointmentId?: number | null;
  refundId?: string | null;
  refundedAt?: string | null;
}

function merge(existing: TeleconsultPaymentRow, input: LedgerInput): Record<string, unknown> {
  const now = new Date().toISOString();
  const better = (RANK[input.status] ?? 0) >= (RANK[existing.status] ?? 0);
  const events = [...(existing.events ?? [])];
  if (input.event && !events.some((e) => e.id && e.id === input.event!.id)) events.push({ ...input.event, at: now });
  const notes = new Set((existing.note ?? "").split(" | ").filter(Boolean));
  if (input.note) notes.add(input.note);
  return {
    status: better ? input.status : existing.status,
    signature_verified: existing.signature_verified || !!input.signatureVerified,
    method: input.method ?? existing.method,
    order_id: input.orderId ?? existing.order_id,
    appointment_id: input.appointmentId ?? existing.appointment_id,
    gateway_email: input.email ?? existing.gateway_email,
    gateway_contact: input.contact ?? existing.gateway_contact,
    ...(better && input.status === "failed"
      ? { error_code: input.errorCode ?? null, error_description: input.errorDescription ?? null }
      : {}),
    ...(input.status === "captured" || input.status === "refunded" ? { error_code: null, error_description: null } : {}),
    refund_id: input.refundId ?? existing.refund_id,
    refunded_at: input.refundedAt ?? existing.refunded_at,
    note: [...notes].join(" | ") || null,
    events,
    updated_at: now,
  };
}

/** Create or update the ledger row for a payment id. */
export async function recordPayment(input: LedgerInput): Promise<TeleconsultPaymentRow> {
  const find = () => teleconsultPaymentsRepo.findRow([{ column: "payment_id", op: "eq", value: input.paymentId }]);
  const existing = await find();
  if (existing) return (await teleconsultPaymentsRepo.update(existing.id, merge(existing, input)))!;

  const now = new Date().toISOString();
  try {
    return await teleconsultPaymentsRepo.create({
      hospital_id: input.booking.hospital_id,
      booking_id: input.booking.id,
      appointment_id: input.appointmentId ?? input.booking.appointment_id ?? null,
      patient_id: input.booking.patient_id,
      patient_name: input.booking.patient_name,
      doctor_id: input.booking.doctor_id,
      doctor_name: input.booking.doctor_name,
      order_id: input.orderId ?? input.booking.gateway_order_id ?? null,
      payment_id: input.paymentId,
      amount: input.amount,
      currency: input.currency ?? input.booking.currency,
      mode: input.mode,
      method: input.method ?? null,
      status: input.status,
      signature_verified: !!input.signatureVerified,
      recorded_via: input.via,
      error_code: input.status === "failed" ? input.errorCode ?? null : null,
      error_description: input.status === "failed" ? input.errorDescription ?? null : null,
      note: input.note ?? null,
      gateway_email: input.email ?? null,
      gateway_contact: input.contact ?? null,
      refund_id: input.refundId ?? null,
      refunded_at: input.refundedAt ?? null,
      events: input.event ? [{ ...input.event, at: now }] : [],
    });
  } catch (err) {
    // Lost the race to another request that recorded the same payment: update theirs instead.
    if (!isDuplicateKeyError(err)) throw err;
    const winner = await find();
    if (!winner) throw err;
    logger.info("ledger.create_race_resolved", { paymentId: input.paymentId });
    return (await teleconsultPaymentsRepo.update(winner.id, merge(winner, input)))!;
  }
}

/** Point the ledger row at the appointment it paid for. */
export async function linkPaymentToAppointment(paymentId: string, appointmentId: number): Promise<void> {
  const row = await teleconsultPaymentsRepo.findRow([{ column: "payment_id", op: "eq", value: paymentId }]);
  if (row && row.appointment_id !== appointmentId) {
    await teleconsultPaymentsRepo.update(row.id, { appointment_id: appointmentId, updated_at: new Date().toISOString() });
  }
}

export async function hasSeenEvent(paymentId: string, eventId: string | null): Promise<boolean> {
  if (!eventId) return false;
  const row = await teleconsultPaymentsRepo.findRow([{ column: "payment_id", op: "eq", value: paymentId }]);
  return !!row?.events?.some((e) => e.id === eventId);
}

export async function paymentsForBooking(bookingId: number): Promise<TeleconsultPaymentRow[]> {
  const { rows } = await teleconsultPaymentsRepo.listRows({
    filters: [{ column: "booking_id", op: "eq", value: bookingId }],
    sort: [{ column: "id", direction: "desc" }],
    unpaged: true,
  });
  return rows;
}

export async function findPaymentById(paymentId: string): Promise<TeleconsultPaymentRow | null> {
  return teleconsultPaymentsRepo.findRow([{ column: "payment_id", op: "eq", value: paymentId }]);
}
