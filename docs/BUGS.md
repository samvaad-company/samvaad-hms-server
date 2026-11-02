# Bugs found by the end-to-end flow tests — all fixed

Found by `e2e/flows/*` (run `npm run test:flows`) in a brand-new hospital on a throw-away in-memory API. Every defect below has been fixed, and the
test that pinned it (it used to be a `test.fail(...)` expected failure) is now an ordinary regression test that asserts the correct behaviour.

## What was done

| # | Fix | Where |
|---|-----|-------|
| BUG-001/002/003 | Receptionist: `patients`, `appointments`, `opd` → write; `ambulance` → write (BUG-009) | `server/src/auth/rbac.ts` |
| BUG-004/005 | Head Nurse: `opd`, `ipd` → write. Medicine **orders** stay the prescriber's: creating, editing or deleting an order on a stay needs `prescriptions` write (a nurse can still record doses via `markGiven` and the nurse station) | `rbac.ts`, `ipd-care-service.ts` |
| BUG-008 | Tele Caller: `patients` → write (appointments stay read-only — video bookings go through `teleconsult`) | `rbac.ts` |
| BUG-009 | Receptionist and Driver: `ambulance` → write, so either can open, dispatch, mark at scene and complete a call | `rbac.ts` |
| BUG-006/021 | A lab report needs the sample collected and the test not cancelled (409). A radiology report can't be attached to a cancelled scan | `lab-service.ts`, `radiology-service.ts` |
| BUG-007 | One live stay per patient: admission is refused (409) if the patient already has one; checked inside a per-patient and per-bed lock so two clerks racing can't both win | `ipd-service.ts` |
| BUG-015/016 | A discount can't exceed the bill (on create and edit, 422). A Paid bill can only be refunded, not set back to Pending/Partial; a Refunded bill is final (409) | `billing-service.ts` |
| BUG-018 | A patient can't hold two live (not completed) tokens with the same doctor on the same day (409), under a lock | `opd-service.ts` |
| BUG-019 | Discharge is refused while the patient has unpaid IPD bills (409, with the amount). Someone who can write billing may **waive** it with a written reason (`{ waiveBilling: true, reason }`); the waiver is recorded in the audit trail. The IPD screens ask for the reason | `ipd-service.ts`, `src/lib/ipd-discharge.ts` |
| BUG-020 | New medicine orders, doses, vitals and handover notes are refused (409) on a discharged stay (IV start already was) | `ipd-care-service.ts`, `nurse-station-service.ts` |
| BUG-010 | Sign-in lock-out: 5 wrong passwords for one email (or 50 from one address) within a 15-minute window → 429 until the window ends; a good sign-in clears the email's count; unknown emails count the same. The counts live in MongoDB (a `rate_limits` collection whose windows the database expires by itself), so every API process sees the same lock; other drivers keep them in process memory | `lib/login-throttle.ts`, `db/mongo-adapter.ts` |
| BUG-011 | Sessions of a paused/removed hospital stop working (401) within 10 s — the hospital's status is checked on every request (cached, and dropped the moment it changes) | `auth/tenant-gate.ts`, `auth/server.ts` |
| BUG-012 | The validator refuses an object or list where text is expected (422) instead of saving `[object Object]` | `lib/validation.ts` |
| BUG-013 | Patient email must look like an address | `lib/field-rules.ts`, `patients-service.ts` |
| BUG-014 | Impossible dates (31 Feb) are refused as dates of birth, booking dates and generic dates | `lib/field-rules.ts`, `lib/validation.ts` |
| PERF-001 | The next patient / bill / admission / lab / radiology number and OPD token no longer read the whole table. They come from an **atomic counter in the database** (one `findOneAndUpdate` on MongoDB — safe across any number of API processes); the existing records are scanned once per series after a server start only to lift a counter that is behind, never to lower it. An invoice number is taken as late as possible and handed back if the bill can't be saved, so invoice numbers stay consecutive. Patient registration only searches the register for a duplicate when an ID document is given | `services/sequences.ts`, `id-service.ts`, `opd-service.ts`, `db/mongo-adapter.ts` |
| PERF-002 | Dashboard, home overview and analytics are cached per hospital for up to 30 s and dropped as soon as anything changes in that hospital — both when the API records it (`audit()`) and, on MongoDB, when **any** write reaches the database (a change stream: other processes, scripts, the Atlas console). Simultaneous opens share one computation | `lib/summary-cache.ts`, `services/change-watcher.ts` |
| PERF-003 | The home dashboard's `appointmentsToday` list is capped at 50 (the counts stay exact) | `overview-service.ts` |

