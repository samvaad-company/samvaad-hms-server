# Prompt: add paid video consultations (tele-consult) to the Samvaad patient portal

> Paste everything below the line into the AI/engineer working on the **patient portal**
> (`patient-portel/samvaad-ai-portel`, the Next.js PWA; the React Native app in
> `patient-portel-rn` should reuse the same server routes).
> The HMS side is already built — this prompt is only the patient-facing half.

---

## Read first

- `AGENTS.md` in the portal repo: this is not the Next.js you know. Read the relevant guides in
  `node_modules/next/dist/docs/` before writing route handlers or pages.
- Skim `README.md` and `src/services/appointment.service.ts`, `src/repositories/appointment.repository.ts`,
  `src/lib/appointment-slots.ts`, `src/app/api/appointments/route.ts` and `src/app/(patient)/appointments/**`
  so the new code matches their style.

## What you're building

A patient can choose **"Video consultation"** when booking with a doctor. They see the **fee**, pay it
online, and get an appointment that carries a **Google Meet link** which appears in their appointment list
and detail screen with a **Join** button. The same appointment, with the same link, shows up in the
doctor's panel in the HMS.

### The rules that must hold

1. **The fee is decided by the hospital's admin in the HMS — never by this app.** Do not hard-code a
   price, do not let the client send an amount, and do not compute one. Ask the HMS for it and show it.
   The HMS also ignores any amount you send, so there is nothing to gain by trying.
2. **This app never creates the tele-consult appointment, never talks to Razorpay's server API, and never
   talks to Google.** The HMS owns payment, the appointment and the Meet link. This app is a UI plus a thin
   server-side proxy. (The portal already reads/writes the HMS MongoDB directly for normal bookings — keep
   doing that for normal bookings, but **tele-consult goes through the HMS API only**.)
3. **The HMS shared key never reaches the browser or the mobile app.** All HMS calls happen in this app's
   server routes.
4. **The patient id comes from the portal session, never from the request body or query string.**

## Environment (portal `.env.local` and `.env.local.example`)

```
HMS_API_BASE_URL=http://localhost:3005      # the HMS origin, no trailing slash
PORTAL_API_KEY=                              # must equal PORTAL_API_KEY in the HMS .env
```

Add both to `.env.local.example` with a comment. If either is missing, the tele-consult option must hide
itself (treat it as "not available") rather than crash.

## HMS API you call (server-side only)

Every request sends `x-portal-key: ${PORTAL_API_KEY}` and `Content-Type: application/json`. Responses are
`{ "data": ... }` on success and `{ "error": { "code", "message" } }` on failure (`message` is safe to show
the patient). `patientId` is the **numeric HMS patient id** you already have in `session.patientId`.

### 1. `GET {HMS}/api/portal/teleconsult/config?patientId=<id>`

```json
{ "data": { "hospitalId": 1, "enabled": true, "price": 500, "currency": "INR", "paymentMode": "razorpay" } }
```

- `enabled` is false when the hospital has switched video consults off or hasn't set a fee. Hide the option.
- `price` is in **rupees** (main units). `0` means a free consultation — no payment step.
- `paymentMode`: `"razorpay"` (real), `"mock"` (development only — see below) or `"off"` (the hospital can't
  take online payment right now: show "Video consultation is temporarily unavailable").

### 2. `POST {HMS}/api/portal/teleconsult/bookings`

