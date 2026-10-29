# Samvaad HMS — working context

A hand-over note for anyone (human or AI) picking this repo up. It records how the project is laid out, the conventions
the code follows, what was built in the October 2026 sessions, and what is still open. Read `AGENTS.md` first: this
project uses a non-standard Next.js — check `node_modules/next/dist/docs/` before writing Next code.

Last updated: 2026-10-26, branch `surya-dev`.

---

## 1. Shape of the project

| Part | Where | Notes |
|---|---|---|
| Web app | `src/` (Next.js, React, Redux cache, Tailwind tokens) | dev server on **:3005** |
| API server | `server/src/` (Hono, file-routed) | dev server on **:4000**; Next proxies `/api/*` to it |
| Shared types | `src/types/api.ts` (DTOs), `src/types/consent-catalog.ts` | server imports them as `@shared/types/...` |
| DB | `server/src/db/` | adapters: **memory** (tests, default), **Mongo** (dev), **Supabase/Postgres** (prod) |
| Migrations | `supabase/migrations/NNNN_*.sql` | Postgres only; Mongo needs none |
| Tests | `server/scripts/test-*.ts` | in-process, in-memory DB, run with `npm run test:<name>` inside `server/` |

Run: `npm run dev` (web) and `npm --prefix server run dev` (API). In the Claude desktop app both are started with
`preview_start` (`samvaad-server`, `samvaadhms`). Dev login used in tests: `kevin.carter@samvaadhospital.in` /
`Samvaad@123` (Super Admin). Other seeded roles: Doctor `sophia.adams@…`, Receptionist `deepak.nair@…`,
Billing `kavitha.krishnan@…`, Lab Tech `sunita.rao@…` (all `@samvaadhospital.in`).

## 2. Conventions (follow these)

**Server**
- Routes: `server/src/routes/<path>/route.ts` exports `GET/POST/PUT/PATCH/DELETE`. `[id]` becomes `:id`. Static segments win
  over dynamic ones. Helpers in `http/crud.ts`: `collectionRoute`, `itemRoute`, `actionRoute(resource, "read"|"write", fn)`.
- Layers: route → `services/*-service.ts` → `repositories/index.ts` (`createRepository`) → adapter. Row types in
  `db/tables.ts`, row→DTO mappers in `repositories/mappers.ts`.
- **Never pass a mapper that takes a 2nd argument straight to `rows.map`** (the array index becomes that argument — this
  caused the blood-bank donor-list 500). Wrap: `(r) => toXDto(r)`.
- Every query is hospital-scoped: `scopeToHospital(options, actor)` and `assertOwnedByHospital(row, actor, "Label")`.
- Validation: `validate` / `validatePartial` (scalars only; parse arrays by hand). Errors: `ConflictError` (409),
  `ValidationError` (422, takes `[{field,message}]`), `NotFoundError`, `BadRequestError` (400).
- Concurrency: `withKeyLocks([...keys], fn)` and `singleFlight(key, fn)` in `lib/key-lock.ts` (per process). Multi-row
  writes use `transactional(name, uow => …)`. Lazy "ensure defaults" functions are `singleFlight` so two requests can't
  both create them.
- Dates are ISO `yyyy-mm-dd` strings; "today" is `localDate()` (hospital timezone, `lib/clock.ts`).
- Audit: `audit(actor, action, entity, id, meta)`.
- RBAC: `server/src/auth/rbac.ts` (`Resource` union, `RESOURCES`, `ROLE_PERMISSIONS`). New resource ⇒ add to both lists.
- **Memory adapter `eq` filter is strict** — a numeric column filtered via `?col=123` (a string) never matches in tests.
  List search param is `search`, not `q`.

**Frontend**
- Data: `useList`, `useInfiniteList`, `useItem`, `useMutation` (`lib/api/hooks.ts`); any successful write refreshes all mounted
  queries. API client `lib/api/client.ts` (`api.get/post/patch/del`).
