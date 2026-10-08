/**
 * Tele-consult — paid video consultations.
 *
 * A booking starts as a server-side intent ("pending_payment") priced from the
 * hospital's admin-set fee — never from anything the client sends — and becomes
 * a real appointment (type "Tele-consult") only once payment is confirmed,
 * either by the gateway's signed callback or by the patient app's signature
 * check. Confirmation is idempotent, re-checks that the slot is still free,
 * and attaches a Google Meet link when the hospital has connected Google.
 */
import { randomBytes } from "node:crypto";
import {
  appointmentsRepo,
  doctorsRepo,
  hospitalsRepo,
  patientsRepo,
  teleconsultBookingsRepo,
  teleconsultPaymentsRepo,
  usersRepo,
} from "@/repositories";
import { toAppointmentDTO } from "@/repositories/mappers";
import { type AppointmentRow, type TeleconsultBookingRow, type TeleconsultPaymentRow } from "@/db/tables";
import { AppError, BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { validate } from "@/lib/validation";
import { audit } from "@/services/audit";
import { signPayload, verifyPayload, type Session } from "@/auth/session";
import { assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import { createMeetLink, googleStatus, MEET_ACCESS_VALUES, type MeetAccess } from "@/services/google-meet";
import {
  capturePayment,
  createOrder,
  fetchPayment,
  gatewayMode,
  GatewayError,
  publicKeyId,
  refundPayment,
  verifyPaymentSignature,
  type GatewayPayment,
} from "@/services/payment-gateway";
import { isDuplicateKeyError, linkPaymentToAppointment, recordPayment } from "@/services/teleconsult-ledger";
import { logger } from "@/lib/logger";
import { localDate, parseClock, to12h, zonedInstant } from "@/lib/clock";
import {
  assertSlot,
  DEFAULT_SLOT_MINUTES,
  patientRescheduleInfo,
  HOLD_MINUTES,
  loadDoctor,
  patientsPerHourOf,
  slotMinutesOf,
  slotsFor,
  videoOn,
} from "@/services/scheduling-service";

export const TELECONSULT_TYPE = "Tele-consult";
/** How long the patient's confirmation waits on Razorpay before relying on the checkout signature alone. */
const verifyLookupBudgetMs = () => Number(process.env.TELECONSULT_VERIFY_BUDGET_MS ?? 7_000);

// ── Settings ─────────────────────────────────────────────────────────────────

export async function teleconsultConfig(hospitalId: number) {
  const hospital = await hospitalsRepo.getRow(hospitalId);
  if (!hospital) throw new NotFoundError("Hospital");
  const google = await googleStatus(hospitalId);
  return {
    enabled: !!hospital.teleconsult_enabled,
    price: hospital.teleconsult_price ?? null,
    currency: "INR",
    gatewayMode: gatewayMode(),
    google,
  };
}

async function loadHospitalForBooking(hospitalId: number) {
  const hospital = await hospitalsRepo.getRow(hospitalId);
  if (!hospital) throw new NotFoundError("Hospital");
  if (!hospital.teleconsult_enabled) {
    throw new BadRequestError("Video consultations aren't available at this hospital right now");
  }
  if (hospital.teleconsult_price == null) {
    throw new BadRequestError("This hospital hasn't set a video-consultation fee yet");
  }
  return hospital;
}

// ── Booking creation ─────────────────────────────────────────────────────────

/** A usable email, normalised — or null. Used where a bad address must not block a payment. */
export function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const e = value.trim().toLowerCase();
  return e.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

const bookingSchema = {
  patientId: { type: "number", required: true, min: 1 },
  doctorId: { type: "number", required: true, min: 1 },
  date: { type: "string", required: true, pattern: /^\d{4}-\d{2}-\d{2}$/ },
  time: { type: "string", required: true, max: 20 },
  reason: { type: "string", required: true, min: 2, max: 240 },
  email: { type: "string", required: false, max: 160, pattern: /.+@.+\..+/ },
} as const;

const staffSchema = {
  ...bookingSchema,
  paymentMode: { type: "enum", required: true, values: ["cash", "upi", "card", "waived"] },
  reference: { type: "string", required: false, max: 80 },
} as const;

/** Validate everything a booking needs and return the resolved records. Shared by the portal and staff paths. */
async function prepare(data: { patientId: number; doctorId: number; date: string; time: string; email?: string }, hospitalIdScope: number | null) {
  const patient = await patientsRepo.getRow(data.patientId);
  if (!patient || (hospitalIdScope != null && patient.hospital_id !== hospitalIdScope)) throw new NotFoundError("Patient");
  const hospitalId = patient.hospital_id;
  const hospital = await loadHospitalForBooking(hospitalId);

  const doctor = await doctorsRepo.getRow(data.doctorId);
  if (!doctor || doctor.hospital_id !== hospitalId) throw new NotFoundError("Doctor");

  const minutes = parseClock(data.time);
  if (minutes == null) throw new BadRequestError("Time must look like 10:30 or 10:30 AM");
  // The doctor's own rules: do they take video consultations, is this one of their video times, is it still free.
  await assertSlot({ doctor, hospital, date: data.date, minutes, mode: "video" });

  return { patient, hospital, doctor, minutes, hospitalId, email: data.email?.trim().toLowerCase() || patient.email || null };
}

export function toBookingDTO(b: TeleconsultBookingRow, appt?: AppointmentRow | null) {
  return {
    id: b.id,
    status: b.status,
    amount: b.amount,
    currency: b.currency,
    paymentMode: b.payment_mode,
    patientId: b.patient_id,
    doctorId: b.doctor_id,
    doctorName: b.doctor_name,
    date: b.appointment_date,
    time: b.appointment_time,
    appointmentId: b.appointment_id,
    videoUrl: appt?.video_url ?? null,
    failureReason: b.failure_reason,
  };
}

export async function bookingWithAppointment(b: TeleconsultBookingRow) {
  const appt = b.appointment_id ? await appointmentsRepo.getRow(b.appointment_id) : null;
  return toBookingDTO(b, appt);
}

function paymentInfo(
  booking: TeleconsultBookingRow,
  order: { id: string; amount: number; currency: string },
  hospitalName: string,
  patient: { name: string; phone: string },
) {
  return {
    mode: booking.payment_mode,
    keyId: publicKeyId(),
    orderId: order.id,
    amountPaise: order.amount,
    currency: order.currency,
    hospitalName,
    prefill: { name: patient.name, contact: patient.phone, email: booking.patient_email ?? "" },
  };
}

/**
 * Patient-side booking (portal app or the HMS booking link): price from the
 * hospital, payment through the gateway. Asking again for a slot the patient is
 * already paying for hands back the same open order instead of colliding with
 * their own hold.
 */
export async function createPortalBooking(input: unknown, source: "portal" | "link" = "portal") {
  const data = validate(bookingSchema, input);

  const cutoff = Date.now() - HOLD_MINUTES * 60_000;
  const { rows: mine } = await teleconsultBookingsRepo.listRows({
    filters: [
      { column: "patient_id", op: "eq", value: data.patientId },
      { column: "status", op: "eq", value: "pending_payment" },
    ],
    unpaged: true,
  });
  const live = mine.filter((b) => new Date(b.created_at).getTime() > cutoff);
  const wantedMinutes = parseClock(data.time);
  const same = live.find(
    (b) => b.doctor_id === data.doctorId && b.appointment_date === data.date && parseClock(b.appointment_time) === wantedMinutes && b.gateway_order_id,
  );
  if (same) {
    const email = cleanEmail(data.email);
    if (email && email !== same.patient_email) same.patient_email = (await teleconsultBookingsRepo.update(same.id, { patient_email: email }))!.patient_email;
    const [patient, hospital] = await Promise.all([patientsRepo.getRow(same.patient_id), hospitalsRepo.getRow(same.hospital_id)]);
    return {
      booking: toBookingDTO(same),
      payment: paymentInfo(same, { id: same.gateway_order_id!, amount: Math.round(same.amount * 100), currency: same.currency }, hospital?.name ?? "", patient ?? { name: same.patient_name, phone: "" }),
    };
  }
  if (live.length >= 3) {
    throw new ConflictError("You already have payments in progress — finish or wait a few minutes before starting another");
  }

  const { patient, hospital, doctor, minutes, hospitalId, email } = await prepare(data, null);
  const amount = Number(hospital.teleconsult_price);

  const booking = await teleconsultBookingsRepo.create({
    hospital_id: hospitalId,
    patient_id: patient.id,
    patient_name: patient.name,
    patient_email: email,
    doctor_id: doctor.id,
    doctor_name: doctor.name,
    appointment_date: data.date,
    appointment_time: to12h(minutes),
    reason: data.reason,
    amount,
    currency: "INR",
    source,
    status: "pending_payment",
    payment_mode: amount === 0 ? "free" : gatewayMode(),
    gateway_order_id: null,
    gateway_payment_id: null,
    paid_at: null,
    appointment_id: null,
    failure_reason: null,
    created_by: null,
  });

  if (amount === 0) {
    const confirmed = await confirmBooking(booking.id, { mode: "free", paymentId: null, via: "system" });
    return { booking: await bookingWithAppointment(confirmed), payment: null };
  }

  const order = await createOrder(amount, `tc${booking.id}`, {
    booking_id: String(booking.id),
    patient_id: String(patient.id),
    hospital_id: String(hospitalId),
    app: "samvaad-hms-teleconsult",
  });
  const row = (await teleconsultBookingsRepo.update(booking.id, { gateway_order_id: order.id }))!;
  return { booking: toBookingDTO(row), payment: paymentInfo(row, order, hospital.name, patient) };
}

/** Staff booking (tele-caller / admin): payment was taken outside the system, so it confirms immediately. */
export async function createStaffBooking(input: unknown, actor: Session) {
  const hospitalId = requireHospitalId(actor);
  const data = validate(staffSchema, input);
  if (data.paymentMode === "waived" && actor.role !== "Super Admin" && actor.role !== "Platform Admin") {
    throw new ForbiddenError("Only an admin can waive the consultation fee");
  }
  const { patient, hospital, doctor, minutes, email } = await prepare(data, hospitalId);
  const amount = data.paymentMode === "waived" ? 0 : Number(hospital.teleconsult_price);

  const booking = await teleconsultBookingsRepo.create({
    hospital_id: hospitalId,
    patient_id: patient.id,
    patient_name: patient.name,
    patient_email: email,
    doctor_id: doctor.id,
    doctor_name: doctor.name,
    appointment_date: data.date,
    appointment_time: to12h(minutes),
    reason: data.reason,
    amount,
    currency: "INR",
    source: "staff",
    status: "pending_payment",
    payment_mode: data.paymentMode,
    gateway_order_id: null,
    gateway_payment_id: data.reference ?? null,
    paid_at: null,
    appointment_id: null,
    failure_reason: null,
    created_by: actor.userId,
  });
  const confirmed = await confirmBooking(booking.id, {
    mode: data.paymentMode, paymentId: offlinePaymentId(booking, data.paymentMode, data.reference ?? null), via: "staff", actor,
  });
  await audit(actor, "create", "teleconsult", confirmed.id, { amount, mode: data.paymentMode });
  return bookingWithAppointment(confirmed);
}

// ── Confirmation ─────────────────────────────────────────────────────────────

export interface ConfirmInfo {
  /** razorpay | mock | cash | upi | card | waived | free */
  mode: string;
  /** Gateway payment id, or the staff receipt reference. */
  paymentId: string | null;
  /** What saw the payment: verify | webhook | sweep | staff | system. */
  via: "verify" | "webhook" | "sweep" | "staff" | "system";
  actor?: Session;
  /** The gateway's own record of the payment, when we have it. */
  gatewayPayment?: GatewayPayment | null;
  /** The checkout signature was verified (the payment is genuine for this order). */
  signatureVerified?: boolean;
  /** Webhook event, for the ledger. */
  event?: { event: string; id: string | null };
  /** Wait for the Meet link before returning (the patient is watching); webhooks don't, to answer Razorpay quickly. */
  waitForMeet?: boolean;
}

/** The doctor's slot length now, recorded on the appointment so its length never shifts if they change it later. */
async function slotLengthFor(doctorId: number): Promise<number> {
  const d = await doctorsRepo.getRow(doctorId);
  return d ? slotMinutesOf(d) : DEFAULT_SLOT_MINUTES;
}

const PAYMENT_LABEL: Record<string, string> = { waived: "Waived", free: "Free" };
const GATEWAY_MODES = new Set(["razorpay", "mock"]);

/** The id the ledger and the appointment carry for a payment that has no gateway id (staff receipts, free, waived). */
function offlinePaymentId(booking: TeleconsultBookingRow, mode: string, reference: string | null): string {
  return reference?.trim() || `${mode.toUpperCase()}-${booking.id}`;
}

async function doctorEmail(doctorId: number, hospitalId: number): Promise<string> {
  const user = await usersRepo.findRow([
    { column: "doctor_id", op: "eq", value: doctorId },
    { column: "hospital_id", op: "eq", value: hospitalId },
  ]);
  return user?.email ?? "";
}

/**
 * Try to attach a Meet link to a tele-consult appointment. Never throws — the
 * appointment stands either way; a failure is recorded on it so staff can retry
 * or paste a link by hand (and the reconciliation sweep retries it too).
 */
export async function ensureMeetLink(appointmentId: number, opts: { replace?: boolean } = {}): Promise<AppointmentRow> {
  const appt = await appointmentsRepo.getRow(appointmentId);
  if (!appt) throw new NotFoundError("Appointment");
  if (appt.video_url && !opts.replace) return appt;
  const hospitalId = appt.hospital_id;
  const minutes = parseClock(appt.appointment_time);
  try {
    if (minutes == null) throw new Error("The appointment time couldn't be read");
    const patient = appt.patient_id ? await patientsRepo.getRow(appt.patient_id) : null;
    const booking = appt.booking_id ? await teleconsultBookingsRepo.getRow(appt.booking_id) : null;
    const hospital = await hospitalsRepo.getRow(hospitalId);
    const access = MEET_ACCESS_VALUES.includes(hospital?.teleconsult_meet_access as MeetAccess) ? (hospital!.teleconsult_meet_access as MeetAccess) : "OPEN";
    const start = zonedInstant(appt.appointment_date, minutes);
    // Hex digits are valid in a calendar event id (0-9, a-v) and unique per call, however close together two replacements are.
    const nonce = randomBytes(5).toString("hex");
    const meet = await createMeetLink(hospitalId, {
      summary: `Video consultation — ${appt.patient_name} with ${appt.doctor}`,
      description: `Samvaad tele-consult. Reason: ${appt.reason || "—"}`,
      start,
      end: new Date(start.getTime() + (appt.slot_minutes ?? DEFAULT_SLOT_MINUTES) * 60_000),
      // The email given with the payment wins over the one on the patient's record; no one is invited twice.
      attendees: [...new Set([booking?.patient_email ?? patient?.email ?? "", appt.doctor_id ? await doctorEmail(appt.doctor_id, hospitalId) : ""].map((e) => e.trim().toLowerCase()).filter(Boolean))],
      requestId: `samvaad-tc-${appt.id}${opts.replace ? `-${nonce}` : ""}`,
      // A replacement needs a calendar event of its own; the original stays where it is.
      eventId: opts.replace ? `samvaadtc${appt.id}x${nonce}` : `samvaadtc${appt.id}`,
      access,
    });
    // Re-read before writing: staff may have pasted a link while Google was thinking.
    const latest = await appointmentsRepo.getRow(appt.id);
    if (latest?.video_url && !opts.replace) return latest;
    return (await appointmentsRepo.update(appt.id, {
      video_url: meet.url, video_provider: "google_meet", meet_error: null, meet_access: meet.access, meet_warning: meet.warning ?? null,
      meet_event_id: meet.eventId || null,
    }))!;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't create the Meet link";
    logger.warn("teleconsult.meet.failed", { appointmentId, message });
    // A failed replacement leaves the working link alone and just says what happened.
    if (appt.video_url) return (await appointmentsRepo.update(appt.id, { meet_warning: `Couldn't create a new link: ${message}` }))!;
    return (await appointmentsRepo.update(appt.id, { meet_error: message }))!;
  }
}

// One confirmation per booking at a time within this process; across processes the
// unique index on appointments.booking_id is what keeps a second appointment out.
const lockTails = new Map<number, Promise<void>>();
async function withBookingLock<T>(id: number, fn: () => Promise<T>): Promise<T> {
  const prev = lockTails.get(id) ?? Promise.resolve();
  let release: () => void = () => {};
  const mine = new Promise<void>((resolve) => { release = resolve; });
  const tail = prev.then(() => mine);
  lockTails.set(id, tail);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (lockTails.get(id) === tail) lockTails.delete(id);
  }
}

export interface RefundOutcome {
  done: boolean;
  reference: string;
  /** Set when the gateway refused or couldn't be reached — the sweep will try again. */
  error?: string;
}

/**
 * Return a booking's fee through the gateway and record it on the booking and in
 * the ledger. Idempotent: a booking that is already refunded reports done.
 * Offline payments (cash/UPI/card) can't be refunded by the system and report not-done.
 */
export async function refundBooking(booking: TeleconsultBookingRow, paymentId: string | null): Promise<RefundOutcome> {
  if (booking.refunded_at) return { done: true, reference: booking.refund_reference ?? "" };
  if (!paymentId || booking.amount <= 0 || !GATEWAY_MODES.has(booking.payment_mode)) return { done: false, reference: "" };
  try {
    const r = await refundPayment(paymentId, booking.amount);
    if (!r.refunded) return { done: false, reference: "" };
    const at = new Date().toISOString();
    await teleconsultBookingsRepo.update(booking.id, { refund_reference: r.reference, refunded_at: at });
    await recordPayment({
      booking, paymentId, amount: booking.amount, mode: booking.payment_mode, status: "refunded",
      via: "system", refundId: r.reference, refundedAt: at,
    });
    return { done: true, reference: r.reference };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    logger.error("teleconsult.refund.failed", { bookingId: booking.id, paymentId, error });
    return { done: false, reference: "", error };
  }
}

/** The patient's money moved but the slot is gone: close the booking and give the money back (the sweep retries if that fails). */
async function failForSlotConflict(booking: TeleconsultBookingRow, paymentId: string | null): Promise<TeleconsultBookingRow> {
  // Never refund a booking another process confirmed while we were deciding.
  const latest = await teleconsultBookingsRepo.getRow(booking.id);
  if (latest?.status === "confirmed") return latest;
  let note = "That time was booked by someone else.";
  if (GATEWAY_MODES.has(booking.payment_mode) && paymentId && booking.amount > 0) {
    const refund = await refundBooking(booking, paymentId);
    note += refund.done
      ? ` Your payment has been refunded (${refund.reference}).`
      : " We'll refund your payment automatically — if it doesn't arrive in a few days, the hospital will refund you.";
  }
  return (await teleconsultBookingsRepo.update(booking.id, {
    status: "slot_conflict", gateway_payment_id: paymentId ?? booking.gateway_payment_id, failure_reason: note,
  }))!;
}

/**
 * Turn a paid (or staff-collected) booking into a Tele-consult appointment.
 * Safe to call any number of times, from the webhook, the patient's own call,
 * the sweep and staff at once: it confirms exactly one appointment, links it to
 * the payment ids, and re-checks that the slot is still free.
 */
export function confirmBooking(bookingId: number, info: ConfirmInfo): Promise<TeleconsultBookingRow> {
  return withBookingLock(bookingId, () => confirmLocked(bookingId, info));
}

async function confirmLocked(bookingId: number, info: ConfirmInfo): Promise<TeleconsultBookingRow> {
  let booking = await teleconsultBookingsRepo.getRow(bookingId);
  if (!booking) throw new NotFoundError("Booking");
  if (booking.status === "confirmed") return booking;
  // "expired" is allowed on purpose: a payment can land long after the hold ran out.
  if (booking.status !== "pending_payment" && booking.status !== "expired") {
    throw new ConflictError(`This booking is ${booking.status.replace("_", " ")} and can't be confirmed`);
  }

  const paymentId = info.paymentId ?? (GATEWAY_MODES.has(info.mode) ? null : offlinePaymentId(booking, info.mode, null));
  const gp = info.gatewayPayment ?? null;
  // No email came with the booking or the confirmation: use the one the patient typed into the payment window,
  // so the calendar invite (and the link in their inbox) still reaches them.
  const gatewayEmail = cleanEmail(gp?.email);
  if (!booking.patient_email && gatewayEmail) {
    booking = (await teleconsultBookingsRepo.update(booking.id, { patient_email: gatewayEmail }))!;
  }
  if (paymentId) {
    await recordPayment({
      booking, paymentId, orderId: gp?.order_id ?? booking.gateway_order_id,
      amount: booking.amount, currency: booking.currency, mode: info.mode, method: gp?.method ?? null,
      status: "captured", signatureVerified: info.signatureVerified, via: info.via,
      email: gp?.email ?? null, contact: gp?.contact ?? null, event: info.event,
      note: info.via === "verify" && !gp ? "Confirmed from the checkout signature; the gateway lookup was unavailable" : null,
    });
  }

  // A previous attempt may have created the appointment and then failed before saving the booking.
  let appt = await appointmentsRepo.findRow([{ column: "booking_id", op: "eq", value: booking.id }]);

  if (!appt) {
    try {
      // Only whether the place is still free: a booking that was paid for stands even if the doctor changed their hours since.
      const { doctor: bookedDoctor, hospital: bookedHospital } = await loadDoctor(booking.doctor_id);
      await assertSlot({
        doctor: bookedDoctor, hospital: bookedHospital, date: booking.appointment_date,
        minutes: parseClock(booking.appointment_time)!, mode: "video", occupancyOnly: true, excludeBookingId: booking.id,
      });
    } catch (err) {
      if (!(err instanceof ConflictError)) throw err;
      return failForSlotConflict(booking, paymentId);
    }

    const patient = await patientsRepo.getRow(booking.patient_id);
    try {
      appt = (await appointmentsRepo.create({
        hospital_id: booking.hospital_id,
        patient_id: booking.patient_id,
        patient_name: booking.patient_name,
        patient_age: patient?.age ?? 0,
        doctor_id: booking.doctor_id,
        doctor: booking.doctor_name,
        appointment_date: booking.appointment_date,
        appointment_time: booking.appointment_time,
        type: TELECONSULT_TYPE,
        reason: booking.reason,
        status: "Upcoming",
        consult_amount: booking.amount,
        slot_minutes: await slotLengthFor(booking.doctor_id),
        payment_status: PAYMENT_LABEL[info.mode] ?? "Paid",
        booking_id: booking.id,
        payment_id: paymentId,
        order_id: booking.gateway_order_id,
        video_url: null,
        video_provider: null,
        meet_error: null,
      })) as AppointmentRow;
    } catch (err) {
      // Another process confirmed this booking first (the unique index on booking_id said no): use theirs.
      if (!isDuplicateKeyError(err)) throw err;
      appt = await appointmentsRepo.findRow([{ column: "booking_id", op: "eq", value: booking.id }]);
      if (!appt) throw err;
    }
  }

  // Belt and braces for stores without the unique index: keep the oldest, drop the rest.
  const { rows: dupes } = await appointmentsRepo.listRows({
    filters: [{ column: "booking_id", op: "eq", value: booking.id }],
    unpaged: true,
  });
  const keeper = dupes.reduce((a, b) => (b.id < a.id ? b : a), appt);
  for (const d of dupes) if (d.id !== keeper.id) await appointmentsRepo.remove(d.id);

  booking = (await teleconsultBookingsRepo.update(booking.id, {
    status: "confirmed",
    appointment_id: keeper.id,
    gateway_payment_id: paymentId ?? booking.gateway_payment_id,
    paid_at: new Date().toISOString(),
    failure_reason: null,
  }))!;
  if (paymentId) await linkPaymentToAppointment(paymentId, keeper.id);
  await audit(info.actor ?? null, "confirm", "teleconsult", booking.id, {
    appointmentId: keeper.id, mode: info.mode, amount: booking.amount, paymentId, via: info.via,
  });

  if (info.waitForMeet === false) {
    void ensureMeetLink(keeper.id).catch((e) => logger.warn("teleconsult.meet.background_failed", { appointmentId: keeper.id, error: String(e) }));
  } else {
    await ensureMeetLink(keeper.id);
  }
  return booking;
}

// ── Patient confirmation ─────────────────────────────────────────────────────

/**
 * The patient app (or the booking page) reports a finished checkout. The
 * signature proves the payment is genuine for this order; the gateway is asked
 * too, to make sure the money is actually captured (capturing it if the account
 * only authorizes) and to record how it was paid. If the gateway can't be
 * reached the signature alone is enough — the amount is fixed by the order we
 * created — and the webhook/sweep will back-fill the details.
 */
export async function verifyPortalPayment(bookingId: number, input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  const patientId = Number(body.patientId);
  const orderId = String(body.razorpay_order_id ?? "");
  const paymentId = String(body.razorpay_payment_id ?? "");
  const signature = String(body.razorpay_signature ?? "");

  const booking = await teleconsultBookingsRepo.getRow(bookingId);
  if (!booking || booking.patient_id !== patientId || booking.source === "staff") throw new NotFoundError("Booking");
  if (booking.status === "confirmed") return bookingWithAppointment(booking);
  if (booking.status === "slot_conflict") return bookingWithAppointment(booking);
  if (!booking.gateway_order_id || booking.gateway_order_id !== orderId) {
    throw new BadRequestError("That payment doesn't belong to this booking");
  }
  if (!verifyPaymentSignature(orderId, paymentId, signature)) {
    logger.warn("teleconsult.verify.bad_signature", { bookingId });
    throw new BadRequestError("Payment couldn't be verified");
  }

  // The patient's email can arrive with the confirmation too (the payment window is where many apps collect it).
  // Only once the payment is genuine; a malformed one is ignored rather than allowed to block a payment that went through.
  const email = cleanEmail(body.email);
  if (email && email !== booking.patient_email) booking.patient_email = (await teleconsultBookingsRepo.update(booking.id, { patient_email: email }))!.patient_email;

  let gp: GatewayPayment | null = null;
  if (gatewayMode() === "razorpay") {
    try {
      // The patient is waiting: don't let a slow gateway hold the request open (the signature is enough to go on).
      gp = await Promise.race([
        fetchPayment(paymentId),
        new Promise<never>((_, reject) => setTimeout(() => reject(new GatewayError(0, "The payment gateway timed out")), verifyLookupBudgetMs()).unref()),
      ]);
    } catch (err) {
      if (err instanceof GatewayError && !err.transient) throw new BadRequestError("The payment gateway has no record of that payment");
      logger.warn("teleconsult.verify.gateway_unavailable", { bookingId, error: err instanceof Error ? err.message : String(err) });
    }
    if (gp) gp = await settleGatewayPayment(booking, gp, orderId);
  }

  const confirmed = await confirmBooking(booking.id, {
    mode: booking.payment_mode, paymentId, via: "verify", gatewayPayment: gp, signatureVerified: true,
  });
  return bookingWithAppointment(confirmed);
}

/**
 * Check a gateway payment against its booking and make sure it is captured.
 * Throws for a payment that isn't (or can't become) a successful one for this
 * booking; returns the settled payment otherwise.
 */
export async function settleGatewayPayment(booking: TeleconsultBookingRow, gp: GatewayPayment, orderId: string): Promise<GatewayPayment> {
  if (gp.order_id && gp.order_id !== orderId) throw new BadRequestError("That payment doesn't belong to this booking");
  if (gp.amount !== Math.round(booking.amount * 100) || gp.currency !== booking.currency) {
    logger.error("teleconsult.payment.amount_mismatch", { bookingId: booking.id, paymentId: gp.id, expected: booking.amount * 100, got: gp.amount });
    await recordPayment({
      booking, paymentId: gp.id, orderId, amount: gp.amount / 100, currency: gp.currency, mode: booking.payment_mode,
      status: "captured", via: "verify", note: `Amount mismatch: gateway ${gp.amount / 100} ${gp.currency}, booking ${booking.amount} ${booking.currency} — needs staff review`,
    });
    throw new ConflictError("The amount paid doesn't match this booking — the hospital will look into it");
  }
  if (gp.status === "authorized") return capturePayment(gp.id, gp.amount, gp.currency);
  if (gp.status === "captured") return gp;
  if (gp.status === "refunded") throw new ConflictError("That payment was already refunded");
  throw new ConflictError("The payment hasn't gone through yet");
}

export async function getPortalBooking(bookingId: number, patientId: number) {
  const booking = await teleconsultBookingsRepo.getRow(bookingId);
  if (!booking || booking.patient_id !== patientId) throw new NotFoundError("Booking");
  return bookingWithAppointment(booking);
}

// ── Staff actions on an existing tele-consult ────────────────────────────────

async function loadOwnConsult(id: number, actor: Session): Promise<AppointmentRow> {
  const appt = await appointmentsRepo.getRow(id);
  assertOwnedByHospital(appt, actor, "Appointment");
  if (appt.type !== TELECONSULT_TYPE) throw new BadRequestError("That isn't a video consultation");
  if (actor.role === "Doctor" && actor.doctorId !== appt.doctor_id) throw new NotFoundError("Appointment");
  return appt;
}

/** Paste a video link by hand (Meet, Zoom, …) — the fallback when Google isn't connected or failed. */
export async function setConsultLink(id: number, input: unknown, actor: Session) {
  const appt = await loadOwnConsult(id, actor);
  const raw = String((input as { videoUrl?: unknown })?.videoUrl ?? "").trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestError("Enter the full link, starting with https://");
  }
  if (url.protocol !== "https:") throw new BadRequestError("The link must start with https://");
  const row = await appointmentsRepo.update(appt.id, { video_url: url.toString(), video_provider: "manual", meet_error: null });
  await audit(actor, "set-link", "teleconsult", id);
  return toAppointmentDTO(row as AppointmentRow);
}

