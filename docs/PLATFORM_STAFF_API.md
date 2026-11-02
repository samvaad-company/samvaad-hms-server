# Adding staff to a hospital from the root (platform) admin dashboard

How a **Platform Admin** (the root operator, e.g. `platform-admin@samvaad.dev`) adds people to a hospital, and the APIs to build that screen on.

## Concepts (read this first)

| Term | What it is |
|------|-----------|
| **Platform Admin** | The root operator. Belongs to no single hospital; can onboard hospitals and (with the endpoints below) add people to any of them. Can **not** be granted from these endpoints. |
| **Hospital** | A tenant. `status` is `Active`, `Paused` (nobody can sign in) or `Removed`. Everything a hospital owns is hidden from other hospitals. |
| **Login (user)** | An account that can sign in: email + password + **role**. The role decides what the person can see and do. `Super Admin` is a hospital's own top admin. |
| **Staff record** | An entry in the hospital's staff directory (name, phone, employee no., licence…). It does **not** let anyone sign in. A login may be *linked* to a staff record (`staffId`). |

So there are two things you can add: a **login**, a **staff record**, or both at once (create the login with a `staff` object).

The existing `POST /api/admin/users` and `POST /api/staff` write into the *caller's own* hospital. A Platform Admin has no hospital of their own, so they cannot use them to add to a chosen hospital — hence the hospital-targeted endpoints below. (A hospital's own Super Admin keeps using `/api/admin/users` and `/api/staff` for their own hospital.)

## Authentication

Sign in once, then send the session cookie on every call (the browser does this itself when the app and API share an origin).

```
POST /api/auth/login   { "email": "platform-admin@samvaad.dev", "password": "…" }   →  200, sets an HttpOnly cookie
```

All endpoints below need the Platform Admin session. Anyone else gets **403**; no session gets **401**.
Responses are `{ "data": … }` (lists of staff also carry `"meta": { page, pageSize, total, … }`). Errors are `{ "error": { "code", "message", "details?" } }`.

Note: after 5 wrong passwords for one email in 15 minutes, sign-in is locked for 15 minutes (**429**).

## Endpoints

### 1. List hospitals (to pick one)

`GET /api/hospitals` → `[{ id, code, name, status, city, state, phone, email }]`

Create one (with its first Super Admin login): `POST /api/hospitals`

```json
{ "name": "North Clinic", "city": "Pune", "state": "MH", "phone": "", "email": "",
  "adminName": "N Admin", "adminEmail": "admin@north.example", "adminPassword": "min-6-chars" }
```
→ **201** the hospital. Status actions: `POST /api/hospitals/:id/pause | activate | remove`.

### 2. Roles for the dropdown

`GET /api/hospitals/roles` →
```json
["Super Admin","IT Admin","Doctor","Head Nurse","Receptionist","Tele Caller","Billing Exec",
 "Pharmacist","Lab Technician","MRD Officer","HR Manager","CSSD Technician","Driver"]
```
`Platform Admin` and the partner roles (`Lab Partner`, `Radiology Partner` — they need a lab/radiology centre link) are deliberately not offered.
What each role may do: `GET /api/admin/permissions` (the full matrix) — useful for a tooltip.

### 3. Add a login to a hospital

`POST /api/hospitals/:hospitalId/users`

| Field | Required | Notes |
|-------|----------|-------|
| `name` | yes | 2–120 chars |
| `email` | yes | Must look like an address; stored lower-case; **unique across the whole platform** (409 if taken) |
| `password` | yes | 6–100 chars. The person should change it after first sign-in |
| `role` | yes | One of `GET /api/hospitals/roles` (else 400) |
| `status` | no | `Active` (default) or `Inactive` |
| `departmentId` | no | A department id of *that* hospital |
| `doctorId` | no | Only with role `Doctor`: link to an existing doctor record of that hospital (one login per doctor, 409 otherwise) |
| `staffId` | no | Link to an existing staff record of that hospital |
| `staff` | no | **Object.** Creates the staff-directory entry first and links the login to it. Takes the staff fields in §4 (`name`, `role`, `email` default to the login's) |

```json
POST /api/hospitals/3/users
{ "name": "Nina Nurse", "email": "nina@north.example", "password": "Nina@12345", "role": "Head Nurse",
  "staff": { "phone": "9811100001", "employeeNo": "N-01", "qualification": "BSc Nursing" } }
```
→ **201**
```json
{ "data": { "id": 41, "name": "Nina Nurse", "email": "nina@north.example", "role": "Head Nurse",
            "department": null, "departmentId": null, "staffId": 17, "doctorId": null,
            "status": "Active", "lastLogin": "Never" } }
```
Errors: 400 bad role · 404 no such hospital · 409 email already used / hospital removed / doctor already has a login · 422 field problems (`error.details.fields`).

### 4. Add a person to a hospital's staff directory (no login)

`POST /api/hospitals/:hospitalId/staff`

| Field | Required | Notes |
|-------|----------|-------|
| `name` | yes | |
| `role` | yes | Free text job title (e.g. "Ward boy"), max 80 |
| `departmentId` / `department` | no | |
| `phone`, `email` | no | |
| `joinDate` | no | `YYYY-MM-DD`, defaults to today |
| `status` | no | `Active` (default), `On Leave`, `Inactive` |
| `employeeNo` | no | Unique within the hospital (409 if reused) |
| `gender`, `address`, `qualification`, `licenceNo`, `emergencyName`, `emergencyPhone` | no | |
| `dob`, `licenceExpiry` | no | `YYYY-MM-DD` or `null` |

→ **201** the staff record.

### 5. See what a hospital has

- `GET /api/hospitals/:hospitalId/users` → every login of that hospital (never includes Platform Admins).
- `GET /api/hospitals/:hospitalId/staff?page=1&pageSize=25&q=nina&status=Active&role=Head%20Nurse` → paged staff directory.

### 6. Change or remove someone afterwards (already work for the Platform Admin, across hospitals)

- `PATCH /api/admin/users/:userId` — `{ name?, role?, status?, departmentId?, staffId?, doctorId?, password? }` (reset a password, deactivate, change role).
- `DELETE /api/admin/users/:userId` → 204.
- `PATCH /api/staff/:id`, `DELETE /api/staff/:id` — staff directory entries.

Use the ids returned by the list calls above.

## Suggested screen

1. **Hospitals list** (`GET /api/hospitals`) → click a hospital.
2. **Hospital page** with two tabs: *Logins* (`GET …/users`) and *Staff directory* (`GET …/staff`).
3. **Add person** form: name, email, role (dropdown from `GET /api/hospitals/roles`), temporary password, and a "Also add to the staff directory" checkbox that reveals phone / employee no. / qualification and sends them as `staff`.
4. Show the 409 message ("A user with that email already exists") inline on the email field.

## Behaviour worth knowing

- **Audit trail:** the platform admin's name is recorded on the *hospital's* audit trail (Reports → Audit) for every person added or changed, so the hospital can see who did it.
- **Paused hospital:** you can still add people (they just can't sign in until it's reactivated). **Removed:** adding is refused (409).
- **Emails are global:** one email = one login on the whole platform.
- **Role names are exact** (case-sensitive); use the list endpoint, don't hard-code.
- A login with role `Doctor` can sign in, but My Schedule needs `doctorId`; doctor records themselves are created by the hospital in its Doctors screen.
- Not yet covered: lab/radiology **partner** logins (they need a centre link) and an email invite / force-password-change on first sign-in.

## Tests

`npm --prefix server run test:platformstaff` (9 checks: access, role list, create + sign in + isolation, login-with-staff, staff-only, bad requests, paused/removed, audit trail).