- Lint rules are strict: no setState in an effect body, no impure calls (`Date.now()`) during render, escape `'` in JSX text.
  Baseline `npx eslint src` = **24 problems (14 errors, 10 warnings)** — keep it there.
- Dialogs: `components/shared/Modal`, `FormRow` (`FormInput`, `FormSelect`), `SearchSelect`, `ConfirmDialog`, `RowMenu`.
- Printing: `lib/print.ts#printElement` (opens a window, user chooses Save as PDF). Pattern: render the document off-screen,
  `flushSync`, then print.
- Tabs saved per page with `useSavedChoice`.

## 3. What was built (all uncommitted — see §6)

Earlier in the session: follow-ups screen, radiology priority/worklist, prescription detail + AI review, IPD (admit dialog,
list, nurse station, checklists), enquiries renamed ("contacted") and kept separate from follow-ups, OT (day/week/register,
book dialog, equipment/rooms), lab worklist with doctor-set priority.

### Blood bank — `/blood-bank` (`components/bloodbank/`, `server/src/services/bloodbank-*.ts`)
Tabs Stock · Donors · Cross-match · Issues · Registers. Bag-level units, five-flag serology gate, component processing,
cross-match reservation (per-unit lock), issue/return/transfused/reaction, five statutory registers (print → PDF).
Donor ID proof stored as type + last 4 only. Tables `blood_units`, `blood_crossmatches`, `blood_transfusions`
(+ extended `blood_donors`). Migration `0037`. Tests: `test:bloodbank` (30).

### MRD — sidebar group "MRD" (4 pages)
- **File tracking** `/file-tracking` — Files / Requests / Locations / Dashboard. One physical file per patient (`F/26/00017`),
  checkout/return/archive/retrieve/move, request → dispatch → returned, movement trail, overdue. Default locations (racks by
  UHID range, archive rooms, OT counter, a nurse station per department, a cabin per doctor) and files for every patient are
  created lazily (`ensureLocations`, `ensureFiles`). Tables `mrd_locations`, `mrd_files`, `mrd_file_requests`, `mrd_file_movements`.
- **Documents** `/documents` — retention queue (sweep on read; extend or dispose — dispose deletes bytes + row, audit keeps record),
  policies (`mrd_retention_policies`, defaults in `services/mrd-defaults.ts`), folders (`mrd_folders`; 14 standard folders
  ensured by name).
- **Signatures** `/signatures` — all consents across patients (see §4).
- **MRD coding** `/mrd` — coding queue (ICD-10 validated; Pending → In review → Deficient/Coded → Signed off; reopen needs a
  reason), deficiencies, **birth/death registers** (entries permanent; correction = amendment entry), printable 12-month register.
  Cases appear when an admission is discharged (hook in `ipd-service.dischargePatient`) and are back-filled on read.
  Tables `mrd_coding_cases`, `mrd_deficiencies`, `mrd_register_entries`. Migration `0038`. Tests: `test:mrd` (24).
- Role **MRD Officer** added (`mrd`, `consents`, `documents` write). The pre-existing `/records` "Birth & Death" page is separate.

### CSSD — sidebar group "Stores" → `/cssd` (`components/cssd/`, `server/src/services/cssd-service.ts`, `src/types/cssd.ts`)
Central sterile services, modelled on the 5.50.34 PM recording. Tabs Board · Cycles · Issues · Settings; Request / Start cycle / Register set up top.
Loop: register (Dirty) → pack (Pouched / Wrapped / Rigid container) → Packed → start cycle in a chamber → In cycle → record result →
Sterile (until today + shelf life for method × packaging) or back to Dirty on a fail → request → issue (must be sterile and in date;
issue no. CI/yy/#####, return due in 24 h by default, usage charge posts as a pending OPD/IPD bill) → return (Dirty again; can be flagged
"investigate"). A sterile set past its date reads "Expired sterility" and is Reprocessed (→ Packed). Quarantining a passed cycle recalls it:
sets on the shelf go Dirty, sets already out are flagged to investigate. Rules: one running cycle per chamber, one live request/issue per
set (also enforced by unique indexes in `0041_cssd.sql`). Lazily-created defaults: six sterilizers. Settings edit sterilizers and the
shelf-life table (overrides in `cssd_settings`). Tables `cssd_sterilizers`, `cssd_sets`, `cssd_cycles`, `cssd_issues`, `cssd_settings`.
Resource `cssd` (Doctor, Head Nurse, new **CSSD Technician** write). "Stores" group now holds Inventory (moved from Services) + CSSD.
Tests: `test:cssd` (15). Not built from the recording: nothing — but "Usage charge service" became a plain ₹ amount (no service catalog exists).

