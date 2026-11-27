# Prompt: patient portal features — records, prescriptions, bills, uploads, updates, appointments and available times

> Give this file to Claude (or an engineer). It has **two halves**:
>
> - **Part A — HMS server** (`samvaad-hms`, the `server/` folder). Most of the data the portal needs is **not yet reachable by the portal**.
>   Part A adds new `/api/portal/*` endpoints. Do Part A first, in the HMS repo.
> - **Part B — the patient portal** (`patient-portel/samvaad-ai-portel`, and `patient-portel-rn` if it has the same screens).
>   Part B builds the screens on top of Part A and of the portal endpoints that already exist (section 2).
>
> Rules that apply to both halves are in sections 0 and 1. Read them before writing code.

---

## 0. What we want, in one page

A patient who logs in to the portal can:

| # | Feature | Today | Work needed |
|---|---|---|---|
| 1 | **Appointments**: see doctors, see each doctor's **available days and times**, book, view, reschedule, cancel, join a video consultation | Book, one appointment, reschedule, slots and video are done on the HMS | HMS: list, cancel, in-person doctor list, multi-day availability. Portal: all screens |
| 2 | **Prescriptions**: list, open, **view the half prescription**, **download it** as a PDF, print | Nothing for the portal | HMS: list, detail, a ready-to-print payload. Portal: screens and PDF |
| 3 | **Reports**: lab and radiology reports and other documents, **view and download** | Nothing for the portal | HMS: list and secure download. Portal: screens |
| 4 | **Upload** their own papers (outside reports, old prescriptions, insurance card, ID) and **their details** | Nothing for the portal | HMS: upload, list own uploads, details-change requests. Portal: screens |
| 5 | **Bills**: all bills, **pending bills** with the amount due, bill details, (later) pay online | Nothing for the portal | HMS: list, detail, summary. Portal: screens |
| 6 | **Updates**: a feed of what happened to the patient (new prescription, report ready, bill raised, appointment moved, follow-up due) plus the existing awareness notifications | Awareness notifications only | HMS: updates feed. Portal: bell and feed |

Do **not** read the HMS database from the portal. The portal only calls the HMS API (section 1). Do not copy HMS code into the portal
except where this file says so (the half-prescription layout, section 6).

## 1. How the portal talks to the HMS (applies to every call)

- Environment on the portal's **server**: `HMS_API_BASE_URL` and `PORTAL_API_KEY` (already in use). Every call goes from the portal's
  **server** (never from the browser) with the header `x-portal-key: <PORTAL_API_KEY>`.
- Responses are `{ "data": … }` or `{ "error": { "code", "message" } }`. Show `message` to the patient as written.
- Status codes: `400` bad input, `401` wrong or missing key, `403` not allowed, `404` not found **or not this patient's**, `409` conflict
  (for example a slot just taken), `413` file too large, `415` file type not allowed, `422` a rule was broken (message explains),
  `429` slow down, `503` the HMS has no `PORTAL_API_KEY`.
- Every call acts for **one patient**: `patientId` (the HMS patient id) in the query string or JSON body. The portal already maps
  its logged-in user to an HMS patient id for appointments: **use that same mapping**. A patient linked to several hospitals: call once
  per linked patient id and merge.

### Security rules (these are the most important lines in this file)

1. **The browser must never choose `patientId`.** The portal server takes it from the logged-in session and nothing else. The shared
   key lets the portal act for *any* patient, so a portal bug here is a leak of every patient's records.
2. **The HMS must enforce that a record belongs to that patient.** Every new endpoint in Part A loads the record and checks
   `record.patient_id === patientId` (and the hospital), and answers `404` otherwise, never `403`, so ids can't be probed.
3. **Only patient-safe fields leave the HMS.** Part A returns purpose-built DTOs. Never return raw rows. Never include: internal
   notes, staff names beyond the doctor's name, discount reasons, payer or TPA shares, audit data, AI review findings, other patients'
   data, the hospital's other tenants.
4. **Files:** downloads stream from the HMS through the portal server (or a short-lived signed URL, 5 minutes). No permanent public
   links. Send `Content-Disposition` and the right `Content-Type`. Never put patient data in a URL other than opaque ids.
5. **Uploads:** allow-list of types (PDF, JPG, PNG, WEBP, HEIC), 10 MB each, at most 10 files per request, file name cleaned, the type
   checked by content and not only by the extension. Uploaded files are **unreviewed** until staff look at them (section 4.5).
