# Patient portal API — every curl in one place

Copy a block, change the values, run it **from the portal's server** (or your own machine for a quick check). Nothing here contains a real key.
For what each call is for and the rules around it, read [patient-portal-features-prompt.md](patient-portal-features-prompt.md).

**Legend:** ✅ **Live** = was already on the production HMS. 🛠 **New** = now built and tested in the HMS code (branch `surya-dev`, `npm run test:portal`, 16 tests), but **it returns 404 on production until the HMS server is deployed with this code**. Shapes below match what was built.

## 0. Setup (do this once per terminal)

Use **Git Bash** (comes with Git for Windows) or any Linux/macOS shell. The examples use `curl` with single-quoted JSON, which PowerShell does not
handle well (in PowerShell use `curl.exe`, and put POST bodies in a file with `--data @body.json`).

```bash
export HMS="https://hmsapi.samvaadai.com"      # production HMS API server. Local: http://localhost:4000
export KEY="paste-the-portal-key-here"         # PORTAL_API_KEY: same value as on the HMS server. Never commit or share it.
export PATIENT=12                              # an HMS patient id (a real, verified patient on production)
export DOCTOR=2                                # an HMS doctor id
export DAY=2026-12-02                          # a date, YYYY-MM-DD
```

PowerShell equivalent (variables only):

```powershell
$HMS = "https://hmsapi.samvaadai.com"; $KEY = "paste-the-portal-key-here"; $PATIENT = 12; $DOCTOR = 2; $DAY = "2026-12-02"
```

Every call below sends `-H "x-portal-key: $KEY"`. Responses are `{ "data": … }` or `{ "error": { "code", "message" } }`.
Add `-s` to hide the progress bar, `-i` to see the status line, and pipe to `| jq` if you have it.

| Status | Meaning |
|---|---|
| 200 / 201 | worked |
| 400 / 422 | a value is missing or wrong (the message says which) |
| 401 | wrong or missing key |
| 404 | not found, or **not this patient's**, or a planned route that is not built yet |
| 409 | a conflict (for example the time was just taken) |
| 503 | the HMS has no `PORTAL_API_KEY` set |

## 1. Connection checks

```bash
# ✅ Is the server up? (no key needed)
curl -s "$HMS/api/health"

# ✅ Without the key this must be 401
curl -s -o /dev/null -w "%{http_code}\n" "$HMS/api/portal/notifications?patientId=$PATIENT"

# ✅ With the key this must be 200
curl -s -o /dev/null -w "%{http_code}\n" -H "x-portal-key: $KEY" "$HMS/api/portal/notifications?patientId=$PATIENT"
```

## 2. Doctors and available times

```bash
# ✅ Doctors who take VIDEO consultations for this patient's hospital
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/teleconsult/doctors?patientId=$PATIENT"

# 🛠 Doctors for IN-PERSON (or video) visits, with weekly hours and the next free time
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/doctors?patientId=$PATIENT&mode=in_person"

# ✅ Available times for one doctor on one day. mode = in_person | video
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/appointments/slots?doctorId=$DOCTOR&date=$DAY&mode=in_person"

# ✅ Same, while moving an existing appointment (its own time shows as free)
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/appointments/slots?doctorId=$DOCTOR&date=$DAY&mode=in_person&excludeAppointmentId=91"

# 🛠 The next 14 days at a glance: how many open times each day (powers the date strip)
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/doctors/$DOCTOR/availability?patientId=$PATIENT&mode=in_person&from=$DAY&days=14"
```

Slot values come back as `{ "value": "10:30", "label": "10:30 AM", "status": "open|booked|full" }`. Only `open` can be booked.

## 3. Appointments

