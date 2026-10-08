# Prompt: doctor schedules, patients-per-hour limits, video vs in-person hours, and rescheduling (patient portal)

> Paste everything below the line into the AI/engineer working on the **patient portal**
> (`patient-portel/samvaad-ai-portel`; `patient-portel-rn` too if it books). The HMS side is done — this is the portal half.
> Read `docs/doctor-scheduling.md` in the HMS repo for the rules, and `docs/teleconsult-api.md` for the video-booking calls.

---

## What changed in the HMS

- Every doctor now has **patients per hour** (1–60, dividing 60). Each patient gets an equal slot; when the hour's places are
  used up the hour is **Full** and nobody can book it.
- A doctor can reserve **video hours**. In those hours only video consultations can be booked; at every other time in the
  working day only in-person visits can. A time is never offered for both.
- Doctors can switch video **on/off**. If off (or the hospital has video off) there are no video times and the doctor
  doesn't appear in the video booking list.
- **Patients can reschedule** their appointments, and so can doctors/staff.

The portal currently works out slots itself from the hospital's working hours and **writes in-person appointments straight
into the HMS database** (`src/services/appointment.service.ts` → `bookAppointment`, `src/lib/appointment-slots.ts`). That can't
know about any of the above. **Stop doing that for appointments: ask the HMS for the times and let it book.**

## 1. Environment

`HMS_API_BASE_URL` and `PORTAL_API_KEY` (already added for video consultations). All calls are from the portal's **server**
with header `x-portal-key`. Responses are `{ "data": … }` or `{ "error": { "code", "message" } }`; show `message` to the
patient as is.

## 2. Slots — replace the portal's own slot logic

```
GET {HMS}/api/portal/appointments/slots?doctorId=<id>&date=YYYY-MM-DD&mode=in_person|video
→ { data: {
    mode, isOpen, closedReason, doctorName, patientsPerHour, slotMinutes, note,
    slots: [ { value: "10:30", label: "10:30 AM", status: "open" | "booked" | "full" } ],
    hours: [ { label: "10:00 AM – 11:00 AM", booked: 3, capacity: 4, full: false } ]
} }
```

- `mode=in_person` for a normal appointment, `mode=video` for a video consultation. **Never mix them**: the lists are disjoint.
- Render the `slots` grouped by hour (use `hours` for the header: "10:00–11:00 · 3/4 booked", plus a **Full** badge when `full`).
  Show `booked`/`full` slots **disabled and labelled** ("Booked" / "Full") rather than hiding them, so the patient understands why.
  Show `note` ("Dr. X sees up to 4 patients per hour…") and, when `isOpen` is false or nothing is open, `closedReason`.
- Re-fetch when the date or doctor changes, and after any booking attempt fails (the time may just have gone).
- For the video flow also call `GET {HMS}/api/portal/teleconsult/doctors?patientId=<id>` to list only doctors who take video
  (`[{ id, name, specialty, patientsPerHour, slotMinutes }]`); an empty list means hide the Video option.

## 3. Book an in-person appointment through the HMS

Replace `AppointmentService.bookAppointment`'s direct database insert with:

```
POST {HMS}/api/portal/appointments
{ "patientId": 12, "doctorId": 3, "date": "2026-10-12", "time": "10:30", "reason": "Follow-up" }
→ 201 { data: { appointmentId, type, mode, status, doctorName, date, time, startsAt, endsAt,
                rescheduleCount, canReschedule, rescheduleBlockedReason, … } }
```

Keep the rest of what `bookAppointment` does around it (subscribing the patient to the hospital/doctor, the notification and the
push) but only **after** this call succeeds, and take the appointment id from the response. Errors to show verbatim:
`409` *"This hour is full — Dr. X sees up to 4 patients per hour and all 4 places in it are booked. Please choose another time."*
(or *"That time was just booked…"*), `400` *"…takes video consultations only at that time…"* / *"…isn't one of … slots…"* /
*"Please pick a time in the future"*. On any `409` refresh the slots and let the patient pick again.

**The same message is shown to everyone who books** — in the HMS, on the booking link and here — so don't reword it.