6. **Do not log** names, phone numbers, diagnoses, file contents or amounts. Log ids and status codes only.
7. **Audit:** the HMS records every portal download and upload (who, what, when, `via: "patient-portal"`), as it already does for
   appointments (`audit(null, "create", "appointment", id, { via: "patient-app" })`).
8. Rate limit the portal's heavy routes (downloads, uploads) per patient in the portal server (for example 30 per minute).
9. Everything is for the patient's own eyes: no caching of PHI in a shared CDN; `Cache-Control: private, no-store` on record routes.

## 2. What already exists on the HMS (do not rebuild)

All need `x-portal-key`. Bodies and responses are JSON.

| Call | What it does |
|---|---|
| `GET /api/portal/teleconsult/doctors?patientId=` | Doctors who take **video** consultations: `[{ id, name, specialty, patientsPerHour, slotMinutes }]` |
| `GET /api/portal/appointments/slots?doctorId=&date=YYYY-MM-DD&mode=in_person\|video[&excludeAppointmentId=]` | **Available times** for one doctor on one day (shape below) |
| `POST /api/portal/appointments` | Book an in-person visit. Body `{ patientId, doctorId, date, time: "HH:mm", reason }`. Returns the appointment view |
| `GET /api/portal/appointments/{id}?patientId=` | One of the patient's appointments with `canReschedule` and `rescheduleBlockedReason` |
| `POST /api/portal/appointments/{id}/reschedule` | Body `{ patientId, date, time }`. Refused inside the last hour or after 3 moves |
| `GET /api/portal/teleconsult/config?...`, `POST /api/portal/teleconsult/bookings`, `POST .../bookings/{id}/verify`, `GET .../bookings/{id}`, `GET /api/portal/teleconsult/consultations?patientId=`, `GET .../consultations/{id}` | Paid video consultation (Razorpay), and the patient's video consultations with links |
| `GET /api/portal/awareness`, `GET /api/portal/awareness/{id}`, `GET /api/portal/notifications?patientId=`, `POST /api/portal/notifications/read` | Awareness programmes and the bell |

Docs for these: `docs/doctor-scheduling.md`, `docs/patient-portal-awareness-prompt.md`, `docs/patient-portal-email-prompt.md`.

### The slots response (this is how the portal shows "available time")

```json
{ "data": {
  "mode": "in_person",
  "doctorName": "Dr. Sophia Adams",
  "patientsPerHour": 2,
  "slotMinutes": 30,
  "isOpen": true,
  "closedReason": null,
  "note": "Dr. Sophia Adams sees up to 2 patients per hour — one every 30 minutes. …",
  "slots": [ { "value": "10:00", "label": "10:00 AM", "status": "open" },
             { "value": "10:30", "label": "10:30 AM", "status": "booked" },
             { "value": "11:00", "label": "11:00 AM", "status": "full" } ],
  "hours": [ { "label": "10:00 AM – 11:00 AM", "booked": 1, "capacity": 2, "full": false } ]
} }
```

Rules the portal must respect: only `status: "open"` can be chosen; `booked` = that exact time is taken; `full` = the hour's places are
used up; `isOpen: false` means show `closedReason` ("Dr. X is on leave", "no in-person hours on Monday", "That date has already
passed"). Past times today are already removed. Video and in-person times are different (a doctor's video hours are not offered
for in-person visits), so always pass the right `mode`. **Always re-fetch the slots right before confirming**, and handle `409`/`422`
on booking by refreshing the slots and saying so ("That time was just booked — please pick another").

The appointment view returned by book / get / reschedule:

```json
{ "appointmentId": 91, "type": "Consultation", "mode": "in_person", "status": "Upcoming",
  "doctorId": 2, "doctorName": "Dr. Sophia Adams", "date": "2026-12-02", "time": "10:30",
  "startsAt": "2026-12-02T05:00:00.000Z", "endsAt": "2026-12-02T05:30:00.000Z", "reason": "Fever for 3 days",
  "rescheduleCount": 0, "canReschedule": true, "rescheduleBlockedReason": null, "videoUrl": null, "updatedAt": "…" }
```

---

# PART A — HMS server (work in the `samvaad-hms` repo)

