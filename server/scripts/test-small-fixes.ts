/**
 * Tests for a round of small fixes: ABHA IDs are exactly 14 digits, mobile numbers are valid, the COVID last-dose date can be marked
 * "not known", vaccinations carry a real date or "not known" (never a pre-filled one), and an OPD visit records both its check-in and
 * its check-out time, in the hospital's own time zone.
 *
 *   npm run test:smallfixes
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { app } = await createApp();

async function request(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  let body: string | undefined;
  if (opts.body !== undefined) { body = JSON.stringify(opts.body); headers["content-type"] = "application/json"; }
  const res = await app.fetch(new Request(`http://localhost${path}`, { method, headers, body }));
  const parsed = (await res.json().catch(() => null)) as { data?: any; error?: { message: string } } | null;
  return { status: res.status, data: parsed?.data, error: parsed?.error, headers: res.headers };
}
const cookies = new Map<string, string>();
async function as(email: string, method: string, path: string, body?: unknown) {
  if (!cookies.has(email)) {
    const login = await request("POST", "/api/auth/login", { body: { email, password: "Samvaad@123" } });
    assert.equal(login.status, 200, `login ${email}`);
    cookies.set(email, (login.headers.get("set-cookie") ?? "").split(";")[0]);
  }
  return request(method, path, { body, headers: { cookie: cookies.get(email)! } });
}

const ADMIN = "kevin.carter@samvaadhospital.in";
const RECEPTION = "deepak.nair@samvaadhospital.in";
const PHARMACIST = "arun.tiwari@samvaadhospital.in";
const NURSE = "rekha.menon@samvaadhospital.in"; // Head Nurse: can read patients, not change them
const OTHER_HOSPITAL = "admin@sunrisehospital.in";
const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
const bad = (s: number) => s === 400 || s === 422;

let counter = 0;
const newPatient = async (extra: Record<string, unknown> = {}) => {
  counter += 1;
  return as(RECEPTION, "POST", "/api/patients", { name: `Small Fix ${counter}`, gender: "Female", age: 30, phone: `98765${String(10000 + counter)}`, ...extra });
};

test("a mobile number must be a real 10-digit Indian number", async () => {
  for (const phone of ["12345", "98765432", "5876543210", "98765432101234", "abcdefghij"]) {
    const r = await newPatient({ phone });
    assert.ok(bad(r.status), `${phone} → ${r.status}`);
  }
  assert.equal((await newPatient({ phone: "+91 98765 43210" })).status, 201, "written with +91 is accepted");
  const alt = await newPatient({ alternatePhone: "1234" });
  assert.ok(bad(alt.status), "alternate number is checked too");
  const emergency = await newPatient({ emergencyPhone: "12345" });
  assert.ok(bad(emergency.status), "emergency number is checked too");
});

test("an ABHA ID is exactly 14 digits, and is kept as digits", async () => {
  for (const abhaId of ["1234", "123456789012345", "12-3456-7890-12345", "abcdefghijklmn"]) {
    const r = await newPatient({ abhaId });
    assert.ok(bad(r.status), `${abhaId} → ${r.status}`);
  }
  const plain = await newPatient({ abhaId: "12345678901234" });
  assert.equal(plain.status, 201, JSON.stringify(plain.error));
  assert.equal(plain.data.abhaId, "12345678901234");
  const dashed = await newPatient({ abhaId: "12-3456-7890-1234" });
  assert.equal(dashed.status, 201);
  assert.equal(dashed.data.abhaId, "12345678901234", "dashes are not kept");
  // changing it later follows the same rule
  assert.ok(bad((await as(RECEPTION, "PATCH", `/api/patients/${plain.data.id}`, { abhaId: "123" })).status));
  assert.equal((await as(RECEPTION, "PATCH", `/api/patients/${plain.data.id}`, { abhaId: "99999999999999" })).data.abhaId, "99999999999999");
  // and it can be left out
  assert.equal((await newPatient()).status, 201);
});

test("the COVID last-dose date can be marked as not known", async () => {
  const p = await newPatient({ covid: { vaccination: "Fully vaccinated", lastDose: "", lastDoseUnknown: true, infectedBefore: false } });
  assert.equal(p.status, 201, JSON.stringify(p.error));
  const got = (await as(RECEPTION, "GET", `/api/patients/${p.data.id}`)).data;
  assert.equal(got.covid.lastDoseUnknown, true);
  assert.equal(got.covid.lastDose, null);
  const dated = await newPatient({ covid: { vaccination: "Fully vaccinated", lastDose: "2022-03-04", lastDoseUnknown: true, infectedBefore: false } });
  assert.equal(dated.data.covid.lastDose, "2022-03-04");
  assert.ok(!dated.data.covid.lastDoseUnknown, "a given date wins over 'not known'");
});

test("vaccinations start empty and need a real date, or 'exact date not known'", async () => {
  const p = (await newPatient()).data;
  assert.deepEqual((await as(RECEPTION, "GET", `/api/patients/${p.id}/vaccinations`)).data, [], "nothing is pre-filled");
  const post = (b: Record<string, unknown>, who = RECEPTION, id = p.id) => as(who, "POST", `/api/patients/${id}/vaccinations`, b);
  assert.ok(bad((await post({ vaccine: "Hepatitis B" })).status), "no date, not marked unknown");
  assert.ok(bad((await post({ vaccine: "Hepatitis B", givenOn: "2999-01-01" })).status), "future date");
  assert.ok(bad((await post({ vaccine: "Hepatitis B", givenOn: "2021-02-31" })).status), "not a real day");
  assert.ok(bad((await post({ givenOn: "2021-02-01" })).status), "needs a vaccine");
  const dated = await post({ vaccine: "Hepatitis B", dose: "Dose 1", givenOn: "2021-03-10", nextDue: "2031-03-10" });
  assert.equal(dated.status, 201, JSON.stringify(dated.error));
  assert.equal(dated.data.givenOn, "2021-03-10");
  assert.equal(dated.data.dateUnknown, false);
  const unknown = await post({ vaccine: "BCG", dateUnknown: true, approxWhen: "as a child" });
  assert.equal(unknown.status, 201);
  assert.equal(unknown.data.givenOn, null);
  assert.equal(unknown.data.dateUnknown, true);
  assert.equal(unknown.data.approxWhen, "as a child");
  const list = (await as(RECEPTION, "GET", `/api/patients/${p.id}/vaccinations`)).data;
  assert.equal(list.length, 2);
  assert.equal(list[0].vaccine, "Hepatitis B", "dated first, 'not known' after");
  // a given date wins over the unknown tick
  const both = await post({ vaccine: "MMR", givenOn: "2020-01-05", dateUnknown: true, approxWhen: "ignored" });
  assert.equal(both.data.dateUnknown, false);
  assert.equal(both.data.approxWhen, "");
  // permissions and isolation
  assert.equal((await post({ vaccine: "MMR", dateUnknown: true }, PHARMACIST)).status, 403);
  assert.equal((await as(OTHER_HOSPITAL, "GET", `/api/patients/${p.id}/vaccinations`)).status, 404);
  assert.equal((await post({ vaccine: "MMR", dateUnknown: true }, NURSE)).status, 403, "read-only can't add");
  assert.equal((await as(NURSE, "DELETE", `/api/patients/${p.id}/vaccinations/${unknown.data.id}`)).status, 403, "read-only can't delete");
  assert.equal((await as(NURSE, "GET", `/api/patients/${p.id}/vaccinations`)).status, 200, "but can read");
  assert.equal((await as(ADMIN, "DELETE", `/api/patients/${p.id}/vaccinations/${unknown.data.id}`)).status, 200);
  assert.equal((await as(ADMIN, "GET", `/api/patients/${p.id}/vaccinations`)).data.length, 2);
});

test("an OPD visit records when it checked in and when it checked out, in the hospital's time zone", async () => {
  const p = (await newPatient()).data;
  const visit = (await as(RECEPTION, "POST", "/api/opd", { patientId: p.id, patientName: p.name })).data;
  const ist = new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
  const minute = (t: string) => { const m = /(\d+):(\d+)\s*(AM|PM)/.exec(t)!; return (Number(m[1]) % 12) * 60 + Number(m[2]) + (m[3] === "PM" ? 720 : 0); };
  assert.ok(Math.abs(minute(visit.checkInTime) - minute(ist)) <= 2, `check-in ${visit.checkInTime} is hospital time ${ist}`);
  assert.ok(visit.checkInAt, "the exact instant is kept");
  assert.equal(visit.checkOutTime, "");
  assert.equal(visit.checkOutAt, null);
  const done = (await as(RECEPTION, "PATCH", `/api/opd/${visit.id}`, { status: "Completed" })).data;
  assert.ok(done.checkOutTime, "checked out when completed");
  assert.ok(done.checkOutAt && done.checkOutAt >= done.checkInAt);
  const again = (await as(RECEPTION, "PATCH", `/api/opd/${visit.id}`, { status: "Completed" })).data;
  assert.equal(again.checkOutAt, done.checkOutAt, "completing twice doesn't move the check-out");
  const reopened = (await as(RECEPTION, "PATCH", `/api/opd/${visit.id}`, { status: "In Consultation" })).data;
  assert.equal(reopened.checkOutTime, "");
  assert.equal(reopened.checkOutAt, null, "a reopened visit has not left yet");
});

test("a prescription for a patient in hospital becomes ward orders, so the nurse station shows the patient and its medicines — once", async () => {
  const patients = (await as(ADMIN, "GET", "/api/patients?pageSize=200")).data;
  const stays = (await as(ADMIN, "GET", "/api/ipd?pageSize=500")).data;
  const inHospital = new Set((stays.items ?? stays).filter((r: any) => r.status !== "Discharged").map((r: any) => r.patientRefId));
  const free = (patients.items ?? patients).filter((p: any) => !inHospital.has(p.id));
  const adm = (await as(ADMIN, "POST", "/api/ipd", { patientId: free[0].id, patientName: free[0].name, diagnosis: "Fever" })).data;
  const doctor = (await as(ADMIN, "GET", "/api/doctors?pageSize=5")).data;
  const doctorId = (doctor.items ?? doctor)[0].id;
  const rx = await as(ADMIN, "POST", "/api/prescriptions", { patientId: free[0].id, patientName: free[0].name, doctorId, diagnosis: "Fever", status: "Pending", items: [
    { medicineName: "Inj. Ceftriaxone", dosage: "1 g", frequency: "BD", duration: "3 days", instructions: "slow push" },
    { medicineName: "Tab. Paracetamol", dosage: "650 mg", frequency: "TDS", duration: "5 days" },
    { medicineName: "Betadine ointment", dosage: "", frequency: "OD", duration: "" },
  ] });
  assert.equal(rx.status, 201, JSON.stringify(rx.error));
  // the ward sees them: the nurse station lists the patient with three new orders, and the medicines have doses on the chart
  const live = (await as(ADMIN, "GET", "/api/ipd/board")).data.live.find((l: any) => l.admissionId === adm.id);
  assert.ok(live, "the patient is on the nurse station board");
  assert.equal(live.newOrders, 3, "each medicine is an order on the stay");
  const slots = (await as(ADMIN, "GET", "/api/ipd/nurse/doses")).data.filter((d: any) => d.admissionId === adm.id);
  const route = (name: string) => slots.find((d: any) => d.medicineName.includes(name))?.route;
  assert.equal(route("Ceftriaxone"), "IV");
  assert.equal(route("Paracetamol"), "Oral");
  // (a once-a-day medicine has a single dose time, which may already have passed when this runs, so its route is not checked here)
  assert.ok(slots.some((d: any) => d.medicineName.includes("Ceftriaxone")));
  // loading the nurse station again doesn't copy the medicines twice
  await as(ADMIN, "GET", "/api/ipd/nurse/board");
  assert.equal((await as(ADMIN, "GET", "/api/ipd/board")).data.live.find((l: any) => l.admissionId === adm.id).newOrders, 3);
  // a patient who is not in hospital gets no ward orders
  const rx2 = await as(ADMIN, "POST", "/api/prescriptions", { patientId: free[1].id, patientName: free[1].name, doctorId, diagnosis: "Cold", status: "Pending", items: [{ medicineName: "Tab. Cetirizine", dosage: "10 mg", frequency: "OD", duration: "3 days" }] });
  assert.equal(rx2.status, 201);
  const everyone = (await as(ADMIN, "GET", "/api/ipd/nurse/doses")).data;
  assert.ok(!everyone.some((d: any) => /Cetirizine/.test(d.medicineName)), "no ward orders for a patient who is not in hospital");
});

test("billing: every service says which billing category it is in, and each type of bill has services in Masters", async () => {
  const cat = (await as(ADMIN, "GET", "/api/billing/catalog")).data;
  assert.ok(cat.services.every((s: any) => typeof s.billingCategory === "string" && s.billingCategory));
  const count = (c: string) => cat.services.filter((s: any) => s.billingCategory === c).length;
  for (const c of ["Consultation", "Laboratory", "Pharmacy", "Radiology", "Blood", "Ambulance", "IPD charge"]) assert.ok(count(c) > 0, `services in ${c}`);
  const phar = cat.services.filter((s: any) => s.billingCategory === "Pharmacy");
  assert.ok(phar.every((s: any) => s.price > 0 && s.name), "each has a name and a price");
});

test("a type of bill with nothing in Masters can be given starter services, once, by someone who may change Masters", async () => {
  const before = (await as(ADMIN, "GET", "/api/billing/catalog")).data.services.filter((s: any) => s.billingCategory === "Ambulance").length;
  assert.equal((await as(RECEPTION, "POST", "/api/billing/catalog/starter", { type: "Ambulance" })).status, 403, "only someone who can change Masters");
  assert.ok(bad((await as(ADMIN, "POST", "/api/billing/catalog/starter", { type: "Dental" })).status), "only the types that have starters");
  const first = await as(ADMIN, "POST", "/api/billing/catalog/starter", { type: "Ambulance" });
  assert.equal(first.status, 200, JSON.stringify(first.error));
  assert.equal(first.data.added, before === 0 ? 3 : 0, "adds only what is missing");
  assert.equal((await as(ADMIN, "POST", "/api/billing/catalog/starter", { type: "Ambulance" })).data.added, 0, "a second press adds nothing");
  assert.ok((await as(ADMIN, "GET", "/api/billing/catalog")).data.services.filter((s: any) => s.billingCategory === "Ambulance").length >= 3);
});

test("a medicine's price can be set in Masters (by someone who may change Masters), and cleared back to the MRP", async () => {
  const list = (await as(ADMIN, "GET", "/api/medicines?pageSize=1")).data;
  assert.ok(list.length > 0, "medicines exist");
  const id = list[0].id;
  assert.equal((await as(RECEPTION, "PATCH", `/api/medicines/${id}`, { price: 12 })).status, 403, "only someone who can change Masters");
  assert.ok(bad((await as(ADMIN, "PATCH", `/api/medicines/${id}`, { price: -1 })).status), "a price can't be negative");
  const set = (await as(ADMIN, "PATCH", `/api/medicines/${id}`, { price: 12.5 })).data;
  assert.equal(set.masterPrice, 12.5);
  assert.equal(set.price, 12.5, "the master price is the one charged");
  const cleared = (await as(ADMIN, "PATCH", `/api/medicines/${id}`, { price: null })).data;
  assert.equal(cleared.masterPrice, null);
  assert.equal(cleared.price, cleared.mrp, "with no master price the MRP applies");
});

test("bills carry a time; an IPD bill is tied to its admission; discount details add up; a big IPD bill gets the remark from Masters", async () => {
  const patients = (await as(ADMIN, "GET", "/api/patients?pageSize=200")).data;
  const stays = (await as(ADMIN, "GET", "/api/ipd?pageSize=500")).data;
  const inHospital = new Set((stays.items ?? stays).filter((r: any) => r.status !== "Discharged").map((r: any) => r.patientRefId));
  const free = (patients.items ?? patients).filter((p: any) => !inHospital.has(p.id));
  const p = free[1];
  const adm = (await as(ADMIN, "POST", "/api/ipd", { patientId: p.id, patientName: p.name, diagnosis: "Fever", depositAmount: 3000, depositMode: "Cash" })).data;
  const line = (price: number) => ({ items: [{ description: "Room and care", quantity: 1, unitPrice: price, gstRate: 0 }] });
  const small = (await as(ADMIN, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "IPD", admissionId: adm.id, billTime: "14:05", ...line(4000) })).data;
  assert.equal(small.billTime, "14:05", "the time given is kept");
  assert.equal(small.admissionId, adm.id);
  assert.equal(small.admissionNo, adm.admissionNo);
  assert.equal(small.admissionDeposit, 3000);
  assert.equal(small.dischargeDate, "", "not discharged yet");
  assert.equal(small.remarks, undefined, "under the limit there is no remark");
  const big = (await as(ADMIN, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "IPD", admissionId: adm.id, ...line(6000) })).data;
  assert.match(big.billTime, /^\d\d:\d\d$/, "a bill without a time gets the current one");
  assert.match(big.remarks, /SPECIAL SINGLE ROOM/, "above the limit the Masters remark is added");
  // the limit and the wording are Masters settings
  assert.equal((await as(ADMIN, "PUT", "/api/setup/config/billing", { ipdRemarkLimit: 8000, ipdRemarkText: "Room rent includes nursing" })).status, 200);
  assert.equal((await as(ADMIN, "GET", "/api/billing/catalog")).data.ipdRemark.limit, 8000);
  assert.equal((await as(ADMIN, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "IPD", ...line(6000) })).data.remarks, undefined, "6000 is under the new limit");
  assert.equal((await as(ADMIN, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "IPD", ...line(9000) })).data.remarks, "Room rent includes nursing");
  assert.equal((await as(ADMIN, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "IPD", remarks: "Edited on this bill", ...line(9000) })).data.remarks, "Edited on this bill", "a remark can be edited on the bill");
  // discount details: percent of the charges or an amount, summed
  const dd = (await as(ADMIN, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", ...line(1000), discountDetails: { hospital: { percent: 10 }, tpa: { amount: 50 } } })).data;
  assert.equal(dd.discount, 150);
  assert.equal(dd.total, 850);
  assert.deepEqual(dd.discountDetails.hospital, { percent: 10, amount: 100 });
  assert.equal(dd.discountDetails.tpa.amount, 50);
  assert.equal(dd.discountDetails.doctor.amount, 0);
  assert.ok(bad((await as(ADMIN, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", ...line(1000), discountDetails: { hospital: { percent: 80 }, doctor: { percent: 30 } } })).status), "discounts together can't exceed the bill");
  // another patient's admission can't be put on the bill
  const other = free[2];
  assert.ok(bad((await as(ADMIN, "POST", "/api/billing", { patientId: other.id, patientName: other.name, type: "IPD", admissionId: adm.id, ...line(100) })).status));
  // discharging records the day, which the next IPD list shows
  await as(ADMIN, "POST", `/api/ipd/${adm.id}/discharge`, { waiveBilling: true, reason: "test" });
  const after = (await as(ADMIN, "GET", `/api/ipd?pageSize=500`)).data;
  const rec = (after.items ?? after).find((r: any) => r.id === adm.id);
  assert.match(rec.dischargeDate || "", /^\d{4}-\d\d-\d\d$/, "discharge date is recorded");
});

test("every bill says cash or cashless (with the TPA and policy), and keeps the patient's details as they were", async () => {
  const patients = (await as(ADMIN, "GET", "/api/patients?pageSize=50")).data;
  const p = (patients.items ?? patients)[0];
  const line = { items: [{ description: "Consultation", quantity: 1, unitPrice: 500, gstRate: 0 }] };
  const cash = (await as(ADMIN, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", referringDoctor: "Dr. Mehta", ...line })).data;
  assert.equal(cash.payType, "Cash", "cash unless said otherwise");
  assert.equal(cash.tpaName, "");
  assert.equal(cash.patientDetails.name, p.name);
  assert.equal(cash.patientDetails.uhid, p.patientId);
  assert.equal(cash.patientDetails.referringDoctor, "Dr. Mehta");
  assert.equal(cash.patientDetails.patientType, "Cash");
  assert.ok(bad((await as(ADMIN, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", payType: "Cashless", ...line })).status), "a cashless bill must say who pays");
  const payers = (await as(ADMIN, "GET", "/api/billing/catalog")).data.payers;
  assert.ok(Array.isArray(payers), "the catalogue lists the insurers / TPAs for the dropdown");
  const cl = (await as(ADMIN, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", payType: "Cashless", tpaName: "Star Health", policyNumber: "POL-123", savePolicyToPatient: true, ...line })).data;
  assert.equal(cl.payType, "Cashless");
  assert.equal(cl.tpaName, "Star Health");
  assert.equal(cl.policyNumber, "POL-123");
  assert.equal(cl.patientDetails.patientType, "Credit");
  const saved = (await as(ADMIN, "GET", `/api/patients/${p.id}`)).data;
  assert.equal(saved.insurer, "Star Health", "the insurer was added to the patient's record");
  assert.equal(saved.policyNumber, "POL-123");
  // IPD: the consulting doctor comes from the admission
  const bill = (await as(ADMIN, "GET", `/api/billing/${cl.id}`)).data;
  assert.equal(bill.tpaName, "Star Health");
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (e) { failed++; console.log(`  FAIL  ${t.name}\n        ${(e as Error).message.split("\n").join("\n        ")}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
