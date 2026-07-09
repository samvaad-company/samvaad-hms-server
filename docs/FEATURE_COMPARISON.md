# SamvaadHMS vs E-Care HMS (demo.ecarehms.com) — Feature Gap Checklist

Reference: E-Care HMS demo (Admin login, v4.0), explored module-by-module via the sidebar.
Baseline: current SamvaadHMS codebase (`src/app/(dashboard)/*`).

Legend: `[x]` implemented · `[~]` partially implemented · `[ ]` missing entirely

---

## Dashboard
- [x] KPI stat cards (revenue, patients) — SamvaadHMS has a Reports KPI dashboard
- [ ] Per-department income breakdown widgets (OPD/IPD/Pharmacy/Pathology/Radiology income cards with MoM %)
- [ ] Embedded calendar (month/week/day) on dashboard
- [x] Staff count-by-role widget (present in Staff module, not on dashboard)

## Billing
- [x] OPD/IPD/Pharmacy/Lab billing (separate bill records with GST/discount)
- [ ] Unified "Billing hub" landing page with quick links to bill-by-department
- [x] Blood Issue / Blood Component billing
- [x] Bill lookup (cross-module search by invoice/patient on Billing page)

## Appointment
- [x] Appointment CRUD, status, cancellation
- [x] Doctor-wise schedule view (real appointment data per doctor per date)
- [x] Live patient queue/token display screen (`/queue-board` full-screen board)
- [x] Export list to CSV

## OPD — Out Patient
- [x] OPD visit tracking, token, vitals, consultation
- [x] Patient search/list with last-visit, recheckup count

## IPD — In Patient
- [x] Admission, ward/bed assignment, discharge, transfer
- [x] Discharged-patient history view
- [x] Credit-limit field per IPD case

## Pharmacy
- [x] Stock, restock, expiry tracking, purchase orders, sales/billing
- [x] Medicine/drug master search

## Pathology
- [x] Test ordering, sample status, report generation
- [x] Payments tied to lab bill

## Radiology
- [x] Dedicated Radiology module (order → scan → report pipeline, separate from Lab)

## Blood Bank
- [x] Donor registry, blood-group-wise inventory (whole blood + components), blood/component issue with automatic stock decrement and Blood billing

## Ambulance
- [x] Ambulance call/dispatch log (dispatch puts vehicle On Call; completion frees it)
- [x] Vehicle/fleet master
- [x] Ambulance-use billing (fare billed on completion)

## Front Office
- [ ] **Entirely missing.** Needs: Visitor log (check-in/purpose), Phone Call Log, Postal register (inward/outward mail), Complaint register

## Birth & Death Record
- [x] Birth Record registry, Death Record registry (`/records`)

## Human Resource
- [x] Staff profiles, department/role assignment, status
- [ ] Staff Attendance
- [ ] Payroll
- [ ] Leave management/approval
- [ ] Disabled/deactivated-staff view

## Referral
- [ ] **Entirely missing.** Needs: Referral Person master (referring doctors/agents), Referral Payment tracking (commission)

## TPA Management
- [x] TPA/insurance-company master list
- [x] Claim workflow (Submitted → In Review → Approved/Rejected → Settled) tied to bill numbers

## Finance
- [x] Clinical billing (bills table)
- [x] Non-clinical Income entries with income categories
- [x] Expense entries with expense categories
- [ ] Income/Expense group reports

## Messaging
- [ ] **Entirely missing.** Needs: internal Notice Board, bulk Send SMS, bulk Send Email

## Inventory (non-pharmacy)
- [x] General supplies/equipment stock (linen, PPE, surgical items) with restock and low-stock status
- [x] Issue-to-department workflow with automatic stock decrement

## Download Center
- [ ] **Entirely missing.** Needs: generic document/content repository with upload

## Certificate
- [ ] **Entirely missing.** Needs: Patient ID Card generator, Staff ID Card generator (template + batch print)

## Front CMS
- [ ] **Entirely missing.** Needs: public website page builder — pages, events, gallery, news, media manager, menus, banners

## Live Consultation (Telemedicine)
- [ ] **Entirely missing.** Needs: Zoom-based (or similar) live meeting scheduler linked to appointments flagged "Live Consultant"

## Reports
- [x] Core KPI/doctor-performance reports
- [ ] Most of the ~38 granular report types E-Care ships (balance reports, discharge reports, expiry-medicine report, donor report, payroll report, audit trail, email/SMS log, referral report, etc.) — largely a byproduct of missing modules above rather than a reporting-engine gap

## Setup / Configuration
- [x] Hospital settings (name, GST, address, working hours)
- [x] Department master, role-based permissions
- [x] Bed/ward master
- [ ] General Setting tabs: language, date/time/currency, mobile app config, theme/logo editor
- [ ] SMS/Email gateway setting, Payment Methods config
- [ ] Print Header/Footer template customization
- [ ] Backup/Restore, System Update
- [ ] Custom Fields builder (add custom fields to any entity)
- [ ] Per-module master-data screens for the missing modules (Symptoms, Findings, Zoom Setting, Referral, Inventory, etc.)

---

## Summary

| Status | Count | Modules |
|---|---|---|
| Fully implemented | 15+ | OPD, IPD (incl. credit limit), OT*, Appointments (doctor-wise view, queue board, CSV export), Prescriptions, Pharmacy, Pathology/Lab, Radiology, Blood Bank, Ambulance, Birth & Death Records, TPA/Insurance, Finance (income/expense), general Inventory, Patient/Doctor/Staff registry, Billing (incl. lookup + Blood/Ambulance types), Reports (core), Admin/Setup (core) |
| Missing entirely | 6 | Front Office, Referral, Messaging, Download Center, Certificate, Front CMS, Live Consultation |

*OT (Operating Theatre) is a SamvaadHMS module not present as a distinct E-Care sidebar item (E-Care tracks it only via "OT Report").

**Remaining gaps to prioritize**: Front Office (visitor/call/complaint desk), HR attendance & payroll, Messaging (patient SMS/email), Certificate generation (ID cards), Referral management, Front CMS, Live Consultation.
