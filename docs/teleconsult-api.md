# Tele-consult API reference

All endpoints are served by the API server in `/server` (default `http://localhost:4000`). The web app also forwards
`/api/*` to it, so `http://localhost:3005/api/...` works identically. Responses are `{ "data": … }` on success and
`{ "error": { "code", "message" } }` on failure (`message` is safe to show a user).

Three audiences, three kinds of credential:

| Audience | Prefix | Credential |
|---|---|---|
| Patient portal (its server) | `/api/portal/teleconsult/*` | header `x-portal-key: $PORTAL_API_KEY` + `patientId` |
| Patient booking page | `/api/public/teleconsult/*` | signed link `token` (query or body) |
| HMS staff (admin, doctor, tele-caller) | `/api/teleconsult/*`, `/api/appointments` | staff session cookie |

There is one source of truth: a tele-consult is an `appointments` row with `type: "Tele-consult"`. The portal, the
HMS Video Consults page, the doctor's panel and the Appointments screen all read that same row, so a status or video
link changes everywhere at once.

---

## Patient portal — showing consultations, status and the video link

### `GET /api/portal/teleconsult/consultations?patientId=<id>`

Header: `x-portal-key`. Returns this patient's consultations, split for display.

```json
{ "data": {
  "upcoming": [ { …consultation… } ],   // phase "scheduled" or "joinable", soonest first
  "history":  [ { …consultation… } ]    // completed, cancelled or past, newest first
} }
```

### `GET /api/portal/teleconsult/consultations/<appointmentId>?patientId=<id>`

One consultation (404 if it isn't this patient's tele-consult).

### The consultation object

```json
{
  "appointmentId": 51,
  "bookingId": 7,
  "status": "Upcoming",
  "phase": "joinable",
  "doctorId": 2,
  "doctorName": "Dr. Sophia Adams",
  "date": "2026-10-07",
  "time": "10:40 AM",
  "startsAt": "2026-10-07T05:10:00.000Z",
  "endsAt": "2026-10-07T05:40:00.000Z",
  "reason": "Follow-up on blood pressure",
  "videoUrl": "https://meet.google.com/abc-defg-hij",
  "videoProvider": "google_meet",
  "linkStatus": "ready",
  "amount": 500,
  "currency": "INR",
  "paymentStatus": "Paid",
  "refunded": false,
  "updatedAt": "2026-10-07T05:05:30.808Z"
}
```