/** Create the Google Meet link, or with `replace` make a fresh room (e.g. to fix a link patients can't open). */
export async function retryMeetLink(id: number, actor: Session, replace = false) {
  const appt = await loadOwnConsult(id, actor);
  if (appt.status === "Cancelled" || appt.status === "Completed") throw new ConflictError("This consultation is over");
  const row = await ensureMeetLink(appt.id, { replace });
  await audit(actor, replace ? "recreate-meet" : "retry-meet", "teleconsult", id, { ok: !!row.video_url });
  return toAppointmentDTO(row);
}

// ── Slots ────────────────────────────────────────────────────────────────────

/** Video-consultation times for a doctor on a date, with what is booked or full marked. */
export async function availableSlots(hospitalId: number, doctorId: number, date: string) {
  const { doctor } = await loadDoctor(doctorId);
  if (doctor.hospital_id !== hospitalId) throw new NotFoundError("Doctor");
  return slotsFor({ doctorId, date, mode: "video" });
}

// ── Booking link (patient-facing page in the web app) ────────────────────────

const LINK_PURPOSE = "teleconsult-link";
const LINK_TTL_SECONDS = 7 * 24 * 3600;

/** A signed, expiring link a tele-caller sends to one patient. The token is the only credential the public page has. */
export async function createBookingLink(patientId: number, actor: Session) {
  const hospitalId = requireHospitalId(actor);
  const patient = await patientsRepo.getRow(patientId);
  assertOwnedByHospital(patient, actor, "Patient");
  await loadHospitalForBooking(hospitalId);
  const { token, expiresAt } = await signPayload(LINK_PURPOSE, { p: patient.id, h: hospitalId }, LINK_TTL_SECONDS);
  await audit(actor, "create-link", "teleconsult", patient.id);
  return { token, path: `/book-video/${token}`, expiresAt, patientName: patient.name, patientPhone: patient.phone };
}