Follow the existing pattern for portal routes: a folder under `server/src/routes/portal/…/route.ts`, `requirePortalKey(req)` first,
`portalPatientId(...)` for the patient, the work in a **service** (`server/src/services/portal-*.ts`), `withRoute`, `ok(...)`. Look at
`routes/portal/appointments/route.ts` and `services/appointment-scheduling-service.ts` for the style. Read `AGENTS.md`/`CLAUDE.md` first.
The server can import frontend code through the `@shared/*` alias (`../src/*`), which is how it already reads `@shared/types/api`.
Add tests as `server/scripts/test-portal-*.ts` (copy `test-ai-budget.ts` for the harness) and a `test:portal-*` script in `server/package.json`.

A helper used by all of them: `assertPatientRecord(row, patientId)` → `404` unless `row.patient_id === patientId` (and the same hospital).
Put it in one place and test it with a second patient's id on every route.

## A1. Appointments and available times

**A1.1 `GET /api/portal/doctors?patientId=&mode=in_person|video`** — the doctors the patient can book, for the patient's hospital.
`videoDoctorsForPatient` already does this for video; add the in-person version (not on leave, has in-person hours) and return:

```json
[ { "id": 2, "name": "Dr. Sophia Adams", "specialty": "Paediatrics", "photoUrl": null,
    "patientsPerHour": 2, "slotMinutes": 30,
    "weeklyHours": [ { "day": "Mon", "start": "09:00", "end": "13:00" } ],
    "nextAvailable": { "date": "2026-12-01", "time": "10:30" } } ]
```

`weeklyHours` comes from the doctor's working hours (the same source `gridFor` uses, minus video windows for `in_person`).
`nextAvailable` = the first open slot in the next 14 days (stop at the first hit; it may be `null`).

**A1.2 `GET /api/portal/doctors/{id}/availability?patientId=&mode=&from=YYYY-MM-DD&days=14`** — one call that powers the **date strip**:

```json
{ "doctorId": 2, "mode": "in_person", "days": [
  { "date": "2026-12-01", "open": 5, "total": 8, "closedReason": null },
  { "date": "2026-12-02", "open": 0, "total": 0, "closedReason": "Dr. Sophia Adams has no in-person hours on Wednesday." } ] }
```

Build it by calling `slotsFor` for each day (cap `days` at 31, run them in parallel in small batches, never loop with unbounded
queries). `open` = count of `status: "open"`; `total` = slots on that day.

**A1.3 `GET /api/portal/appointments?patientId=&scope=upcoming|past|all&page=&pageSize=`** — the patient's appointments (in-person **and**
video) as `patientAppointmentView` rows plus `consultAmount`, `paymentStatus`, `hospital: { name, address, phone }`. Upcoming = status
`Upcoming` or `Today`, sorted soonest first; past newest first. Page size at most 50.