**Not changed (still true — see [CAPACITY.md](CAPACITY.md)):** the other ~270 `unpaged: true` reads (87 of them already narrowed by a filter to one
patient/admission) still scan their tables — mostly reports and the dashboards' own builds. The cache and the counters take the work off the hot paths
(register, check-in, bill, admit, the home screens); making the summaries themselves cheap needs database-side counting/summing (an aggregate call on the
adapter) and is the next capacity step. `GET …?all=true` still lets a client pull a whole list.

**Caveats:**
- Counters and lock-out are shared through the database on **MongoDB** (and the in-memory store). On **Supabase/Postgres** they stay in process memory — right for
  one server — until a counters table and an increment function are added there.
- A deleted/disabled ID format falls back to the old "highest + 1" numbering, which is not safe across processes.
- Rows written outside the API with a number higher than the counter (imports) are caught up the next time a server starts, not immediately.
- The lock-out uses fixed 15-minute windows, so a guesser can get up to twice the allowance across a window boundary.
- Change-stream invalidation needs a replica set (Atlas always is). If the stream can't open, the API logs it and falls back to `audit()`-based invalidation;
  set `DB_CHANGE_WATCH=off` to turn it off.

## The original findings

Severity: **High** = wrong money, wrong clinical record, a security hole, or a role that can't do its core job · **Medium** = a rule a hospital
would expect is missing · **Low** = bad data gets in, no one is harmed immediately.

## Roles can't do their jobs (the role matrix, `server/src/auth/rbac.ts`)

| # | Sev | What happens | Test |
|---|-----|--------------|------|
| BUG-001 | High | **A Receptionist can't register a patient** — `POST /api/patients` → 403 ("cannot write patients"). The role has `patients: read`. The screens hide the *New patient* button, so the front desk can't do the first step of every journey. | `01` §2 |
| BUG-002 | High | **A Receptionist can't book an appointment** (`appointments: read`). | `01` §2 |
| BUG-003 | High | **A Receptionist can't check a patient in or issue an OPD token** (`opd: read`). The "Walk-in" training lesson is therefore hidden from them too. | `01` §2 |
| BUG-004 | Medium | **A Head Nurse can't record triage vitals on an OPD token** (`opd: read`). | `01` §2 |
| BUG-005 | Medium | **A Head Nurse can't admit, discharge or order a diet** (`ipd: read`), though they run the ward and the nurse station. | `01` §7–8 |
| BUG-008 | Medium | **A Tele Caller can't turn a lead into a patient** — converting an enquiry needs a registered patient and the role can't register one (nor can a Receptionist). | `03` |
| BUG-009 | Medium | **Only the Super Admin can open or dispatch an ambulance call.** The Receptionist and the Driver are read-only, so there is no day-to-day dispatcher and a driver can't mark "at scene" or "complete". | `03` |

*Fix:* grant `patients`, `appointments`, `opd` write to Receptionist; `opd` write (or a narrower "vitals") and `ipd` write to Head Nurse;
`patients` write to Tele Caller; `ambulance` write to a dispatcher role (and "own call" updates to Driver). Decide the matrix with the hospital — then
the training lessons' `needs` and `recommendedFor` follow automatically.

## Clinical and financial integrity