### HR — sidebar group "HR" (Staff + Attendance moved here from Admin) (`components/hr/`, `server/src/services/hr-*.ts`, `src/types/hr.ts`)
Pages: `/hr` overview (headcount, leave waiting/today, licences lapsing within 60 days, today's duty, latest payroll), `/staff`
(directory, now with Employee ID), `/staff/[id]` (rewritten: real profile + Leave / Shifts / Salary / Documents / Attendance tabs;
the old hard-coded mock data is gone), `/attendance`, `/hr/leave` (Requests · Balances · Calendar · Leave types),
`/hr/roster` (Weekly roster grid · Duty list · Shifts), `/hr/payroll` (Payroll runs · Salaries).
Rules: leave counts **inclusive calendar days**; a request can't span two years, go >60 days back or >366 ahead, overlap another
pending/approved one, or exceed the yearly allowance (approved + pending). Reject needs a note. Approving leave clears already-
rostered shifts on those days and shows the person **On Leave** in the directory (`staff-service` overlays it), today's attendance
count and the monthly register (`attendance-service`); it is never written to `staff.status`. Roster: one shift per person per
day (unique `staff_id+work_date`), nothing on approved-leave days, nothing >7 days back, "copy week" skips filled/leave days.
Payroll (`hr-payroll-service.computePayslip`): paid days = days from join date − approved *unpaid* leave − HR's extra LOP days;
each earning × paid/month days (rounded to ₹); PF % of earned basic; flat professional tax once gross ≥ ₹15,000; net = gross −
deductions. A Draft run can be recalculated (keeps LOP entries) or deleted; Finalized is frozen; one run per month; future months
refused. Attendance "no punch" days are shown for information only (the register can't tell weekly offs from absences).
Lazy defaults: leave types CL/SL/EL/LWP and shifts M/E/N/G per hospital. Resources `hr` and `payroll` (new role **HR Manager**;
Doctor has no payroll; Head Nurse reads hr). Staff documents reuse `DocumentsPanel` with `ownerType="staff"`.
Tables `hr_leave_types`, `hr_leave_requests`, `hr_shifts`, `hr_roster`, `hr_salaries`, `hr_payroll_runs`, `hr_payslips` + new `staff`
columns (employee_no, gender, dob, address, qualification, licence_no/expiry, emergency_*) — migration `0042_hr.sql`; Mongo
schema version 6. Tests: `test:hr` (25). Not built: shift-swap requests, overtime/bonus lines, tax slabs beyond flat PT, bank advice file.

### Dispense — sidebar "Stores" → `/pharmacy/dispense` (`components/dispense/`, `server/src/services/dispense-service.ts`)
Modelled on recording 11.31.01. Pick a patient (or "No patient (OTC)" + walk-in note), optionally **Load Rx** (the patient's undispensed
prescriptions, medicines matched to stock, quantity = frequency × duration), add medicines from stock (chips), set qty/price, choose
**Separate bill / Add to patient's bill / No bill** (the first two need a patient), **Dispense**. Recent dispensing below with Print
(slip) and Return. Stock is now tracked **per batch** (`pharmacy_batches`): dispensing draws earliest-expiry-first, never from an
expired batch, all-or-nothing, under per-item locks. Other screens (PO receive, OTC sale, Rx dispense) still change `pharmacy_items.stock`
directly, so `syncBatches` reconciles batches to that total before every dispense/return (extra stock becomes an `ADJ-n` batch with the
item's expiry; first-ever stock is batch `OPENING`). Billing: separate → Pending Pharmacy bill; patient → grows the patient's open
Pending bill (type IPD when admitted — the dispense then reads "On stay ADM/…" — else OPD), creating one if none; a billing failure is
reported (`billingWarning`) and never undoes the dispense. **Return**: per batch line, Usable → back into its exact batch + item stock;
Damaged/Expired → written off; a billed dispense mints `CN/yy/00001` and a Refunded Pharmacy entry in Billing (no negative bills exist).
The first price entered for an item without one becomes its `unit_price`. Tables `pharmacy_batches`, `pharmacy_dispenses`,
`pharmacy_dispense_lines`, `pharmacy_returns` + `pharmacy_items.unit_price` — migration `0044_pharmacy_dispense.sql`; Mongo schema v8.
API `/api/pharmacy/dispense[/:id[/return]]`, `/stock?q=`, `/rx?patientId=`; permission `pharmacy` (read to view, write to dispense/return).
Tests: `test:dispense` (16). Not built from the video: the other Pharmacy tabs (Ward orders, Purchasing, Indents, Stock ops, Stores,
Retail, CS register), barcode/QR patient scan, and "Register patient" returning straight to the counter.

### Setup — sidebar group "Setup" (Settings, Masters, Hospital setup, Branches, Plan & licence, Refer & earn)
Modelled on the 2026-10-29 recordings (10.49.28 and 10.53.40). One generic table `setup_records` (hospital_id, kind, code, name, active,
sort_order, `data` json) backs every master; `server/src/services/setup-registry.ts` says what each kind holds, `setup-service.ts` does
the shared work (validation, unique codes, links, delete protection, one-default/one-primary), `setup-defaults.ts` seeds a new
hospital the first time anything in Setup is read (48 services in 7 groups, 2 rate plans, 20 sponsors + contracts, payment modes,
ID formats…). API: `/api/setup/:kind[/:id]`, `/api/setup/rate_plan/:id/prices`, `package/:id/content`, `contract/:id/rules`,
`service/import`, `/api/setup/config/:key` (hospital, billing, notifications, security, plan, referral). Lists the rest of the app
picks from (services, wards, categories…) are readable by anyone signed in; everything else and every write needs `admin`.
Screens: `/masters?section=…` (24 sections, ids copied from the video's URLs: services, rate_plans, packages, tax, sponsors,
rate_plan_types (= payer classes), payments, payout_rules, patient_categories, visit_purposes, arrival_statuses, income_groups,
referrals, departments, specialties, org_units, human_ids, clinical_forms, ward_classes, consulting_rooms, facility_areas,
service_collection_centers, collection_centers (= lab), drug_racks), `/hospital-setup`, `/branches`, `/settings` (6 tabs), `/plan`, `/refer`.
UI kit: `components/setup/ui.tsx` (`FormDialog` is data-driven — most add/edit forms are a field list), `ConfigCard` (read/edit card).
Departments stay in the existing table (new optional code/specialty/clinical/active). Migration `0043_setup.sql`; Mongo schema v7.
Tests: `test:setup` (23). **Inferred, not shown in the videos:** Hospital setup's "Charges & posting" and "Clinical policies" tabs,
Settings → Notifications / Security / Protocols, Plan & licence, Refer & earn, the payout-rule / referral / exclusion / limit / DRG /
contract / tax-mapping / settlement / lab-centre / consulting-room dialogs, and the clinical-form designer. **Stored but not yet
acted on:** ID-format masks (existing numbering still uses its own generators), Security policy, Notification toggles, measurement
units, payer-side masters (payout rules, copay/limits, DRG, exclusions) and ward classes / facility areas (see "Masters in use" below for what *is* wired). Not built: Print &
stationery and Treatment sheet buttons on Settings, logo upload.

### Masters in use (registration, appointments, billing)
- **Registration / OPD**: patients gain `patient_category`, `income_group`, `visit_purpose`; `referral_source` and these are validated against the
  Setup masters via `canonicalMaster` (inactive/unknown names → 422; a legacy value already on the record passes unchanged). Appointments gain
  `visit_purpose`. The old hard-coded referral list is replaced by the master (`test:patients` uses "Walk-in").
- **Billing**: `GET /api/billing/catalog?patientId=` returns active services with the price from the patient's category rate plan (falls back to
  the base rate), tax from the GST mapping, payment modes, and hospital billing switches. `createBill` with `items` prices every line on the
  server (client never sets a service price/GST; custom lines carry their own price and GST in 0/5/12/18/28), honours the hospital switches
  (`gstOnBills`, `pricesInclusive`, `roundOff`) and invoice prefix, and stores lines in `bill_items` plus `bills.payment_mode`. Legacy `amount`
  callers (pharmacy, CSSD, dispense) keep the fixed-9% path. Shared maths: `src/types/billing.ts` `priceLines`.
- Migration `0045_masters_in_use.sql`; Mongo schema v9. Tests: `test:inuse` (17).
- **ID formats drive numbering** (`services/id-service.ts` `nextNumber`): UHID, invoice, admission, OT, lab order, radiology order, purchase
  order, MRD file, blood donor, CSSD cycle, credit note number from Setup → ID formats (`LIVE_ID_FORMATS` in `types/setup.ts`; the list marks
  them "In use"). Next number = highest counter among issued numbers that fit the mask in the current period + 1 (no counter table). The
  reset choice decides which period tokens must match today (FY / year / month / never). Starting masks reproduce the old numbering
  (`HMS-{SEQ:4}`, `{PREFIX}-{SEQ:8}` with prefix INV, `ADM/{YYYY}/{SEQ:5}` …); unedited formats seeded earlier are moved to them by
  `syncSeededDefaults`. The hospital's invoice prefix (Hospital setup) wins over the format's own prefix for invoices. A deleted/inactive
  format falls back to the old fixed prefix. "Per branch" scope is not honoured (records carry no branch). Other formats (prescription,
  receipt, claim, GRN…) are editable but nothing numbers by them yet.
- **Wards ↔ ward classes / facility areas**: `wards.ward_class_id`, `wards.facility_area_id` (validated, active, area must be a ward / ICU /
  emergency / other type). Services gain `wardClassId` ("bed charge for this class"; seeded for IPD-GEN/SEMI/PVT/ICU). A ward's bed rate =
  its own rate if set, else the default plan's price of the class's bed-charge service (`rateSource` on `WardDTO`). A patient on a ward is
  priced from a rate plan made for that ward's class when one fits (`pickPlan(..., wardClassId)`). Classes/areas used by wards can't be
  deleted. Bed charges are not auto-posted to bills (the "auto-post bed charges" setting is still stored-only).
- **Insurance** (`types/coverage.ts` pure engine, `services/coverage-service.ts`): a patient payer can carry a `contractId` (picker endpoint
  `GET /api/payer-contracts`, names only). The counter offers the patient's in-force contracts (`BillingCatalogDTO.contracts`, with terms and
  what the payer already paid); an invoice raised with `contractId` is split per line: exclusions → patient; copay rule by service group
  (parents too) else default rule: deductible first, then copay % of the rest within min/max; per-encounter limit; limit rules
  (amount/count per day/visit/admission/year/contract); annual limit (default rule's, else lowest). Saved as `bills.contract_id/payer_share/
  patient_share`, `bill_items.payer_amount`. A contract's `ratePlanId` prices the bill. Not applied: episodic limits, DRG/per-diem rules,
  dual-sponsor coordination, contract discount %, credit days; no TPA claim is raised automatically.
- **Payout rules** (`services/payouts-service.ts`): bills raised from the catalogue earn payouts into `bill_payouts` — Consulting/Surgeon →
  the bill's doctor (`doctorId`), Referred → the patient's referral source (its own payout value replaces the rule's), Outhouse → services
  sent to an external collection centre. On the amount after discount, before GST; the most specific rule wins per line (single service >
  IPD > all); fixed amounts are once per rule per bill. Billing → Payouts lists them by payee and marks them paid; a refunded bill voids
  pending ones; a bill with a paid payout can't be deleted.
- Migrations `0045_masters_in_use.sql`, `0046_ward_masters.sql`, `0047_coverage_and_payouts.sql`; Mongo schema v10. Tests: `test:inuse` (17),
  `test:idformats` (8), `test:wardmasters` (7), `test:coverage` (21).
- Pharmacy OTC sales keep their own payment-mode enum.

### WhatsApp (Meta Cloud API) — Setup → WhatsApp (`/whatsapp`), `docs/WHATSAPP_SETUP.md`
- One number per hospital in `whatsapp_accounts` (token AES-256-GCM encrypted with a key from `SESSION_SECRET`, never returned) plus a
  `whatsapp_messages` log (in/out, delivery status). Connect by Meta Embedded Signup (`POST /api/whatsapp/callback` swaps the code for a token and
  subscribes the app) or by typing ids + token (`PUT /api/whatsapp`, checked with Meta first). `PATCH` = bot switch, country code, signing-link template.
  Admin-only except `GET /api/whatsapp/status` (any user: connected? template ready?). Client: `services/whatsapp-cloud.ts`; account/sending:
  `whatsapp-service.ts`; assistant: `whatsapp-bot.ts`.
- **Signing links**: consent link with delivery `whatsapp` (or `POST /api/consents/:id/whatsapp` to resend) sends the link from the hospital's number — an
  approved template if configured (variables: patient name, form title, link, hospital name; numbered or named), else plain text (Meta refuses it outside
  the 24-hour window, and the screen says so). The link is made either way. Not connected → the old share-menu path.
- **Webhook** `GET/POST /api/whatsapp/webhook` (public path): verify-token challenge; POST checked with `X-Hub-Signature-256` over the raw body, answered 200
  at once, processed after (`setImmediate`). Statuses update the log. Inbound: matched to the hospital by `phone_number_id`, deduped by message id, routed:
  cancel → emergency → running booking → greeting/intents (book, my appointments, prescriptions) → Gemini fallback (canned reply without a key). Booking uses
  the doctor's real slots (`slotsFor` / `bookInPerson`). Conversation state is in memory per number (single instance only).
- Migration `0048_whatsapp.sql`; Mongo schema v11. Tests: `test:whatsapp` (24, Meta stubbed). **Not verified against real Meta** (needs your account): Embedded
  Signup popup, a real send, a real webhook delivery.

### Consents & documents — patient page tab "Documents & consents" (`components/patients/PatientDocuments.tsx`, `components/consents/`)
See §4.

## 4. Consents in detail

- Catalog: `src/types/consent-catalog.ts` — 8 forms × English/Hindi/Gujarati, plus all sign-page strings and relation labels.
  Wording is a plain-language draft and **needs doctor/legal review**.
- Lifecycle (table `signature_requests`, service `services/consents-service.ts`):
  `Draft` (made; print / sign on paper / send) → `Waiting` (link live) → `Signed` | `Refused`; link can be `Cancelled` or expire
  and be replaced. `stage` shown to staff: Not signed yet · Sent to phone · Opened on phone · Signed on phone/paper · Declined ·
  Link cancelled/expired. First open is recorded (`opened_at`).
- Sending: QR code, email (opens the staff member's mail app), WhatsApp/SMS (device share menu), or sign on this device.
  **The server sends no messages.** Validity 1/3/7 days. Token = 24 random bytes, only credential.
- Patient page `/sign/<token>` (no login; `proxy.ts` allows `/sign/`): language switch, 3 steps, **drawn signature required**,
  relation, decline, download signed copy. Public API under `/api/public/signatures` (`""`, `/sign`, `/refuse`, `/copy`).
- Signed on paper: `POST /api/consents/:id/paper` (multipart) records signer/relation/witness/date and files the scan in
  folder "Consent & Undertakings".
- **Templates** (`services/consent-templates-service.ts`, table `consent_templates`, UI: Signatures → Templates tab): the 8 built-in
  forms are read-only; a hospital writes its own (title + text per language, English required, Hindi/Gujarati optional) and uses
  them for any patient. Placeholders `{{patient_name}}`, `{{age}}`, `{{date}}` are filled when a consent is made, and the finished
  wording is copied onto the consent (`template_texts`), so editing/deleting a template never changes an issued consent. A patient
  is only offered the languages a template has. Endpoints `/api/consents/templates[/:id]`. Migration `0040`.
- Staff API: `/api/consents`, `/api/patients/:id/consents`, `/api/consents/:id/{link,cancel,paper,document}`; permission
  resource `consents` (Doctor, Head Nurse, Receptionist, MRD Officer, Super Admin write).
- Documents: `documents` rows gained `title`, `reference_no`, `folder_id`, retention fields. `/api/documents` upload takes
  `folderId`, `title`, `referenceNo`; `PATCH /api/documents/:id` edits; `/api/documents/folders` lists folders.
  Doctor/Head Nurse/Receptionist now have `documents` write.
- Signed copy language: chosen at download time (`components/consents/CopyLanguage.tsx`) — staff via "Signed copy" dialog, patient on the sign page; any language the form has, optional English addendum, defaults to the language signed in. `ConsentDocumentDTO.signedLanguage`.
- Photo → PDF: `src/lib/image-pdf.ts` builds a PDF from photos in the browser (hand-written PDF writer, JPEG per page).
- Migrations `0039`, `0040`. Tests: `test:consents` (16).

## 5. Verifying changes

```bash
cd server && npx tsc --noEmit            # server types
cd .. && npx tsc --noEmit                # web types
npx eslint src                           # expect 24 problems (baseline)
cd server && for t in payments scheduling profile patients enquiries followups rxreview ipd ot labpriority bloodbank mrd consents cssd hr setup dispense inuse idformats wardmasters coverage overview whatsapp; do npm run -s test:$t | tail -1; done
npm run -s test:store                    # from repo root
```
Expected last run (2026-10-29): payments 48, scheduling 18, profile 11, patients 11, enquiries 11, followups 8, rxreview 7,
ipd 22, ot 19, labpriority 7, bloodbank 30, mrd 24, consents 16, cssd 15, hr 25, setup 23, dispense 16, inuse 17, idformats 8, wardmasters 7, coverage 21, store 18 — all passing. (`teleconsult.refund.failed`
printed during `payments` is an expected logged error.)

## 6. Open items and caveats

- **Nothing from these sessions is committed** (~96 changed/new paths on `surya-dev`). Earlier commits only cover the first
  two feature batches. Commit/push only when asked.
- **Migrations `0037`–`0048` have not been run on Postgres/Supabase** (dev DB is Mongo). Mongo schema version is 11
  (`MONGO_SCHEMA_VERSION` in `db/index.ts`) — bump it if you add indexes.
- Old blood-bank aggregate stock/issue tables and the `donate` route were removed; issuing blood no longer creates a bill.
- Retention "nightly sweep" runs on read, not on a schedule.
- No email/SMS/WhatsApp sending infrastructure exists; consent links are copied/shared by staff.
- Consent signed copy is printed via the browser print dialog (Save as PDF), not a server-generated PDF.
- Not built: document "share" icon (from the reference product), ICD-10 code lookup (codes are format-checked only),
  Marathi/Bengali/Tamil/Kannada consent languages (catalog is structured so a language can be added).
- Dev-database demo data created through the API during testing: blood bank (donors/units/cross-matches/issues), MRD files,
  requests, folders, register entries, coding cases, several consents, and a "Case paper" PDF on patient 1
  (Olivia Turner, whose `language` was set to Gujarati).
- Reference recordings the features were modelled on live on the Desktop (`Screen Recording 2026-10-26 at …`): blood bank
  (11.04.37), MRD (11.35.12), consents/documents (1.00.37). File names contain a macOS special space — locate with
  `find -name "Screen Recording 2026-10-26*…"`.