Video consultations keep using `POST /api/portal/teleconsult/bookings` (see `docs/patient-portal-teleconsult-prompt.md`) with a time
taken from `mode=video` slots; they obey the same per-hour limit.

## 4. Reschedule

Show a **Reschedule** button on an appointment (list card and detail) when `canReschedule` is true. Where do you get it?
- Video consultations: `GET /api/portal/teleconsult/consultations` items now include `canReschedule`, `rescheduleBlockedReason`
  and `rescheduleCount`.
- Any appointment: `GET {HMS}/api/portal/appointments/<id>?patientId=<id>` returns the same fields.
When it is false show `rescheduleBlockedReason` instead (e.g. *"This appointment starts soon — please call the hospital to change it."*,
*"…already been moved 3 times — please call the hospital…"*, *"Only upcoming appointments can be rescheduled."*).

Flow: patient taps Reschedule → date picker → slots from `GET /api/portal/appointments/slots?doctorId=<same doctor>&date=…&mode=<same mode>&excludeAppointmentId=<id>`
(the `excludeAppointmentId` stops the appointment's own place showing as taken) → pick → confirm →

```
POST {HMS}/api/portal/appointments/<id>/reschedule
{ "patientId": 12, "date": "2026-10-13", "time": "11:15" }
→ 200 { data: <the appointment view> }
```

- **Same doctor, same kind of visit**: a video consultation stays video (only the doctor's video times are offered), an
  in-person one stays in-person. There is no "change doctor" here — to see someone else, cancel/book anew (cancellation of
  video consultations stays with the hospital).
- A video consultation **keeps its link**; the calendar invite is updated by the HMS. Just refresh the screen.
- Errors (`409` full hour / just booked / starts soon / moved too often / already checked in, `400` not a valid slot): show
  the `message`; on a slot error refetch the slots.
- After success: update the appointment in the list, show the new time, and fire a notification/push
  ("Appointment moved to 13 Oct, 11:15 AM") through the portal's existing notification service. Reminders you scheduled for
  the old time must be cancelled and re-created for the new `startsAt`.
- `DO NOT` update `appointments` documents directly for rescheduling (that is what the portal's old
  `AppointmentRepository.updateAppointment` did) — it would bypass every rule above. Cancel can stay as it is for in-person
  appointments.

## 5. Don'ts

- Don't generate your own slot list, and don't hard-code 30-minute slots — slot length varies per doctor (`slotMinutes`).
- Don't insert or update `appointments` for booking/rescheduling; always call the HMS.
- Don't hide Full/Booked times — show them disabled so patients see the hour is full.
- Never expose `PORTAL_API_KEY` to the browser or mobile app.

## 6. Test it

1. In the HMS: Admin → Settings → turn video consultations on. Log in as a doctor → **My Schedule**: set *4 patients per hour*,
   turn video on, add *Monday 16:00–18:00* video hours, save.
2. Portal, in-person: pick that doctor for a Monday → the list shows 15-minute times, **no** 16:00–18:00 times. Book 10:00, 10:15,
   10:30, 10:45 (as four patients, or in the HMS) → the 10 AM hour shows **Full**; a fifth attempt shows the "This hour is full"
   message.
3. Portal, video: the doctor appears in the video list; times are only Monday 4–6 PM. Book one (mock payment or Razorpay test).
4. Reschedule an in-person appointment to another open time → success; reschedule into the full hour → the full-hour message;
   try an appointment starting in under an hour → refused with the call-the-hospital message; move one 4 times → the 4th is refused.
5. Reschedule the video consultation → same Meet link, new time; the doctor sees it in the HMS at the new time.
6. The doctor switches video off in My Schedule → the doctor disappears from the video list; Monday 4–6 PM becomes bookable in person.
7. `npx tsc --noEmit` and `npm run lint` pass.

## Done when

- The portal never shows a time the HMS wouldn't accept, and shows Full/Booked times disabled.
- In-person and video bookings and reschedules all go through the HMS and obey the doctor's per-hour limit and hours.
- A patient can reschedule within the rules and always sees a clear reason when they can't.