```bash
# 🛠 The patient's appointments. scope = upcoming | past | all
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/appointments?patientId=$PATIENT&scope=upcoming&page=1&pageSize=20"

# ✅ Book an IN-PERSON appointment ("time" is HH:mm; "reason" 2 to 240 characters)
curl -s -X POST -H "x-portal-key: $KEY" -H "content-type: application/json" \
  -d '{"patientId":'$PATIENT',"doctorId":'$DOCTOR',"date":"'$DAY'","time":"10:30","reason":"Fever for 3 days"}' \
  "$HMS/api/portal/appointments"

# ✅ One appointment (shows canReschedule and why not)
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/appointments/91?patientId=$PATIENT"

# ✅ Reschedule (same doctor, same kind of visit). Refused inside the last hour, or after 3 moves
curl -s -X POST -H "x-portal-key: $KEY" -H "content-type: application/json" \
  -d '{"patientId":'$PATIENT',"date":"2026-12-03","time":"11:00"}' \
  "$HMS/api/portal/appointments/91/reschedule"

# 🛠 Cancel (not inside the last hour; a paid video consultation is refunded by the existing rule)
curl -s -X POST -H "x-portal-key: $KEY" -H "content-type: application/json" \
  -d '{"patientId":'$PATIENT',"reason":"Cannot come"}' \
  "$HMS/api/portal/appointments/91/cancel"
```

## 4. Video consultations (paid)

```bash
# ✅ Is video on for this patient's hospital, the fee, the consent text, test or live payments
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/teleconsult/config?patientId=$PATIENT"

# ✅ Start a booking. Returns the booking and the Razorpay order to open Checkout with.
#    The fee comes from the hospital's price, never from this request. "email" and "consent" are optional.
curl -s -X POST -H "x-portal-key: $KEY" -H "content-type: application/json" \
  -d '{"patientId":'$PATIENT',"doctorId":'$DOCTOR',"date":"'$DAY'","time":"16:00","reason":"Follow-up","email":"patient@example.com","consent":true}' \
  "$HMS/api/portal/teleconsult/bookings"

# ✅ After Razorpay Checkout succeeds: send its three values to confirm the booking
curl -s -X POST -H "x-portal-key: $KEY" -H "content-type: application/json" \
  -d '{"patientId":'$PATIENT',"razorpay_order_id":"order_XXXX","razorpay_payment_id":"pay_XXXX","razorpay_signature":"SIGNATURE","email":"patient@example.com"}' \
  "$HMS/api/portal/teleconsult/bookings/55/verify"

# ✅ Booking status (poll after paying until it says confirmed)
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/teleconsult/bookings/55?patientId=$PATIENT"

# ✅ Find a payment straight after Checkout. Use ONE of orderId, paymentId or bookingId
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/teleconsult/payments/lookup?patientId=$PATIENT&orderId=order_XXXX"
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/teleconsult/payments/lookup?patientId=$PATIENT&bookingId=55"

# ✅ The patient's video consultations with status and join link
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/teleconsult/consultations?patientId=$PATIENT"

# ✅ One video consultation (the id is the appointment id)
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/teleconsult/consultations/91?patientId=$PATIENT"
```

## 5. Prescriptions (and the half prescription)

```bash
# 🛠 List
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/prescriptions?patientId=$PATIENT&page=1&pageSize=20"

# 🛠 One prescription, ready to draw as the half prescription (lang = English | Hindi | Gujarati, optional)
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/prescriptions/7?patientId=$PATIENT&lang=English"

# 🛠 Optional server-made PDF, only if the HMS builds A2.3
curl -s -H "x-portal-key: $KEY" -o Prescription-7.pdf "$HMS/api/portal/prescriptions/7/pdf?patientId=$PATIENT&lang=English"
```

## 6. Reports and documents

```bash
# 🛠 Everything the patient may open. kind = all | lab | radiology | document
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/records?patientId=$PATIENT&kind=all&page=1&pageSize=20"

# 🛠 Download a file. The id is "<kind>-<number>" as the list gives it (lab-31, radiology-4, doc-12)
curl -s -H "x-portal-key: $KEY" -OJ "$HMS/api/portal/records/lab-31/download?patientId=$PATIENT"

# 🛠 Open it inline (for a preview) instead of as a download
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/records/lab-31/download?patientId=$PATIENT&inline=1" --output report.pdf
```

## 7. Upload by the patient, and their details