**A1.4 `POST /api/portal/appointments/{id}/cancel`** — body `{ patientId, reason? }`. Only `Upcoming`/`Today`, not within 1 hour of the
start (same rule as rescheduling; reuse `patientRescheduleInfo`'s cutoff), tell the patient to call the hospital otherwise. Sets status
`Cancelled`, frees the slot, **for a paid video consultation use the existing refund path** (`cancelConsult` / `refundBooking` rules;
do not invent a new one), audits `via: "patient-portal"`. Returns the updated appointment view.

## A2. Prescriptions

**A2.1 `GET /api/portal/prescriptions?patientId=&page=&pageSize=`** → `[ { id, rxNumber, date, doctorName, diagnosis, medicineCount, language } ]`, newest first.
Only prescriptions that are not `Draft`. (Check how `Draft` is used in `prescriptions-service.ts` before deciding.)

**A2.2 `GET /api/portal/prescriptions/{id}?patientId=`** → everything the **half prescription** needs, already prepared so the portal does
not re-implement clinical wording:

```json
{ "id": 7, "rxNumber": "RX-26Nov2026-003", "date": "2026-11-26", "createdAt": "2026-11-26T09:12:00.000Z",
  "language": "English",
  "doctor": { "name": "Dr. Sophia Adams", "specialty": "Paediatrics", "phone": null },
  "patient": { "name": "Olivia Turner", "age": 28, "gender": "Female", "uhid": "HMS-0001", "phone": "+91…" },
  "allergies": ["Penicillin"],
  "vitals": "PULSE RATE - 72/min | BLOOD PRESSURE - 120/80mmHg | WEIGHT - 70kg",
  "diagnosis": ["Vertigo (Benign Positional)"],
  "remarks": ["Avoid cold drinks."],
  "items": [ { "name": "Cetirizine 10mg", "generic": "Cetirizine", "quantity": "5 tablets",
               "pattern": "1-0-0", "timing": "After Meal", "duration": "5 Days",
               "directions": "Take 10mg - in the morning, after breakfast, for 5 days.", "special": "" } ],
  "followUp": "2026-12-03",
  "letterhead": { "enabled": true, "logo": "data:image/png;base64,…", "name": "Patel Hospital", "tagline": "ICU & Diabetes Clinic",
                  "useDoctorName": true, "leftLines": ["M.B.B.S., DNB (Medicine)"], "footerLines": ["HOSPITAL : …"], "accent": "#c0392b", "watermark": true },
  "hospital": { "name": "Samvaad Multispecialty Hospital", "address": "…", "phone": "…" } }
```

How to build it (the HMS already has the pieces):

- `directions` and `special` come from `remarksOf(item, language)`, `pattern` from `toPattern`, `timing` from `timingLabel`, `duration` from
  `durationLabel`, all in `src/lib/prescriptions/remarks.ts` (import with `@shared/lib/prescriptions/remarks`). **Use the prescription's own
  `language`** unless the request has `?lang=English|Hindi|Gujarati`.
- `vitals`, `diagnosis` (primary and secondary), `remarks`, `followUp` come from the prescription's `consultation` JSON. **Return only
  those.** Do **not** return the chief complaint notes, examination findings, investigations or history unless a hospital setting
  allows it (leave a `// TODO(setting)` and do not expose them now). The patient copy is the *half* prescription.
- `letterhead` comes from the hospital row's `letterhead_design` (JSON text; parse it like `parseDesign` in
  `src/components/shared/LetterheadDesign.tsx`). If `enabled` is false, return `{ "enabled": false }` and the portal uses a plain header.
  Never return `letterhead_url` (the photo) on this route.
- Items with no medicine name are dropped. Quantity and all strings are plain text; the portal must escape them when rendering.

**A2.3 (optional, recommended) `GET /api/portal/prescriptions/{id}/pdf?patientId=&lang=`** — a ready PDF of the half prescription, so the
portal and the mobile app need no PDF code. If the HMS has no server-side HTML→PDF yet, **do not add a heavy browser dependency for
this**: skip A2.3 and let the portal render the PDF from A2.2 (section 6). Decide once, write the decision at the top of the route file.

## A3. Reports and documents (view and download)

One list for everything the patient may open:

**A3.1 `GET /api/portal/records?patientId=&kind=all|lab|radiology|document&page=&pageSize=`**

```json
[ { "id": "lab-31", "kind": "lab", "title": "Complete Blood Count", "date": "2026-11-20", "doctorName": "Dr. Daniel Reed",
    "status": "Completed", "hasFile": true, "fileName": "cbc.pdf", "mimeType": "application/pdf", "sizeBytes": 183201,
    "source": "hospital", "reviewStatus": "approved" },
  { "id": "doc-12", "kind": "document", "title": "Insurance card", "category": "Insurance", "date": "2026-11-21",
    "hasFile": true, "source": "patient", "reviewStatus": "pending" } ]
```

- `lab`: lab tests with `patient_id = patientId`; `hasFile` from `hasReport`; list **only completed** tests with a report (a pending
  test shows as `status: "In progress"` with `hasFile: false`, no result text).
- `radiology`: same for radiology.
- `document`: rows in `documents` with `owner_type = "patient"` and `owner_id = patientId` **that are visible to the patient** (see below).
- Ids are strings `"<kind>-<number>"` so the three tables never clash.

**Visibility flag.** Add `visible_to_patient?: boolean` and `source?: "hospital" | "patient"`, `review_status?: "pending" | "approved" | "rejected"` to the
documents table (`server/src/db/tables.ts`, `DocumentRow`). Staff uploads default to **not visible** until someone ticks "Share with patient" in the HMS documents
screen (small change to the staff UI: one checkbox, default off). Lab and radiology **final reports** are visible automatically.
Patient uploads are visible to the patient who uploaded them immediately.