| Field | Meaning |
|---|---|
| `status` | HMS appointment status: `Upcoming`, `Today`, `Completed`, `Cancelled` |
| `phase` | What to show: `scheduled` (not yet), `joinable` (from 10 min before to 60 min after the start), `past` (missed / over), `completed`, `cancelled` |
| `linkStatus` | `ready` (a link exists), `pending` (hospital hasn't created/shared it yet — show "link will appear here"), `none` (cancelled) |
| `videoUrl` | The Google Meet (or manually pasted) link; `null` until `linkStatus` is `ready`, and always `null` once cancelled |
| `videoProvider` | `google_meet`, `manual`, or `null` |
| `startsAt` / `endsAt` | Real instants (UTC ISO) — compute countdowns from these, not from `date` + `time` |
| `paymentStatus` | `Paid`, `Waived`, `Free`, `Refunded` |
| `refunded` | `true` once the fee was returned (cancelled with refund) |
| `updatedAt` | Changes whenever staff add the link, cancel, etc. — handy for "refresh if newer" |

**Suggested rendering**

- `phase = joinable` → primary **Join video call** button (`videoUrl`).
- `phase = scheduled` and `linkStatus = ready` → "Starts at 10:40 AM", Join as a secondary button.
- `linkStatus = pending` → "Your video link will appear here shortly"; re-fetch on screen focus or every 30–60 s.
- `phase = cancelled` → "Cancelled" (+ "Fee refunded" when `refunded`).
- `phase = past` and not completed → "This consultation has passed".

### Booking and paying (portal)

| Call | Purpose |
|---|---|
| `GET /api/portal/teleconsult/config?patientId=` | `{ hospitalId, enabled, price, currency, paymentMode }` — the fee is set by the hospital admin |
| `POST /api/portal/teleconsult/bookings` | body `{ patientId, doctorId, date: "YYYY-MM-DD", time: "HH:mm", reason, email? }` (`email` → prefilled in the payment window and invited to the Meet call) → `{ booking, payment }`; `payment` is `null` for a free consultation |
| `POST /api/portal/teleconsult/bookings/<id>/verify` | body `{ patientId, razorpay_order_id, razorpay_payment_id, razorpay_signature, email? }` → confirmed booking (with `appointmentId`, `videoUrl`). `email` is optional: the patient's address for the Google Meet invite (ignored if malformed, never blocks the payment) |
| `GET /api/portal/teleconsult/bookings/<id>?patientId=` | booking status — poll after paying until `status` is `confirmed` |
| `GET /api/portal/teleconsult/payments/lookup?patientId=&orderId=\|paymentId=\|bookingId=` | **find the transaction, get the appointment** (below) |

Booking `status`: `pending_payment` → `confirmed`; or `slot_conflict` (slot lost, payment refunded or being refunded),
`expired` (unpaid and past the hold — a late payment still confirms it), `cancelled`, `failed`.
See `docs/patient-portal-teleconsult-prompt.md` for the full flow.

### After checkout: find the transaction, show the appointment

```
GET /api/portal/teleconsult/payments/lookup?patientId=1&orderId=order_Tk…     (or paymentId=pay_… or bookingId=12)
```

```json
{ "data": {
  "found": true,
  "booking":  { "id": 12, "status": "confirmed", "appointmentId": 55, "videoUrl": "https://meet.google.com/…", … },
  "payment":  { "orderId": "order_Tk…", "paymentId": "pay_Tk…", "status": "captured", "amount": 499,
                "currency": "INR", "method": "upi", "paidAt": "2026-10-07T…", "refunded": false,
                "signatureVerified": true },
  "consultation": { …the consultation object above… }
} }
```

`found: false` means no such transaction for this patient (yet). If the booking is still unpaid in our records the
server asks Razorpay directly (at most once every few seconds per booking), so **a payment is found even when the
webhook never arrived and your verify call failed** — poll this endpoint after Checkout closes (every 2 s, up to
~30 s) and render `consultation` as soon as `booking.status === "confirmed"`. `status` in `payment` is the ledger
status: `captured`, `authorized`, `failed` or `refunded`.

---

## Patient booking page (public link)

`GET /api/public/teleconsult/session?token=` · `GET …/slots?token=&doctorId=&date=` · `POST …/bookings` ·
`POST …/bookings/<id>/verify` · `GET …/bookings/<id>?token=`

Used by `/book-video/<token>`; the token fixes the patient and hospital. Created by staff with
`POST /api/teleconsult/links { patientId }` → `{ token, path, expiresAt }` (valid 7 days).

---

## HMS staff

All need a staff session; `teleconsult` is read for Receptionist, write for Super Admin, Tele Caller and Doctor
(a doctor only touches their own consultations).

| Call | Who / what |
|---|---|
| `GET /api/appointments?type=Tele-consult&all=true` | every tele-consult (doctors get only their own). Fields: `videoUrl`, `meetError`, `consultAmount`, `paymentStatus`, `status` |
| `GET /api/teleconsult/config` | `{ enabled, price, currency, gatewayMode, google: { configured, connected, accountEmail } }` |
| `GET /api/teleconsult/slots?doctorId=&date=` | open times `{ isOpen, closedReason, slots: [{ value: "HH:mm", label }] }` |
| `POST /api/teleconsult/bookings` | book for a patient: `{ patientId, doctorId, date, time, reason, paymentMode: cash\|upi\|card\|waived, reference? }` |
| `POST /api/teleconsult/links` | make a patient booking link |
| `GET /api/teleconsult/payments` | every fee with status, payment id, refund reference and totals |
| `POST /api/teleconsult/<appointmentId>/meet` | create the Google Meet link; body `{ "replace": true }` makes a fresh room (e.g. to replace one patients can't open) |
| `PUT /api/teleconsult/<appointmentId>/link` | paste a link by hand: `{ videoUrl: "https://…" }` |
| `POST /api/teleconsult/<appointmentId>/cancel` | cancel (and refund unless `{ "refund": false }`) |
| `GET /api/teleconsult/google/connect` | start Google sign-in (admin; open in the browser) |
| `POST /api/teleconsult/google/disconnect` | disconnect Google (admin) |
| `PATCH /api/admin/settings` | `{ teleconsultPrice, teleconsultEnabled, teleconsultMeetAccess: OPEN\|TRUSTED\|RESTRICTED }` — Super Admin only |

## Doctor schedules and rescheduling

Video times follow each doctor's own settings (patients per hour, video hours, video on/off) and appointments can be
rescheduled by patients, doctors and staff — see [doctor-scheduling.md](./doctor-scheduling.md) for the rules and the
`/api/portal/appointments/*`, `/api/appointments/slots`, `/api/appointments/<id>/reschedule` and `/api/doctors/<id>/schedule`
calls. `GET /api/portal/teleconsult/doctors?patientId=` lists the doctors a patient can book a video consultation with, and the
consultation object gains `rescheduleCount`, `canReschedule` and `rescheduleBlockedReason`.

## Webhook and the payment safety net

`POST /api/razorpay/webhook` — Razorpay → server. The signature (`X-Razorpay-Signature`) is checked over the raw
body with `RAZORPAY_WEBHOOK_SECRET`. Register it at Razorpay Dashboard → Settings → Webhooks with these events:
`payment.captured`, `payment.authorized`, `payment.failed`, `order.paid`, `refund.processed`.

| Response | Meaning |
|---|---|
| `401` | missing/wrong signature — Razorpay will not retry a forged one |
| `200 {"outcome": …}` | handled, or safely ignored (`unknown-order`, `duplicate-event`, `already-confirmed`, `ignored-event`, …) — Razorpay stops resending |
| `500` | our database or the gateway failed — Razorpay retries (up to 24 h); every step is idempotent |

What each event does: `payment.captured` / `order.paid` confirm the booking; `payment.authorized` captures the payment
first (accounts that don't auto-capture) and then confirms; `payment.failed` records the reason on the booking and
ledger but leaves the booking open for a retry on the same order; `refund.processed` mirrors a refund made in the
Razorpay dashboard. Payments for orders that aren't ours (other products on the same Razorpay account) are
acknowledged and ignored.

**Nothing relies on the webhook alone.** A payment is confirmed by whichever of these sees it first, and all of them are
idempotent (one appointment per booking, enforced in code and by a unique database index):

1. the patient app's `verify` call (signature + a gateway lookup),
2. the webhook,
3. a lookup when the patient app asks for the booking/transaction,
4. a background sweep every minute: unpaid bookings older than a minute are checked against Razorpay, unpaid ones past
   30 min are marked `expired` (a payment arriving later still confirms them), a refund that failed after a lost slot
   is retried, and confirmed consultations still without a Meet link are retried.

## The payment ledger

Every payment (online, cash/UPI/card, waived, free) has a row in `teleconsult_payments` carrying the gateway
`payment_id` (unique), `order_id`, amount, method, status, who recorded it (`verify`, `webhook`, `sweep`, `staff`), and
the `booking_id`, `appointment_id`, `patient_id` and `doctor_id` it belongs to. The appointment carries `payment_id` and
`order_id` too, so a payment id finds its appointment and an appointment shows its payment. Staff see all of it in
**Video Consults → Payments** (search by payment id, order id or appointment number), and `GET
/api/teleconsult/payments` returns it. `POST /api/teleconsult/payments/<bookingId>/sync` re-checks one booking with
Razorpay on demand.
