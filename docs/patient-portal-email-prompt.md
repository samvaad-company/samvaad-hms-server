# Prompt: pass the patient's email with the video-consultation payment (patient portal)

> Paste everything below the line into the AI/engineer working on the **patient portal**
> (`patient-portel/samvaad-ai-portel`, plus `patient-portel-rn` if it books video consultations).
> The HMS side is done; this is only the portal change. It assumes video consultations are already wired up
> (see `docs/patient-portal-teleconsult-prompt.md`): the server routes `POST /api/teleconsult/bookings` and
> `POST /api/teleconsult/bookings/[id]/verify`, and the booking/payment screens.

---

## Goal

When a patient books and pays for a video consultation, the HMS creates a Google Meet call and **invites the patient
by email** (calendar invite + the link in their inbox). It can only do that if it knows the patient's email, so the
portal must send it. Today it isn't sent, so the invite goes to nobody and the patient has to rely on the link shown
in the app.

## What the HMS accepts

The same field, `email`, in two places. Both are optional; send it in as many places as you can — the HMS uses the
first one that is valid, in this order of preference:

| # | Where | When | Notes |
|---|---|---|---|
| 1 | `email` in the body of `POST {HMS}/api/portal/teleconsult/bookings` | when the patient taps Pay | Best: it also **prefills the Razorpay window** (`payment.prefill.email`), so the patient doesn't type it again. Malformed → `422`. |
| 2 | `email` in the body of `POST {HMS}/api/portal/teleconsult/bookings/{id}/verify` | right after Checkout succeeds | For apps that collect the email in the payment step. Only used once the payment is genuine; a malformed value is **ignored** (it never blocks a payment that went through). |
| 3 | the email the patient typed into Razorpay Checkout | automatic | Used only if neither of the above had one. |
| 4 | the email on the patient's HMS record | automatic | Last resort. |

Addresses are trimmed and lower-cased by the HMS. If the patient and the doctor share an address it is only invited
once. If you ask again for the same open slot (patient taps Pay twice, or corrects a typo), the new email replaces
the old one on the open booking.

### Request shapes

```jsonc
// POST {HMS}/api/portal/teleconsult/bookings        (header: x-portal-key)
{
  "patientId": 12,
  "doctorId": 3,
  "date": "2026-10-09",
  "time": "10:30",
  "reason": "Follow-up on blood pressure",
  "email": "maya.patient@example.com"      // ← add this
}

// POST {HMS}/api/portal/teleconsult/bookings/55/verify   (header: x-portal-key)
{
  "patientId": 12,
  "razorpay_order_id": "order_…",
  "razorpay_payment_id": "pay_…",
  "razorpay_signature": "…",
  "email": "maya.patient@example.com"      // ← optional, same value
}
```

## What to change in the portal

1. **Know the email.** Take it from the patient's portal profile / session if you have it (the portal reads the HMS
   `patients` record, which has an `email` field). If it is missing, add an **Email** field to the review-and-pay
   screen (type `email`, `autocomplete="email"`, helper text *"We'll send the video-call invite here"*), prefilled
   from the profile. Validate with a simple pattern (`something@something.tld`) before enabling Pay. Optionally
   offer "Save this email to my profile" using whatever profile-update endpoint the portal already has.
2. **Send it when booking.** In the portal's `POST /api/teleconsult/bookings` route, accept `email` in the body
   (zod: `z.string().trim().email().max(160).optional()`) and forward it to the HMS call above. Leave the
   `patientId` coming from the session as it is.
3. **Send it again on verify.** In the `verify` route accept the same optional `email` and forward it. Pass the same
   value you used when booking; if the patient edited it in a later step, pass the edited one. **Do not block** the
   verify call on email validity — if your field is invalid at that point, simply omit it.
4. **Razorpay Checkout prefill.** Keep passing the HMS-returned `payment.prefill` to Checkout unchanged; it now
   contains the email (`prefill.email`) whenever one was sent at step 2.
5. **Mobile app** (`patient-portel-rn`): same two fields through the same portal routes; nothing is called on the HMS
   directly.
6. **Confirmation screen:** after confirming, show "Invite sent to maya.patient@example.com" when you sent one, so
   the patient knows to check their inbox. If the HMS returns the booking with `videoUrl: null`, keep the existing
   "your link will appear here" state — the invite is sent once the link exists.

## Don'ts

- Don't put the email in a URL/query string or in logs.
- Don't send an email for anyone but the signed-in patient.
- Don't treat a missing email as an error — the call still works from the link shown in the app.

## Test it

1. HMS and portal running; fee set and video consultations on (Admin → Settings). Google connected.
2. Book as a patient who has **no email on their profile**: the review screen asks for one; enter a real inbox you
   can read; pay with a Razorpay test card (`4111 1111 1111 1111`, any future expiry and CVV).
3. Expect: a Google Calendar invite titled "Video consultation — <patient> with <doctor>" in that inbox, the same
   Meet link inside the app, and — in the HMS → Video Consults → Payments tab — the booking linked to the
   payment id.
4. Repeat: leave the email blank everywhere → the booking still confirms and the link still shows in the app.
5. Repeat: send a malformed email in `verify` only → payment still confirms.
6. `npx tsc --noEmit` and `npm run lint` pass; existing in-person booking is unchanged.

## Done when

- The email entered (or already on file) is sent with the booking and with the confirmation.
- The patient receives the invite at that address and sees the same link in the app.
- A missing or bad email never stops a payment or booking.