```bash
# 🛠 Upload a file. category = Outside lab report | Outside prescription | Discharge summary | Insurance | ID proof | Other
#    PDF, JPG, PNG, WEBP or HEIC, up to 10 MB each
curl -s -X POST -H "x-portal-key: $KEY" \
  -F "patientId=$PATIENT" -F "category=Insurance" -F "title=Insurance card" -F "file=@./card.jpg" \
  "$HMS/api/portal/documents"

# 🛠 Delete the patient's own upload (only while it is still "pending" review)
curl -s -X DELETE -H "x-portal-key: $KEY" "$HMS/api/portal/documents/12?patientId=$PATIENT"

# 🛠 The patient's details
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/profile?patientId=$PATIENT"

# 🛠 Ask the hospital to change details (reception applies or rejects it; nothing changes straight away)
curl -s -X POST -H "x-portal-key: $KEY" -H "content-type: application/json" \
  -d '{"patientId":'$PATIENT',"changes":{"phone":"+919876543210","address":"B-402, Lake View","city":"Mumbai","pincode":"400053"}}' \
  "$HMS/api/portal/profile/update-request"

# 🛠 The patient's change requests and their status
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/profile/update-requests?patientId=$PATIENT"
```

## 8. Bills

```bash
# 🛠 Bills with the pending total. status = pending | paid | all
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/bills?patientId=$PATIENT&status=pending&page=1&pageSize=20"

# 🛠 One bill with its lines
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/bills/311?patientId=$PATIENT"

# 🛠 PHASE 2 ONLY, needs the owner's go-ahead: pay a pending bill online
curl -s -X POST -H "x-portal-key: $KEY" -H "content-type: application/json" -d '{"patientId":'$PATIENT'}' "$HMS/api/portal/bills/311/pay-order"
curl -s -X POST -H "x-portal-key: $KEY" -H "content-type: application/json" \
  -d '{"patientId":'$PATIENT',"razorpay_order_id":"order_XXXX","razorpay_payment_id":"pay_XXXX","razorpay_signature":"SIGNATURE"}' \
  "$HMS/api/portal/bills/311/verify"
```

## 9. Updates, notifications and awareness

```bash
# 🛠 The updates feed: prescriptions, reports, bills, appointment changes, follow-ups, plus awareness
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/updates?patientId=$PATIENT&limit=50"
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/updates?patientId=$PATIENT&since=2026-11-26T00:00:00.000Z"

# ✅ The bell: new and cancelled awareness programmes of the last 45 days
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/notifications?patientId=$PATIENT"

# ✅ Mark some or all as read (returns the fresh list)
curl -s -X POST -H "x-portal-key: $KEY" -H "content-type: application/json" -d '{"patientId":'$PATIENT',"ids":[31,32]}' "$HMS/api/portal/notifications/read"
curl -s -X POST -H "x-portal-key: $KEY" -H "content-type: application/json" -d '{"patientId":'$PATIENT',"all":true}' "$HMS/api/portal/notifications/read"

# ✅ Awareness programmes. scope = upcoming | past | all (default); category, search, page, pageSize (max 50) optional
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/awareness?patientId=$PATIENT&scope=upcoming&page=1&pageSize=20"
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/awareness?patientId=$PATIENT&category=Health%20camp&search=diabetes"

# ✅ One programme in full (opening it marks it read)
curl -s -H "x-portal-key: $KEY" "$HMS/api/portal/awareness/31?patientId=$PATIENT"
```

## 9a. One-screen test of everything that is live today

Run after setup. Each line prints the status code; all should be `200` for a real patient and doctor (the POST ones create real data, so they are left out here).

```bash
for path in \
  "teleconsult/doctors?patientId=$PATIENT" \
  "appointments/slots?doctorId=$DOCTOR&date=$DAY&mode=in_person" \
  "teleconsult/config?patientId=$PATIENT" \
  "teleconsult/consultations?patientId=$PATIENT" \
  "notifications?patientId=$PATIENT" \
  "awareness?patientId=$PATIENT"; do
  printf "%s  %s\n" "$(curl -s -o /dev/null -w '%{http_code}' -H "x-portal-key: $KEY" "$HMS/api/portal/$path")" "$path"
done
```

## 10. Rules to remember

- The **key and the patient id never go to the browser or the mobile app.** Only the portal's server makes these calls.
- Use a real, verified patient's id on production. Do not loop over ids or try other patients' ids: the HMS answers `404` for anything that is not that patient's.
- Do not log the response bodies: they hold health records.
- New (🛠) calls answer `404` until the HMS server is deployed with the new code. If a new call gives `404` for a real patient on production, the deploy has not happened yet.