Body: `{ patientId, doctorId, date: "YYYY-MM-DD", time: "HH:mm", reason, email? }`
(`time` is the same 24-hour `HH:mm` your slot picker already produces; `email` is optional and only used for
the Meet invite — default to the patient's email if you have one.)

Success (`201`):

```json
{ "data": {
  "booking": { "id": 7, "status": "pending_payment", "amount": 500, "currency": "INR",
               "doctorName": "Dr. Sophia Adams", "date": "2026-10-07", "time": "10:00 AM",
               "appointmentId": null, "videoUrl": null, "failureReason": null },
  "payment": { "mode": "razorpay", "keyId": "rzp_live_xxx", "orderId": "order_abc",
               "amountPaise": 50000, "currency": "INR", "hospitalName": "…",
               "prefill": { "name": "…", "contact": "…", "email": "…" } }
} }
```

For a free consultation (`price` = 0) the booking comes back already `confirmed` and `payment` is `null` —
skip straight to the confirmation screen.

The slot is **held for 15 minutes** while the patient pays. Calling this again for the same doctor/date/time while that hold is live returns the **same booking and the same `orderId`** (so "Try again" never collides with the patient's own hold — just call it again and reopen Checkout). A patient can have at most 3 unpaid bookings at once. Errors you must handle with the message shown
as-is: `409` ("That time was just booked…", "Someone else is paying for that time…") → send the patient back
to the time picker and refresh the slots; `400` ("That time is outside the hospital's booking hours",
"Please pick a time in the future", "Video consultations aren't available…") → show the message.

### 3. `POST {HMS}/api/portal/teleconsult/bookings/{id}/verify`

Call this from the payment success handler.

Body: `{ patientId, razorpay_order_id, razorpay_payment_id, razorpay_signature, email? }`
(the three values Razorpay Checkout hands to its `handler`, passed through untouched; `email` is the patient's address for
the Google Meet invite — see `docs/patient-portal-email-prompt.md`).

Returns the booking in the same shape as above. On success `status` is `"confirmed"`, `appointmentId` is set
and `videoUrl` is the Meet link — **or `null`** if the hospital hasn't connected Google / Meet creation failed
(see "Link not ready yet"). If `status` is `"slot_conflict"` the slot was taken at the last moment: the HMS has
already refunded the payment; show `failureReason` and send the patient back to choose another time.

### 4. `GET {HMS}/api/portal/teleconsult/bookings/{id}?patientId=<id>`

Same booking shape. Use it to poll when `verify` fails with a network error or timeout — the HMS also
confirms via Razorpay's webhook, so the booking may already be `confirmed`. Poll every 2 s for up to 30 s
before telling the patient "We received your payment and are confirming it — check My Appointments shortly."

### 4b. `GET {HMS}/api/portal/teleconsult/payments/lookup?patientId=<id>&orderId=<id>` — find the transaction, show the appointment

Use this right after Checkout closes (it also accepts `paymentId=` or `bookingId=`). It returns
`{ found, booking, payment, consultation }`. `found: false` → not found for this patient yet. While the booking is
unpaid in the HMS's records the server asks Razorpay directly, so the payment is found even if the webhook never
arrived and your verify call failed. **Recommended order after the patient pays:** (1) call `verify` (fast path);
(2) if it errors or times out, call `lookup` every 2 s for up to 30 s; (3) as soon as `booking.status === "confirmed"`,
render `consultation` (doctor, date/time, fee, `videoUrl`, `linkStatus`). `payment` carries the payment id, method and
status to show a receipt ("Paid ₹499 via UPI · pay_…").

### 5. `GET {HMS}/api/portal/teleconsult/consultations?patientId=<id>` — what to show on the appointments screen

Returns `{ "upcoming": [...], "history": [...] }` — this patient's video consultations with their live status and
video link. Prefer this over reading `appointments` yourself for tele-consults: it already works out the phase and
whether the link exists. `GET .../consultations/{appointmentId}?patientId=<id>` returns one.

Each item has `status` (`Upcoming`/`Today`/`Completed`/`Cancelled`), `phase` (`scheduled` · `joinable` ·
`past` · `completed` · `cancelled`), `startsAt`/`endsAt` (UTC ISO), `videoUrl`, `linkStatus` (`ready` · `pending` ·
`none`), `doctorName`, `date`, `time`, `amount`, `paymentStatus` (`Paid`/`Waived`/`Free`/`Refunded`), `refunded`
and `updatedAt`. Use `phase === "joinable"` to make **Join** the primary button, `linkStatus === "pending"` for
"your link will appear here" (re-fetch on focus or every 30–60 s), and `phase === "cancelled"` for the cancelled
state (with "Fee refunded" when `refunded`). The full field reference is in `docs/teleconsult-api.md`.

## Server routes to add in the portal

Use the existing `requireApiSession()` + `safeRoute` helpers. Each route reads `session.patientId`, calls the
HMS with `fetch` (`cache: "no-store"`, a 15 s timeout), and relays the HMS `{ error }` message with the HMS
status code (map network failure to a 502 with "Video consultation is temporarily unavailable").

| Portal route | Calls HMS | Notes |
|---|---|---|
| `GET /api/teleconsult/config` | config | cache for ≤ 60 s per patient at most |
| `POST /api/teleconsult/bookings` | create booking | validate with zod: `doctorId`, `date`, `time`, `reason`; **reject any `amount`/`price`/`patientId` in the body** (ignore them) |
| `POST /api/teleconsult/bookings/[id]/verify` | verify | body: the three Razorpay fields only |
| `GET /api/teleconsult/bookings/[id]` | booking status | |
| `GET /api/teleconsult/consultations` | consultations list (status + link) | for the appointments screen |

Put the HMS calls in one small module (e.g. `src/lib/hms-api.ts`, `import "server-only"`).

## Screens

### A. Choosing the consultation type

In the existing book-appointment flow, after the patient picks a doctor, offer **In-person** (current
behaviour, unchanged) or **Video consultation**. Show Video only when `config.enabled` and
`config.paymentMode !== "off"`. On the Video option show the fee, e.g. **"Video consultation · ₹500"** (or
**"Free"** for 0). Reuse the existing date and slot pickers (`getAvailableSlots`) unchanged — the HMS
re-validates the slot against the hospital's working hours and existing bookings anyway.

### B. Review & pay

Summary card: doctor, date, time, reason, **fee**, and the line "You'll get a Google Meet link here after
payment." Button **"Pay ₹500"** (disabled while a request is in flight).

Flow on tap:
1. `POST /api/teleconsult/bookings` → get `booking` + `payment`.
2. If `payment` is null → go to the confirmation screen.
3. If `payment.mode === "razorpay"` → load `https://checkout.razorpay.com/v1/checkout.js` once and open
   Checkout with `{ key: payment.keyId, order_id: payment.orderId, amount: payment.amountPaise,
   currency: payment.currency, name: payment.hospitalName, description: "Video consultation",
   prefill: payment.prefill, handler }`. Do **not** pass your own amount — use what the HMS returned. In
   `handler`, call the verify route. If the patient closes Checkout (`modal.ondismiss`), keep them on the
   review screen with "Payment not completed — your slot is held for 15 minutes" and a "Try again" button that
   reopens Checkout with the **same** order (don't create a second booking).
4. If `payment.mode === "mock"` (development only — `NODE_ENV !== "production"` on the HMS) → don't load
   Razorpay. Show a clearly labelled **"Test mode: simulate payment"** button that calls verify with
   `razorpay_order_id = payment.orderId`, `razorpay_payment_id = "pay_mock_<anything>"`,
   `razorpay_signature = "mock"`. Never show this button when `mode` is `"razorpay"`.
5. While verifying show a blocking "Confirming your booking…" state. Never show success until `status` is
   `"confirmed"`.

### C. Confirmation

"Booked ✓" with doctor, date/time, fee paid, and:
- **videoUrl present:** a **Join video consultation** button (opens in a new tab / `Linking.openURL`) and
  **Add to calendar** (the portal already has `src/lib/ics.ts` — include the link in the event location /
  description).
- **videoUrl null — "Link not ready yet":** show "Your video link will appear here shortly. We'll notify you
  when it's ready." Do not treat this as an error. The hospital can add the link later from the HMS.
Also create a portal notification + push via the existing `NotificationService` / push helpers
("Video consultation booked — Dr. X on 7 Oct at 10:00 AM").

### D. Appointments list & detail

`appointments` documents written by the HMS now have, for tele-consults:
`type: "Tele-consult"`, `video_url` (string or null), `video_provider` (`"google_meet"` | `"manual"`),
`consult_amount` (rupees), `payment_status` (`"Paid"` | `"Waived"` | `"Free"`). Extend
`AppointmentDocument` / the mapped `Appointment` type with `videoUrl`, `isVideo`, `consultAmount`,
`paymentStatus`. Keep every existing `type` string working (`Booked`, `Walk-in`, …) — don't assume the set is
closed.

- **List card:** a "Video" chip with a camera icon on tele-consults.
- **Detail:** a "Video consultation" section showing the fee and payment status and, when `videoUrl` exists,
  a prominent **Join** button. Emphasise Join (primary colour) from **10 minutes before** the start until
  **60 minutes after**; outside that window show it as a secondary button — still tappable, since the link is
  valid. When there's no link yet, show "Link will appear here once the hospital shares it." and refresh when
  the screen regains focus.
- **Cancel / reschedule:** for `type === "Tele-consult"`, **hide the patient's Cancel and Reschedule actions**
  (they write straight to the HMS database and would orphan a payment and a calendar event). Show
  "To change or cancel a video consultation, please contact the hospital." with the hospital phone if known.
  Make this check in the **service layer** (`AppointmentService`) as well as the UI.
- **Reminders:** if the portal schedules appointment reminders, a tele-consult reminder should deep-link to
  the detail screen and mention the video link.

## Edge cases to cover

- Config says `enabled: false` or HMS unreachable → in-person booking keeps working; the Video option is
  simply absent.
- Double-tapping Pay → one booking only (disable the button; reuse the returned `booking.id` on retry).
- Page refresh mid-payment → on load of the booking flow, if you have a stored in-flight `bookingId`
  (sessionStorage), `GET` it: `confirmed` → show confirmation; `pending_payment` → offer to resume.
- `verify` returns `400 "Payment couldn't be verified"` → show "We couldn't verify the payment. If money was
  deducted it will be refunded automatically, or contact the hospital." and do not retry in a loop.
- Hospital price changes between config and booking → the booking response `amount` is the truth; show it on
  the Pay button and in the confirmation.
- Free consultation (`price: 0`) → no Razorpay, straight to confirmation.
- Patient has no email → still book; the invite just goes to the doctor's side and the link shows in-app.

## Security checklist (reviewer will check these)

- [ ] `PORTAL_API_KEY` is only read in server code (`import "server-only"`), never `NEXT_PUBLIC_*`.
- [ ] No route accepts `patientId`, `amount`, `price` or `hospitalId` from the client for tele-consult.
- [ ] The Razorpay **key id** comes from the HMS response; the Razorpay **secret** never exists in this app.
- [ ] Mock-payment UI is impossible to reach when `payment.mode === "razorpay"`.
- [ ] Errors shown to the patient come from the HMS `error.message`; stack traces and the HMS URL never do.
- [ ] Cancel/reschedule of tele-consults is blocked in the service layer, not just hidden.

## How to test locally (no Razorpay or Google account needed)

1. Run the HMS (`npm run dev`, port 3005) with `PORTAL_API_KEY` set (any long random string) and **no**
   `RAZORPAY_*` keys → it uses the mock gateway. Run the portal with the same key and
   `HMS_API_BASE_URL=http://localhost:3005`.
2. In the HMS, log in as **Super Admin** → Admin → Settings → **Video consultations**: set a fee (e.g. 500)
   and switch it on. (Without this the portal shows no Video option — that's the intended behaviour.)
3. In the portal, sign in as a patient, book a Video consultation, tap **Simulate payment**.
4. Expect: confirmation screen; the appointment appears in the list with a Video chip. With Google not
   connected the link shows as "not ready yet" — in the HMS open **Video Consults**, tap **Add link** on that
   appointment and paste any `https://meet.google.com/...` URL; refresh the portal: **Join** now appears.
5. Log in to the HMS as the doctor: the booking is under **Video Consultations** on their home panel with the
   same Join link.
6. Try to book the same doctor/time again → the second attempt gets the 409 "just booked" message.
7. With a real Razorpay test key on the HMS (`RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`, plus the webhook
   registered) the same flow uses real Checkout; the card `4111 1111 1111 1111` works in test mode.

## Done when

- A patient can book, pay for and see a video consultation end to end against the local HMS.
- The fee shown always equals the fee set in the HMS Admin → Settings; changing it there changes it here.
- The Join link set (or created) in the HMS appears in the portal without a code change.
- `npm run lint` and `npx tsc --noEmit` pass in the portal; existing in-person booking, cancel and reschedule
  behave exactly as before.
