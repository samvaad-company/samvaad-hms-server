# Tele-consult (paid video consultations) — HMS implementation

Ported from the Samvaad AI "tele-caller" flow (`samvaad-ai/telecaller-flow-context.md`), with its known gaps
fixed. The patient half lives in the separate patient portal — see
[patient-portal-teleconsult-prompt.md](./patient-portal-teleconsult-prompt.md).

## How it works

```
Patient portal ──(server→server, x-portal-key)──► HMS /api/portal/teleconsult/*
  1. config        → enabled? fee? payment mode?   (fee = hospital's price, set by Super Admin)
  2. create booking→ validates patient/doctor/slot, stores a pending_payment booking,
                     creates a gateway order for the SERVER-side price, holds the slot 15 min
  3. patient pays in Razorpay Checkout
  4. verify (portal) ─┐
     webhook (Razorpay)┴─► confirmBooking(): idempotent
                           • re-checks the slot (conflict → slot_conflict + auto-refund)
                           • creates the appointment  (type "Tele-consult", status Upcoming)
                           • creates a Google Meet link on the hospital's connected calendar
Doctor panel / Appointments / Video Consults page / patient portal all read appointments.video_url
```

Staff path: a **Tele Caller** (or admin) books from **Video Consults → Book Consultation** (times come from the
server's real availability); the fee is collected outside the system (cash / UPI / card, or waived by an admin) so it
confirms immediately.

**Booking link (patients, no app needed):** **Video Consults → Send booking link** creates a signed link (valid 7 days)
for one patient — `https://<web app>/book-video/<token>`. The tele-caller copies it or sends it on WhatsApp. The patient
opens it (no login), picks a doctor and an open time, pays the fee in Razorpay Checkout, and gets the Meet link on the
confirmation page. The token is the only credential: it fixes which patient and hospital the booking is for, and the
public endpoints (`/api/public/teleconsult/*`) expose nothing beyond the hospital name, the patient's first name, the
fee and the doctor list.

**Payments tab:** every fee (online, cash/UPI/card, waived, free, refunded) with its payment id, plus collected and
refunded totals.

**Cancel & refund:** **Cancel** on an upcoming consultation cancels it and refunds the fee — through Razorpay for an
online payment, or recorded as "return ₹X to the patient" for cash/UPI/card, which staff hand back.

## Who can do what

| | Super Admin | Tele Caller | Doctor | Receptionist |
|---|---|---|---|---|
| Set fee / switch on or off | ✅ (only role) | — | — | — |
| Connect / disconnect Google | ✅ (needs `admin` write) | — | — | — |
| Book on a patient's behalf | ✅ | ✅ | — | — |
| Waive the fee | ✅ | ❌ | — | — |
| Add / create the video link | ✅ | ✅ | own consults only | — |
| See the list | ✅ | ✅ | own consults | read-only |

`teleconsult` is a new RBAC resource. **Tele Caller** is a new role (patients/doctors/appointments read,
teleconsult write, nothing clinical or financial). Create one in Admin → Users.

## Fixes over the original design

1. **Price is server-side.** The order amount comes from `hospitals.teleconsult_price`; the client can't send one.
2. **No public patient endpoint.** The portal authenticates with a shared key; every portal route is scoped to
   the single patient the portal says it is acting for, and returns a minimal booking object.
3. **Booking intent is stored server-side** (`teleconsult_bookings`), so no emails/reason ride in Razorpay order notes
   and the doctor/patient emails are resolved on the server.
4. **The on/off switch is enforced** by the server on every booking, not just by the UI.
5. **Slot conflicts are checked** (existing appointments, 15-minute payment holds, hospital working hours, past times)
   and a paid-but-lost slot is refunded automatically.
6. **Silent failures are visible.** If the Meet link can't be created the appointment still exists, shows
   "Link pending" with the reason, and staff can retry **Create Meet** or **Add link**.
7. **No hard-coded test key or fallback price.** Without Razorpay keys the gateway is a mock in development and
   *unavailable* in production.
8. **Webhook** verifies the signature over the raw body, checks the amount matches the booking, and is idempotent
   (the same payment confirmed by both the webhook and the portal never creates two appointments).

## Setup

| Thing | Where |
|---|---|
| `PORTAL_API_KEY` | `server/.env` **and** the portal's env — same value (`openssl rand -hex 32`) |
| Razorpay (`server/.env`) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (a long random string — the server warns at start-up if it is short). Register `https://<public host>/api/razorpay/webhook` (Razorpay can't reach localhost — use your deployed host or a tunnel) for `payment.captured`, `payment.authorized`, `payment.failed`, `order.paid`, `refund.processed`, with that same secret. |
| Google | Cloud Console → enable **Google Calendar API** → OAuth client (Web) → add redirect `https://<host>/api/teleconsult/google/callback` → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Also enable the **Google Meet REST API** there. Then Admin → Settings → **Connect Google** as the account that should own the Meet links. While the OAuth app is in "Testing" mode add that account as a test user. |
| Fee + switch | Admin → Settings → **Video consultations** (Super Admin) |
| Postgres only | run `supabase/migrations/0028_teleconsult.sql` (Mongo needs nothing) |

The Google refresh token is stored AES-GCM encrypted with a key derived from `SESSION_SECRET` — rotating
`SESSION_SECRET` means reconnecting Google.



## Who can join the video call

A Meet room that Google creates as a side effect of a calendar event admits **invited guests only**. A patient who opens
the link signed out, or with a Google account other than the one we invited, is told *"You can't join this video call"* —
and is not even offered "Ask to join". So the server creates the room through the **Meet API** and the hospital chooses
the access type in **Admin → Settings → Video consultations → Who can join the video call** (Super Admin):

| Setting | Behaviour | Use when |
|---|---|---|
| **Anyone with the link** (default) | Joins directly, any account or none. Nobody has to let the patient in. | You want it to just work — the link is only ever shared with that patient. |
| **Ask to join** (TRUSTED) | Your Google organization's members and invited guests join directly; everyone else asks to join and someone from your organization lets them in. | Your hospital uses Google Workspace and the doctor is in that organization. |
| **Invitees only** (RESTRICTED) | Only invited guests join directly; others ask to join and the host account lets them in. | Rare. |

The patient and doctor are still invited by calendar email when their addresses are known, but the link no longer
depends on it. Setup the Meet API needs (once): enable **Google Meet REST API** for the Google Cloud project, then
**Reconnect Google** in Admin → Settings so the account grants the extra *"create Google Meet meetings"* permission.
Until then the old behaviour (invited guests only) is used and the appointment is flagged. Links already made that way
show a **Recreate link** button on **Video Consults**; it makes a fresh room with the chosen access (the old calendar
entry stays untouched).

## Reliability: why a payment can't get lost

A patient's money can reach us by four routes — Razorpay's webhook, the patient app's `verify` call, a lookup when the
app asks for the booking, and a sweep that runs every minute — and any one of them is enough. They can arrive in any
order, twice, or at the same instant; the booking is confirmed exactly once (in-process lock per booking, plus unique
indexes on `appointments.booking_id` and `teleconsult_payments.payment_id`). Specifics:

- An **authorized-only** payment (account without auto-capture) is captured by us, then confirmed.
- A **late** payment for a booking that already expired still confirms it; if its slot has been taken meanwhile, the
  payment is refunded automatically, and if that refund fails the sweep retries it.
- A payment of the **wrong amount** is never confirmed; it is recorded in the ledger with a note for staff.
- If Razorpay is **unreachable** when the patient confirms, the checkout signature is enough (the amount is fixed by the
  order we created); the webhook/sweep back-fill the details.
- A `refund.processed` event from the Razorpay dashboard is mirrored onto the booking, ledger and appointment.
- **Meet links** are created with a fixed event id, so a retry after a lost response finds the existing event instead of
  duplicating it; the sweep keeps retrying until a link exists. A Google connection that lacks Calendar access (Google lets
  people untick it), was revoked, or expired (7 days while the OAuth app is in "Testing") is flagged **"needs reconnect"**
  in Admin → Settings instead of failing silently.

### Tests

`cd server && npm run test:payments` runs the whole payment flow in-process against a fake Razorpay and Google (no
network, no real data): webhook-only, verify-only, neither, both at once ×15, duplicates, forged and tampered webhooks,
wrong amounts, failed-then-retried payments, authorized-only, gateway down, late/expired payments, slot conflicts,
refund failures and retries, dashboard refunds, staff bookings and cancellation, free consultations, price tampering,
portal-key and link-token security, and the Meet/Google failure modes. `npm run test:payments -- 6` repeats it six
times in one process. Run it against a real MongoDB with a throw-away database (see the header of
`scripts/test-teleconsult-payments.ts`) to also exercise the unique indexes.

## Files

- Server (`server/src/`): `services/teleconsult-service.ts`, `services/google-meet.ts`, `services/payment-gateway.ts`,
  `auth/portal.ts`; routes under `routes/portal/teleconsult/**`, `routes/teleconsult/**`, `routes/razorpay/webhook`.
- UI: `/teleconsult` page (consultations, payments, booking link), the public `/book-video/[token]` page, `components/teleconsult/*`, Doctor and Tele Caller home panels, Admin → Settings section,
  Appointments list/detail ("Tele-consult" chip, Join).
- `server/src/app.ts` lets `/api/portal/*` and the Razorpay webhook through the session gate — they authenticate
  themselves. The frontend forwards all `/api/*` to the server, so the portal can call either the web app's URL or the
  server's directly (`HMS_API_BASE_URL`).

## Not built (decide before relying on it)

- **Patient-side cancel / reschedule.** Only staff can cancel (with refund); patients are told to contact the hospital.
- **Rate limiting** on the public booking endpoints beyond "at most 3 unpaid bookings per patient at a time".
- **Payouts.** The original ran a monthly payout cron per hospital; that is a platform-billing question for the
  root-admin app, not implemented here.
- Per-doctor fees (the fee is per hospital).
- A pre-visit reminder to the patient (the portal can schedule one from `appointments`).
