# The full user flow

One patient, one hospital, from nothing to a closed chart. Every step is done by the role that would do it, and is a test in `e2e/flows/`.
`npm run test:flows` runs them against a throw-away stack (an in-memory API on :4100 — never your database); the browser tests use the app on :3005.

```
Platform operator ─ creates the hospital + its first Super Admin
Super Admin ───── sets it up: department, doctor, ward + beds, pharmacy stock, one login per role
Receptionist ──── registers the patient (with insurance), books the appointment, checks them in → token T-001
Head Nurse ────── records triage vitals
Doctor ────────── calls the token in, consults, writes the prescription, orders blood test + X-ray, books follow-up
Lab Technician ── collects the sample, uploads the report (Report Ready); marks the scan done, uploads the X-ray report
Billing Exec ──── bills under the insurance contract (insurer's share / patient's share), takes the patient's share,
                  raises the TPA claim (Submitted → In Review → Approved → Settled), pays doctor payouts
Pharmacist ────── dispenses the prescription (stock falls, Rx closes), takes a return back into stock
Head Nurse ────── admits the patient to a bed with a deposit (a second admission is refused)
Head Nurse ────── vitals, doses, IV, handover, task; critical SpO₂ raises an alert; makes a consent form
Patient ───────── opens the consent link on their phone, ticks, signs with a finger → Signed (no login)
Head Nurse ────── orders the diet; kitchen sheet generated → dispatched → received on the ward
Head Nurse ────── discharges (unpaid IPD bills must be settled or waived): bed freed, diet order ends, chart queued for MRD, housekeeping job raised
Head Nurse ────── housekeeping: start → assign → complete → verify → bed Ready; linen cycle
MRD Officer ───── codes the chart (ICD-10), signs it off (locked); tracks the paper file out and back
Super Admin ───── day book matches the bill; analytics counts the day; audit chain intact
```

## Where each part is tested

| Spec | What it proves |
|------|----------------|
| `01-patient-journey` | The whole flow above, every step done by the role that would do it |
| `02-roles-ui` | 13 roles in a real browser: sidebar of its own, every item opens, buttons shown only where the role may write; registering a patient with the form; a patient signing on a phone; housekeeping on the board |
| `03-other-roles` | HR (staff, leave, payroll), Tele Caller (lead → follow-up), CSSD (sterilizer, set, cycle), IT Admin (create/reset/disable a login), ambulance dispatch/driver, the cash desk's books |
| `04-isolation-security` | Two hospitals side by side: nothing leaks; unauthenticated access; sign-in; odd input; money rules |
| `05-concurrency` | 20 patients / tokens / 10 invoices / 5 bed requests / 30 dispenses at the same instant: nothing doubled, nothing negative |
| `06-record-screens` | 60 screens opened as the right role over a hospital with real records |
| `07-business-rules` | Double booking, double token, duplicate mobile, discharge with dues, discharged-stay edits, allergies, cancelled tests |

## Running them

```bash
npm run test:flows                        # all flow specs (the browser ones compile pages the first time: allow ~15 min cold)
npx playwright test e2e/flows/01-patient-journey.spec.ts --project=flows     # the journey alone: seconds
npm run load                              # capacity test (see CAPACITY.md)
```
The flow API is started for you on :4100 (`E2E_FLOW_API_PORT` to change it). The dev app's cache (`.next`) grows by gigabytes over a full run — keep 5 GB free.