**A3.2 `GET /api/portal/records/{id}/download?patientId=[&inline=1]`** — streams the file (`getLabReportFile`, `getRadiologyReportFile`,
`readDocument` already read bytes through `storage.ts`; reuse them through a **portal-safe wrapper that takes a patient id, not a Session**).
Headers: `Content-Type`, `Content-Disposition: attachment; filename="…"` (or `inline` with `inline=1`), `Cache-Control: private, no-store`,
`X-Content-Type-Options: nosniff`. 404 for anything not this patient's or not visible. Audit every download.

## A4. Upload by the patient (documents and details)

**A4.1 `POST /api/portal/documents`** — `multipart/form-data`: `patientId`, `file`, `category`, `title?`, `note?`.

- `category` one of: `Outside lab report`, `Outside prescription`, `Discharge summary`, `Insurance`, `ID proof`, `Other`.
- Validate as in section 1 rule 5 (type by content, size, count, clean file name, title ≤ 120). Reuse the storage layer; write a documents row with
  `owner_type: "patient"`, `owner_id: patientId`, `uploaded_by: "Patient (portal)"`, `source: "patient"`, `review_status: "pending"`.
- `uploadDocument` currently needs a staff `Session`. Add a portal variant that takes `{ hospitalId, patientId }`. Do not fake a staff session.
- Per-patient limits: at most 50 files and 200 MB in total, so one account cannot fill the storage.
- Returns the `records` row. Staff see these in the patient's documents with a **"Uploaded by patient — to review"** badge, and can approve
  (keeps it) or reject (hides it from the patient's list with a reason). Add that small staff control and a count on the patient page.

**A4.2 `GET /api/portal/documents/mine?patientId=`** is covered by A3.1 (`source: "patient"`). **`DELETE /api/portal/documents/{id}?patientId=`**:
the patient may delete **their own** upload only while `review_status` is `pending`. Everything else `403`/`404`.

**A4.3 The patient's details.**

- `GET /api/portal/profile?patientId=` → `{ name, uhid, age, dob, gender, phone, email, address, city, state, pincode, bloodGroup?, emergencyName, emergencyRelation, emergencyPhone, allergies: string[], chronicConditions: string[] , abhaId? }`.
- `POST /api/portal/profile/update-request` body `{ patientId, changes: { phone?, email?, address?, city?, state?, pincode?, emergencyName?, emergencyRelation?, emergencyPhone?, allergies?, chronicConditions? } }`.
  **Do not write straight into the patient record.** Store a `patient_update_requests` row (`pending`, old and new values, `via: "patient-portal"`).
  Reception sees them under the patient and taps **Apply** or **Reject**. Name, date of birth, gender and UHID are **not** changeable by a patient
  (ask them to visit the front desk). Validate phone and email formats like the rest of the HMS does.
- `GET /api/portal/profile/update-requests?patientId=` → the patient's own requests and their status.

## A5. Bills (including pending)

**A5.1 `GET /api/portal/bills?patientId=&status=pending|paid|all&page=&pageSize=`**

```json
{ "summary": { "pendingCount": 2, "pendingTotal": 1850.00, "currency": "INR" },
  "items": [ { "id": 311, "billNumber": "INV-20251104", "type": "Pharmacy", "date": "2026-11-26", "time": "10:42",
               "total": 1350.00, "status": "Pending", "label": "Bedside · Ward A bed 3 · payment pending",
               "doctorName": null, "admissionNo": "ADM-0012" } ] }
```

- Bill rows: `bills` with `patient_id = patientId`. **Pending** means status `Pending` (and `Partial`, see below).
- **Amount due.** The `bills` table has no "amount paid" column. For `Pending` the amount due is `total`. For `Partial` and `Refunded`, **read
  `billing-service.ts` and the payment-ledger code before deciding**; if the amount paid is not stored, return `status` and `total` only and
  set `due: null`. **Never guess an amount owed.** Write what you found at the top of the route file.
- Patient-safe fields only: no `discountDetails`, no `payerShare`/`patientShare`/contract names, no doctor payout data. Show `total`, `amount`
  (subtotal), `discount`, `gst` as plain numbers; hide how the discount was decided.
- A combined bill (`CB-…`, issued at discharge) appears like any other bill.

**A5.2 `GET /api/portal/bills/{id}?patientId=`** → the list row plus `items: [ { name, quantity, rate, amount } ]` (from `bill_items` where they exist)
and `paymentMode` / `paidOn` when paid. 404 if not this patient's.

**A5.3 (phase 2, only after A5.1–A5.2 are in use) Pay a pending bill online.** `POST /api/portal/bills/{id}/pay-order` and
`POST /api/portal/bills/{id}/verify`, built the same way as the paid video consultation (`payment-gateway.ts`, `teleconsult-service.ts`:
the amount comes from the **bill**, never from the request; the payment is verified server-side before the bill is marked `Paid`; a failed
verify leaves the bill `Pending`; duplicate verify calls do nothing twice). **This moves money: write tests for double-pay, wrong amount,
wrong patient and replay, and show the design to the owner before enabling it.** Do not start A5.3 without an explicit go-ahead.

## A6. Updates feed

**A6.1 `GET /api/portal/updates?patientId=&since=ISO&limit=50`** — newest first, merged with the existing awareness notifications:

```json
[ { "id": "rx-7", "type": "prescription", "title": "New prescription from Dr. Sophia Adams", "text": "RX-26Nov2026-003",
    "at": "2026-11-26T09:12:00.000Z", "read": false, "link": { "screen": "prescription", "id": 7 } },
  { "id": "lab-31", "type": "report", "title": "Your Complete Blood Count report is ready", "at": "…", "read": true, "link": { "screen": "records", "id": "lab-31" } },
  { "id": "bill-311", "type": "bill", "title": "New bill INV-20251104: ₹1,350 pending", "at": "…", "link": { "screen": "bill", "id": 311 } },
  { "id": "appt-91", "type": "appointment", "title": "Appointment moved to 3 Dec, 10:30", "at": "…", "link": { "screen": "appointment", "id": 91 } },
  { "id": "fu-5", "type": "followup", "title": "Follow-up due on 3 Dec", "at": "…" } ]
```

Build it **by reading the tables** (new prescription, completed lab or radiology with a file, new or paid bill, appointment created / moved /
cancelled, follow-up due in the next 7 days): no new storage. Read state: reuse `POST /api/portal/notifications/read` with the new ids
(extend it to accept these id strings; keep it working for awareness ids). Never include anything the patient could not open elsewhere.

## A7. Tests for Part A (all must pass before Part B starts)

For each new route: a second patient's id gets `404`; a missing or wrong `x-portal-key` gets `401`; bad ids get `400`; and the response contains
none of the fields listed under "Only patient-safe fields". Plus: upload rejects a `.exe` renamed to `.pdf`, a file over 10 MB, and a 51st file;
a patient cannot delete an approved file; the pending-bill total equals the sum of the listed pending bills; `availability` for a leave day is closed
with a reason; cancel refuses inside one hour; the prescription payload has no examination, history or AI fields.

---

# PART B — the patient portal (work in `patient-portel/samvaad-ai-portel`)

Follow the portal's existing structure, UI kit and auth. These are server-to-server calls: wrap them in **one** HMS client module on the portal
server (`hms.ts`) that adds `x-portal-key`, the base URL, a timeout (10 s, 30 s for downloads and uploads) and error mapping, and expose them to the
browser only through the portal's own authenticated routes. The browser never sees the key or another patient's id.

## 3. Screens (mobile first, then desktop)

### 3.1 Home
Cards: **Next appointment** (doctor, date, time, Join video button when `mode` is video and `videoUrl` exists), **Pending bills** (count and total, button
"View bills"), **Latest prescription**, **New reports** (count), **Updates** (last 3). Each card has its own loading, empty and error state; one failing card
must not blank the page.

### 3.2 Appointments and available time
1. **My appointments**: tabs Upcoming / Past from `GET /portal/appointments`. Row: doctor, date and time, in-person or video badge, status. Actions:
   **Reschedule**, **Cancel**, **Join video**. Disable with the HMS reason text when `canReschedule` is false.
2. **Book**: choose **In person** or **Video** → choose a doctor (`GET /portal/doctors?mode=`; show `weeklyHours` and `nextAvailable`, e.g. "Next: Tue 1 Dec, 10:30 AM")
   → **date strip** for the next 14 days from `availability` (a day with `open: 0` is greyed with its `closedReason` on tap) → **time grid** from `GET /appointments/slots`
   (`open` tappable; `booked` and `full` shown disabled with the word; group by the hour and show `booked/capacity` from `hours`) → reason (2–240 characters) → confirm.
   In-person books straight away. Video goes through the existing paid flow (see `docs/patient-portal-email-prompt.md` for the email field).
3. **Reschedule** uses the same date strip and time grid with `excludeAppointmentId` and the doctor and mode fixed.
4. After any booking, move or cancel: refetch the list and the slots. Handle `409`/`422` by refreshing the grid and showing the HMS message.
5. Times are in the **hospital's** time zone as the HMS sends them (`date` and `time` strings); format with the same zone, not the phone's.

### 3.3 Prescriptions
List (date, doctor, diagnosis, medicine count) → detail page showing the **half prescription** exactly as section 6 describes, with buttons
**Download PDF**, **Print**, **Share** (mobile share sheet), and a language switch (English, Hindi, Gujarati) that re-fetches with `?lang=`.
File name: `Prescription-<rxNumber>.pdf`.

### 3.4 Reports and documents
Tabs **All / Lab / Radiology / My uploads**. Row: title, date, doctor, status chip. Tap to preview (PDF or image inline, using the `download?inline=1` stream through the portal
server) and **Download**. A test without a file shows "In progress — you'll be notified when it is ready". Uploads show a **Under review / Accepted / Not accepted (reason)** chip.

### 3.5 Upload
**Upload** button on Reports and on Home: pick **category** → choose files or take a photo (mobile camera) → optional title → progress bar → success message "Sent to the hospital for review".
Client-side checks match section 1 rule 5 (type, 10 MB, 10 files) but the server is the judge. Compress large photos on the device before sending (max about 2000 px on the long side).
Allow deleting an upload while it is still **Under review**. Never auto-retry an upload silently more than once.

### 3.6 My details
Shows `GET /portal/profile`. **Edit** opens a form for the allowed fields only; saving calls `POST /profile/update-request` and the page shows
"Sent to the hospital. It will show here once the front desk applies it." with the request status below. Name, date of birth, gender and UHID are read-only with the line
"To change these please visit the front desk."

### 3.7 Bills
- Top card: **Pending: ₹X in N bills** from `summary` (hide the card when 0).
- Tabs **Pending / Paid / All**. Row: bill number, type, date, total, status chip (Pending amber, Paid green, Partial amber, Refunded grey).
- Detail: lines, subtotal, discount, GST, total, payment mode and date when paid. **Download / Print receipt** rendered from the detail (a simple A4 page with the hospital name, the
  patient's name and UHID, the lines and totals). Do not show or compute anything the HMS did not send.
- A **bedside pharmacy** bill shows its label ("Bedside · Ward A bed 3"). A **combined bill** at discharge is listed like any other.
- **Pay now** appears only when the HMS says online payment is available for that bill (phase 2). Until then show "Pay at the hospital counter".

### 3.8 Updates
A bell with an unread count on every screen and a full **Updates** page from `GET /portal/updates` (poll every 60 seconds while the app is open and on focus; do not poll in the
background). Tapping an update opens its screen via `link`. Opening marks it read with `POST /portal/notifications/read`.

## 4. Data and state rules

- Fetch lists with paging (page size 20), never "everything". Use `page`/`pageSize`.
- Cache in memory for the session only; clear on logout. **Never** put records, bills or prescriptions in `localStorage`, service-worker caches or analytics events.
- Money: show `₹` with Indian grouping (`1,23,456.50`), two decimals; never do arithmetic on amounts in the client beyond summing what the HMS returned.
- Empty, loading, error and offline states for every screen. Errors show the HMS `message`; unknown errors show "Something went wrong. Please try again." plus a retry.
- Accessibility: every tap target at least 44 px, visible focus, labels on every input, status never by colour alone.
- Respect the existing portal theme and translations. Hindi and Gujarati labels for the screens are welcome but optional in the first release.

## 5. Delivery order (small, releasable steps)

1. **A1** + Part B appointments and available times (3.2) — the HMS pieces mostly exist.
2. **A2** + prescriptions and the half-prescription PDF (3.3, section 6).
3. **A3** + reports and documents (3.4).
4. **A5.1–A5.2** + bills (3.7).
5. **A4** + uploads and details (3.5, 3.6) — includes the small staff review screen in the HMS.
6. **A6** + updates (3.8) and the Home cards (3.1).
7. **A5.3** online bill payment — only with the owner's go-ahead.

After each step: HMS tests pass (`npm run test:portal-*`, plus `npm run test:rxreview` and the existing suites), the portal builds, and the step is tried in a browser as a real patient
with a second patient's account open to confirm it cannot see the first patient's data.

## 6. The half prescription (what to draw)

The HMS draws it in `src/app/(dashboard)/prescriptions/[id]/page.tsx` (`PrescriptionSheet`, mode `half`). The portal reproduces the same page from the A2.2 payload; **A4 size,
portrait, white background, Arial/Helvetica**. Top to bottom:

1. **Header.** If `letterhead.enabled`: left block = the doctor's name (bold, if `useDoctorName`) then `leftLines` (small), right block = `logo` (about 46 px high) with the hospital `name`
   (uppercase, serif, bold) and `tagline` under it; the logo is also drawn faintly (about 9 % opacity, 42 % of the page width) in the page centre when `watermark` is true. If not enabled:
   the hospital name, address and phone, and the doctor's name and specialty.
2. **Patient line:** *Name, gender, age years, phone* on the left, the date and time on the right; under it `UHID : …`. Allergies in red `ALLERGIES : …` when present.
3. **Vitals** one line (`Vitals : …`), **Diagnosis :** bullets, **Remarks :** bullets (each only when there is something).
4. Centred title **PRESCRIPTION**, then a table with four columns: **Medications** (number, bold name, generic in brackets, `Qty:` under it), **Frequency** (the `pattern`, with `timing` beside it),
   **Duration**, **Remarks** (`directions`, and `special` on its own line). Header row tinted, thin borders.
5. `Followup : Visit on <date>` when `followUp` is set.
6. **Footer block:** "Not valid for Medico Legal Purpose", then the Rx number on the left and the doctor's name on the right, then the small line
   `PRESCRIPTION AUTHORIZED BY <DOCTOR> ON <date time>   (THIS IS A COMPUTER GENERATED REPORT. SIGNATURE IS NOT REQUIRED.)`.
7. If `letterhead.enabled`: the letterhead **footer** at the very bottom: a rule in `accent`, then each `footerLines` entry centred; text before the first ` : ` in `accent` and bold.

Render it as HTML and turn it into a PDF on the device or server (print stylesheet for **Print**; an HTML-to-PDF step for **Download**, with `pdf-lib` or the library the portal
already uses). Escape every value. Fit one page; if the medicines overflow, continue the table on a second page with the header repeated. Test with 1, 8 and 25 medicines, long names, Hindi and Gujarati
directions, and no letterhead.

## 7. Acceptance checklist

- [ ] A patient sees only their own appointments, prescriptions, reports, uploads, bills and updates (tested with two patients, every route).
- [ ] Available times match what reception sees: open, booked and full are shown correctly, a full hour cannot be booked, and a just-taken time gives a clear message and a refreshed grid.
- [ ] A day with no hours or a leave day shows the reason, not an empty grid.
- [ ] Reschedule and cancel follow the one-hour and three-moves rules and show the HMS reason; a cancelled paid video consultation is refunded by the existing path.
- [ ] The half prescription matches the HMS print (header, table, directions in the chosen language, footer) and downloads as a one-page PDF named `Prescription-<rxNumber>.pdf`.
- [ ] A report opens inline and downloads; a test without a file shows "In progress".
- [ ] Uploads accept PDF and images up to 10 MB, reject other types, appear as "Under review", can be deleted while under review, and show up for staff with a badge.
- [ ] A details change creates a request and does not change the patient record until reception applies it.
- [ ] The pending-bills card equals the sum of the pending bills listed; no amount is shown that the HMS did not send; no discount, payer or contract data is shown.
- [ ] The bell shows new prescriptions, ready reports, bills and appointment changes, and clears when opened.
- [ ] No PHI in logs, URLs (other than ids), local storage, analytics or CDN caches; downloads are `private, no-store`.
- [ ] Every new HMS route has a test file and a `test:portal-*` script; existing suites still pass.

## 8. Open questions to settle with the hospital before building (write the answers into the code comments)

1. May patients see the **chief complaint, examination findings and investigations** on their prescription, or only the half prescription? (Default: half only.)
2. Should staff-uploaded documents be shared with the patient by default, or only when ticked? (Default: ticked.)
3. Can a patient **cancel** a paid video consultation, and is the refund automatic? (Default: follow the existing cancel and refund rule exactly.)
4. Are **partial payments** possible on a bill, and where is the paid amount stored? (A5.1 shows "due" only when this is known.)
5. Which details may a patient change without a front-desk check? (Default: none; everything goes through a request.)
6. Retention: how long do patient uploads and update requests stay? (Default: kept with the patient record.)