export async function resolveBookingLink(token: string | null | undefined): Promise<{ patientId: number; hospitalId: number }> {
  const payload = await verifyPayload<{ p: number; h: number }>(LINK_PURPOSE, token);
  if (!payload) throw new BadRequestError("This booking link has expired — ask the hospital to send you a new one");
  return { patientId: payload.p, hospitalId: payload.h };
}

/** What the public booking page may know: the hospital, the patient's first name, the fee and the doctors to choose from. */
export async function publicBookingSession(token: string | null) {
  const { patientId, hospitalId } = await resolveBookingLink(token);
  const [patient, hospital] = await Promise.all([patientsRepo.getRow(patientId), hospitalsRepo.getRow(hospitalId)]);
  if (!patient || !hospital || patient.hospital_id !== hospitalId) throw new NotFoundError("Booking link");
  const enabled = !!hospital.teleconsult_enabled && hospital.teleconsult_price != null;
  const { rows: doctors } = await doctorsRepo.listRows({
    filters: [{ column: "hospital_id", op: "eq", value: hospitalId }],
    unpaged: true,
  });
  return {
    hospitalName: hospital.name,
    patientFirstName: patient.name.split(" ")[0],
    enabled,
    price: hospital.teleconsult_price ?? null,
    currency: "INR",
    paymentMode: gatewayMode(),
    doctors: doctors
      .filter((d) => d.status !== "On Leave" && videoOn(d, hospital))
      .map((d) => ({ id: d.id, name: d.name, specialty: d.specialty, patientsPerHour: patientsPerHourOf(d) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ── Payments & refunds (staff) ───────────────────────────────────────────────

export async function listPayments(actor: Session) {
  const hospitalId = requireHospitalId(actor);
  const [{ rows }, { rows: ledger }] = await Promise.all([
    teleconsultBookingsRepo.listRows({
      filters: [{ column: "hospital_id", op: "eq", value: hospitalId }],
      sort: [{ column: "id", direction: "desc" }],
      unpaged: true,
    }),
    teleconsultPaymentsRepo.listRows({
      filters: [{ column: "hospital_id", op: "eq", value: hospitalId }],
      sort: [{ column: "id", direction: "asc" }],
      unpaged: true,
    }),
  ]);
  // Latest ledger row per booking (the payment that counts).
  const byBooking = new Map<number, TeleconsultPaymentRow>();
  for (const row of ledger) byBooking.set(row.booking_id, row);

  const mine = actor.role === "Doctor" ? rows.filter((b) => b.doctor_id === actor.doctorId) : rows;
  const fresh = Date.now() - HOLD_MINUTES * 60_000;
  const items = mine
    // Abandoned checkouts are noise; keep anything that was paid, refunded or failed.
    .filter((b) => (b.status !== "pending_payment" && b.status !== "expired") || byBooking.has(b.id) || new Date(b.created_at).getTime() > fresh)
    .map((b) => {
      const pay = byBooking.get(b.id) ?? null;
      const state =
        b.refunded_at ? "Refunded"
        : b.status === "confirmed" ? (b.payment_mode === "waived" ? "Waived" : b.payment_mode === "free" ? "Free" : "Paid")
        : b.status === "pending_payment" ? "Awaiting payment"
        : b.status === "expired" ? "Expired"
        : b.status === "slot_conflict" ? "Slot lost"
        : b.status === "cancelled" ? "Cancelled"
        : "Failed";
      return {
        id: b.id,
        patientId: b.patient_id,
        patientName: b.patient_name,
        doctorId: b.doctor_id,
        doctorName: b.doctor_name,
        date: b.appointment_date,
        time: b.appointment_time,
        amount: b.amount,
        currency: b.currency,
        mode: b.payment_mode,
        /** card / upi / netbanking … when the gateway told us. */
        method: pay?.method ?? null,
        source: b.source,
        status: state,
        paymentId: b.gateway_payment_id ?? pay?.payment_id ?? null,
        orderId: b.gateway_order_id,
        /** What recorded the payment: verify (patient's own confirmation), webhook, sweep or staff. */
        recordedVia: pay?.recorded_via ?? null,
        signatureVerified: pay?.signature_verified ?? null,
        paidAt: b.paid_at,
        refundReference: b.refund_reference ?? null,
        refundedAt: b.refunded_at ?? null,
        appointmentId: b.appointment_id,
        note: [b.failure_reason, pay?.note].filter(Boolean).join(" | ") || null,
        createdAt: b.created_at,
      };
    });
  const collected = items.filter((i) => i.status === "Paid").reduce((n, i) => n + i.amount, 0);
  const refunded = items.filter((i) => i.status === "Refunded").reduce((n, i) => n + i.amount, 0);
  return { items, totals: { collected, refunded, net: collected, count: items.length } };
}

/**
 * Cancel a tele-consult and (optionally) give the fee back. Online payments are
 * refunded through the gateway; a cash/UPI/card fee can't be returned by the
 * system, so it's recorded for staff to hand back.
 */
export async function cancelConsult(id: number, input: unknown, actor: Session) {
  const appt = await loadOwnConsult(id, actor);
  if (appt.status === "Cancelled") throw new ConflictError("This consultation is already cancelled");
  if (appt.status === "Completed") throw new ConflictError("A completed consultation can't be cancelled");
  const wantRefund = (input as { refund?: unknown } | null)?.refund !== false;

  const booking = appt.booking_id ? await teleconsultBookingsRepo.getRow(appt.booking_id) : null;
  let refund: { done: boolean; reference: string; manual: boolean } = { done: false, reference: "", manual: false };

  if (booking && wantRefund && booking.amount > 0 && booking.status === "confirmed" && !booking.refunded_at) {
    if (GATEWAY_MODES.has(booking.payment_mode)) {
      const r = await refundBooking(booking, booking.gateway_payment_id);
      // Don't cancel an appointment whose refund failed: the patient would lose both. Staff can retry.
      if (!r.done) throw new AppError(502, "INTERNAL", `The refund couldn't be issued (${r.error ?? "payment gateway unavailable"}). Nothing was cancelled — please try again.`);
      refund = { done: true, reference: r.reference, manual: false };
    } else if (["cash", "upi", "card"].includes(booking.payment_mode)) {
      refund = { done: true, reference: `Return ₹${booking.amount} to the patient (${booking.payment_mode})`, manual: true };
      const at = new Date().toISOString();
      await teleconsultBookingsRepo.update(booking.id, { refund_reference: refund.reference, refunded_at: at });
      if (booking.gateway_payment_id) {
        await recordPayment({ booking, paymentId: booking.gateway_payment_id, amount: booking.amount, mode: booking.payment_mode, status: "refunded", via: "staff", refundId: refund.reference, refundedAt: at });
      }
    }
  }

  if (booking) await teleconsultBookingsRepo.update(booking.id, { status: "cancelled" });
  const row = await appointmentsRepo.update(appt.id, { status: "Cancelled", payment_status: refund.done ? "Refunded" : appt.payment_status });
  await audit(actor, "cancel", "teleconsult", id, { refunded: refund.done, reference: refund.reference });
  return { appointment: toAppointmentDTO(row as AppointmentRow), refund };
}

// ── Patient-facing status (portal) ───────────────────────────────────────────

/** The link is worth highlighting from this long before the start until this long after. */
const JOIN_EARLY_MIN = 10;
const JOIN_LATE_MIN = 60;

/** The instant a tele-consult starts, or null if its date/time can't be read. */
export function appointmentStart(a: { appointment_date: string; appointment_time: string }): Date | null {
  const minutes = parseClock(a.appointment_time);
  return minutes == null ? null : zonedInstant(a.appointment_date, minutes);
}

export function consultationView(a: AppointmentRow, booking: TeleconsultBookingRow | null) {
  const minutes = parseClock(a.appointment_time);
  const start = minutes == null ? null : zonedInstant(a.appointment_date, minutes);
  const end = start ? new Date(start.getTime() + (a.slot_minutes ?? DEFAULT_SLOT_MINUTES) * 60_000) : null;
  const now = Date.now();
  const cancelled = a.status === "Cancelled";
  const done = a.status === "Completed";
  const phase = cancelled
    ? "cancelled"
    : done
      ? "completed"
      : !start
        ? "scheduled"
        : now < start.getTime() - JOIN_EARLY_MIN * 60_000
          ? "scheduled"
          : now <= start.getTime() + JOIN_LATE_MIN * 60_000
            ? "joinable"
            : "past";
  return {
    appointmentId: a.id,
    bookingId: a.booking_id ?? null,
    /** The HMS appointment status: Upcoming, Today, Completed or Cancelled. */
    status: a.status,
    /** scheduled → joinable (10 min before until 60 min after the start) → past; or completed / cancelled. */
    phase,
    doctorId: a.doctor_id,
    doctorName: a.doctor,
    date: a.appointment_date,
    time: a.appointment_time,
    startsAt: start?.toISOString() ?? null,
    endsAt: end?.toISOString() ?? null,
    reason: a.reason,
    /** The Google Meet (or manual) link, or null until it's created. */
    videoUrl: cancelled ? null : (a.video_url ?? null),
    videoProvider: a.video_provider ?? null,
    /** "ready" once there is a link; "pending" while the hospital still has to create or share it; "none" when cancelled. */
    linkStatus: cancelled ? "none" : a.video_url ? "ready" : "pending",
    amount: a.consult_amount ?? 0,
    currency: "INR",
    /** Paid, Waived, Free or Refunded. */
    paymentStatus: a.payment_status ?? null,
    refunded: !!booking?.refunded_at,
    /** Patients can move their own appointment unless it starts within an hour, is over, or has been moved three times. */
    rescheduleCount: a.reschedule_count ?? 0,
    canReschedule: patientRescheduleInfo(a).canReschedule,
    rescheduleBlockedReason: patientRescheduleInfo(a).reason,
    updatedAt: a.updated_at,
  };
}

/** Every video consultation of one patient, soonest first for what's ahead and newest first for history. */
export async function listPatientConsultations(patientId: number) {
  const { rows } = await appointmentsRepo.listRows({
    filters: [
      { column: "patient_id", op: "eq", value: patientId },
      { column: "type", op: "eq", value: TELECONSULT_TYPE },
    ],
    unpaged: true,
  });
  const bookings = new Map<number, TeleconsultBookingRow>();
  for (const a of rows) {
    if (a.booking_id) {
      const b = await teleconsultBookingsRepo.getRow(a.booking_id);
      if (b) bookings.set(a.id, b);
    }
  }
  const items = rows.map((a) => consultationView(a, bookings.get(a.id) ?? null));
  const key = (c: (typeof items)[number]) => c.startsAt ?? `${c.date}T00:00:00Z`;
  const open = items.filter((c) => c.phase === "scheduled" || c.phase === "joinable").sort((a, b) => key(a).localeCompare(key(b)));
  const rest = items.filter((c) => !(c.phase === "scheduled" || c.phase === "joinable")).sort((a, b) => key(b).localeCompare(key(a)));
  return { upcoming: open, history: rest };
}

export async function getPatientConsultation(appointmentId: number, patientId: number) {
  const a = await appointmentsRepo.getRow(appointmentId);
  if (!a || a.patient_id !== patientId || a.type !== TELECONSULT_TYPE) throw new NotFoundError("Consultation");
  const booking = a.booking_id ? await teleconsultBookingsRepo.getRow(a.booking_id) : null;
  return consultationView(a, booking);
}

/** Doctors a patient can book a video consultation with: at their hospital, video switched on, not on leave. */
export async function videoDoctorsForPatient(patientId: number) {
  const patient = await patientsRepo.getRow(patientId);
  if (!patient) throw new NotFoundError("Patient");
  const hospital = await hospitalsRepo.getRow(patient.hospital_id);
  if (!hospital) throw new NotFoundError("Hospital");
  if (!hospital.teleconsult_enabled || hospital.teleconsult_price == null) return [];
  const { rows } = await doctorsRepo.listRows({ filters: [{ column: "hospital_id", op: "eq", value: hospital.id }], unpaged: true });
  return rows
    .filter((d) => d.status !== "On Leave" && videoOn(d, hospital))
    .map((d) => ({ id: d.id, name: d.name, specialty: d.specialty, patientsPerHour: patientsPerHourOf(d), slotMinutes: slotMinutesOf(d) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
