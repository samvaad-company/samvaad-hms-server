# Doctor scheduling — patients per hour, video hours, rescheduling

## The rules

1. **Each doctor sets how many patients they see per hour** (My Schedule → *Patients per hour*: 1, 2, 3, 4, 5, 6, 10,
   12, 15, 20, 30 or 60 — numbers that give every patient a whole number of minutes). The working day is cut into slots of
   `60 ÷ N` minutes, one patient each, so an hour can never hold more than N bookings. Once the hour's places are taken
   it is **Full** and nobody can book it; every person who tries — reception, the patient app, the patient booking link,
   someone rescheduling — gets the same message:

   > This hour is full — Dr. X sees up to 4 patients per hour and all 4 places in it are booked. Please choose another time.

   (If only that exact time is taken but the hour still has room: *"That time was just booked — please pick another slot."*)
   Time pickers show taken times as **Booked** and full hours as **Full**, with `booked/capacity` per hour.
   Default is 2 per hour (30-minute slots), which is what the system did before.

2. **Video hours vs in-person hours.** After an administrator switches video consultations on for the hospital
   (Admin → Settings → Video consultations), each doctor chooses whether to take them (rule 3) and sets their own
   **video hours** (weekly windows, e.g. Mon 16:00–18:00).
   - Inside a video window **only video consultations** can be booked. The time is not offered for in-person visits, and an
     in-person booking for it is refused: *"Dr. X takes video consultations only at that time — please pick another time
     for an in-person visit."*
   - At every other time in the working day **only in-person visits** can be booked. Video isn't offered there, and is
     refused: *"Dr. X sees in-person patients at that time — video consultations are only available in the doctor's video hours."*
   - The two share the doctor's per-hour quota.

3. **A doctor can switch video on or off** (My Schedule → *Video consultations*). Off (or the hospital's switch off) hands
   the video windows back to in-person. Video consultations already booked are kept; the doctor is told how many fall
   outside the new hours so they can reschedule or cancel them.

4. **Rescheduling.** *Doctors* (their own appointments), *reception/admin*, and — for video consultations — the *tele-caller*
   can move an appointment from its detail page (Reschedule); *patients* can move their own from the patient app. The new
   time must be one of the **same doctor's** open times for the **same kind of visit** (a video consultation stays a video
   consultation), checked against the same rules as booking. Patients can't move an appointment that starts within an hour,
   or one already moved 3 times — they're told to call the hospital. A moved video consultation keeps its video link and
   booking and its calendar invite moves with it.

Walk-ins (a patient who is physically there) are never turned away, but they count towards the hour.

## Where things are

| | |
|---|---|
| Doctor's settings | **My Schedule** (doctors) · Doctors → a doctor → Schedule (administrators) |
| Book in-person | Appointments → New Appointment (times come from the server) |
| Book video | Video Consults → Book Consultation / Send booking link |
| Move an appointment | Appointment page → Reschedule |

## API (staff session)

| Call | |
|---|---|
| `GET /api/doctors/<id>/schedule` · `PUT` | `{ patientsPerHour, videoEnabled, videoHours: [{day,start,end}] }` — the doctor or an administrator. `PUT` returns `warnings` for upcoming appointments that no longer fit |
| `GET /api/appointments/slots?doctorId=&date=&mode=in_person\|video[&excludeAppointmentId=]` | the bookable times: `slots[{value,label,status: open\|booked\|full}]`, `hours[{label,booked,capacity,full}]`, `note`, `closedReason` |
| `POST /api/appointments/<id>/reschedule` | `{ date: "YYYY-MM-DD", time: "HH:mm" }` |
| `POST /api/appointments` | now validated against the doctor's schedule for `type: "Booked"` (walk-ins exempt) |

## API (patient app, `x-portal-key`)

| Call | |
|---|---|
| `GET /api/portal/appointments/slots?doctorId=&date=&mode=in_person\|video` | the bookable times (same shape as above) |
| `POST /api/portal/appointments` | book **in-person**: `{ patientId, doctorId, date, time, reason }` → the appointment view |
| `GET /api/portal/appointments/<id>?patientId=` | one appointment with `canReschedule` / `rescheduleBlockedReason` |
| `POST /api/portal/appointments/<id>/reschedule` | `{ patientId, date, time }` |
| `GET /api/portal/teleconsult/doctors?patientId=` | doctors who currently take video, with `patientsPerHour` and `slotMinutes` |

Video bookings keep using `POST /api/portal/teleconsult/bookings`; they now also follow the doctor's video hours and quota.
See `docs/patient-portal-scheduling-prompt.md` for the portal change.

## Tests

`cd server && npm run test:scheduling` (`-- 6` repeats it) covers capacity at every patients-per-hour value, the identical
"full" message from every door, simultaneous bookings for the last places, video/in-person separation and what happens
when a doctor turns video off, the hospital switch, permissions, warnings, and rescheduling by staff, doctors and
patients including the cutoff, the move limit, closed and checked-in appointments, and video consultations keeping their
link while the calendar entry moves.