| # | Sev | What happens | Test |
|---|-----|--------------|------|
| BUG-006 | High | **A lab report can be uploaded and published for a test whose sample was never collected.** It goes straight to "Report Ready". | `01` §4 |
| BUG-021 | Medium | **A report can be uploaded on a *cancelled* lab test.** Same root cause as BUG-006 (no state check on upload). | `07` |
| BUG-007 | High | **A patient who is already admitted can be admitted again to a second bed** (201). Two live admissions, two beds, two bills. Also happens when two clerks do it at the same instant. | `01` §7, `05` |
| BUG-015 | High | **A discount bigger than the bill is accepted** (a bill of ₹100 with ₹500 off). | `04` |
| BUG-016 | High | **A paid bill can be set back to Pending** with a plain edit — it drops out of the day book and the collection. | `04` |
| BUG-018 | Medium | **The same patient can hold two live OPD tokens with the same doctor** (double check-in). | `07` |
| BUG-019 | Medium | **A patient with ₹50,000 unpaid is discharged with no warning or billing clearance.** (A policy choice — but there is no step at all.) | `07` |
| BUG-020 | Medium | **Medicines and vitals can still be added to an admission after the patient was discharged.** | `07` |

## Security

| # | Sev | What happens | Test |
|---|-----|--------------|------|
| BUG-010 | High | **No limit on password guessing**: 15 wrong passwords in a row are all answered normally (no 429, no lock, no delay). | `04` |
| BUG-011 | High | **Pausing a hospital doesn't end its open sessions** — staff already signed in keep full access until their token expires. (New logins *are* blocked.) | `04` |

Checked and **fine**: another hospital's records can't be read, changed, deleted or counted (8 record types × read/write/delete, every list, audit,
reports); a client can't choose a record's hospital; every protected endpoint answers 401 without a session; a logged-out session is dead; the
session cookie is HttpOnly + SameSite; wrong password and unknown user look identical; the public consent link leaks nothing on a wrong token and
can't be signed twice; the IT Admin can't mint a Platform Admin; markup in names is stored as text.

## Bad data gets in

| # | Sev | What happens | Test |
|---|-----|--------------|------|
| BUG-012 | Medium | **An object or list sent where text is expected is saved as the text "[object Object]"** — `lib/validation.ts` turns any value into a string instead of refusing it. | `04` |
| BUG-013 | Low | **A patient's email isn't validated** (`not-an-email` is saved). | `04` |
| BUG-014 | Low | **31 February is accepted as a date of birth** (JavaScript rolls it into March). | `04` |

## Performance and capacity — see [CAPACITY.md](CAPACITY.md)

| # | Sev | What happens |
|---|-----|--------------|
| PERF-001 | High | **Most screens that summarise or number things read whole tables** (`unpaged: true` appears 278 times in `server/src/services`). The home dashboard, analytics, reports, and the *next number* for patients / tokens / invoices all grow linearly with the data — at 20,000 patients a bill takes ~90 ms and the dashboard ~1.4 s on a fast laptop, ~4–5× that on the planned server. |
| PERF-002 | Medium | **Nothing is cached**: every dashboard / analytics open recomputes from scratch, and they block the one Node process for everyone while they run. |
| PERF-003 | Low | The home dashboard's `appointmentsToday` list isn't capped (a busy day returns every appointment). |

## Not bugs (looked odd, are as designed)

- The default *Star Health Premium 2026* contract has a ₹1,000 **minimum copay** on Consultations, so a ₹500 consultation shows the insurer paying ₹0. Procedures split 80/20. (Setup → Sponsors.)
- Booking an appointment for a time that has already passed today is refused (422). Double-booking the same doctor and slot is refused (409/422) — **not** a bug.
- The dispensing stock list drops an item with nothing left in it.
- Lab and radiology report uploads accept only Firebase Storage links (`firebasestorage.googleapis.com` / `storage.googleapis.com`) — by design; the tests use a dummy link.
- `?patient_id=` filters work on MongoDB (checked on the dev database) but not on the in-memory test driver, which compares ids as text. A test-environment quirk only.

## Coverage notes

Screens (as the right role, with real records): 60 screens open with no script error or 5xx and show the expected content. Not covered: file uploads
to Firebase (needs credentials), WhatsApp/Meta calls, Razorpay payments, Google Meet — they need live third-party accounts.
