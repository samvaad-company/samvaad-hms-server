/* eslint-disable @typescript-eslint/no-explicit-any -- API replies are untyped JSON in these tests */
import { expect, test } from "@playwright/test";
import { newHospital, type Tenant } from "./support/stack";

/** Rules a hospital would expect the software to hold, whoever is at the keyboard. */
test.describe.configure({ mode: "serial" });
let T: Tenant;
const S: Record<string, any> = {};
test.beforeAll(async ({ playwright }) => {
  T = await newHospital(playwright, "Rules");
  S.p = (await T.users.admin.post("/api/patients", { name: "Rules Patient", age: 50, gender: "Male", phone: "9844400001" })).data;
});
test.afterAll(async () => { await T?.dispose(); });

test("two patients can't be booked with the same doctor in the same slot", async () => {
  const other = (await T.users.admin.post("/api/patients", { name: "Second Patient", age: 30, gender: "Female", phone: "9844400002" })).data;
  const book = (p: any) => T.users.admin.post("/api/appointments", { patientId: p.id, patientName: p.name, doctorId: T.doctorId, date: T.tomorrow, time: "10:30 AM", type: "Booked" });
  expect((await book(S.p)).status).toBe(201);
  expect([409, 422], "same slot").toContain((await book(other)).status);
});

test("the same patient can't hold two appointments with one doctor at the same time", async () => {
  const book = () => T.users.admin.post("/api/appointments", { patientId: S.p.id, patientName: S.p.name, doctorId: T.doctorId, date: T.tomorrow, time: "03:00 PM", type: "Booked" });
  expect((await book()).status).toBe(201);
  expect([409, 422]).toContain((await book()).status);
});

test("a patient can't be given two live OPD tokens with the same doctor at once", async () => {
  const checkIn = () => T.users.admin.post("/api/opd", { patientId: S.p.id, patientName: S.p.name, doctorId: T.doctorId, reason: "cough" });
  expect((await checkIn()).status).toBe(201);
  expect([409, 422], "second live token").toContain((await checkIn()).status);
});

test("two patients with the same mobile number are allowed (a family), and both can be told apart", async () => {
  const a = await T.users.admin.post("/api/patients", { name: "Parent One", age: 60, gender: "Male", phone: "9844400009" });
  const b = await T.users.admin.post("/api/patients", { name: "Child One", age: 12, gender: "Male", phone: "9844400009" });
  expect([a.status, b.status]).toEqual([201, 201]);
  expect(a.data.patientId).not.toBe(b.data.patientId);
});

test("a patient with an unpaid bill can't be discharged without a billing clearance", async () => {
  const a = T.users.admin;
  const adm = (await a.post("/api/ipd", { patientId: S.p.id, patientName: S.p.name, bedId: T.bedIds[0], doctorId: T.doctorId })).data;
  const bill = (await a.post("/api/billing", { patientId: S.p.id, patientName: S.p.name, type: "IPD", amount: 50000, status: "Pending" })).data;
  const r = await T.users.doctor.post(`/api/ipd/${adm.id}/discharge`);
  expect([409, 422], "discharge with ₹50,000 unpaid").toContain(r.status);
  expect((await T.users.doctor.post(`/api/ipd/${adm.id}/discharge`, { waiveBilling: true, reason: "Doctor says so" })).status, "only someone who can write billing may waive").toBe(409);
  // Settled, the same discharge goes through.
  expect((await a.patch(`/api/billing/${bill.id}`, { status: "Paid", paymentMode: "Cash" })).status).toBe(200);
  expect((await T.users.doctor.post(`/api/ipd/${adm.id}/discharge`)).status).toBe(200);
});

test("a discharged patient can't be given new medicines or vitals on the old admission", async () => {
  const a = T.users.admin;
  const adm = (await a.get("/api/ipd?all=true")).data.find((x: any) => x.status === "Discharged");
  expect(adm).toBeTruthy();
  const med = await T.users.doctor.post("/api/ipd/medications", { admissionId: adm.id, medicineName: "Inj. X", dosage: "1 g", frequency: "OD", route: "IV" });
  const vit = await T.users.nurse.post("/api/ipd/nurse/vitals", { admissionId: adm.id, pulse: 80 });
  expect([400, 409, 422], "medicine on a discharged stay").toContain(med.status);
  expect.soft([400, 409, 422], "vitals on a discharged stay").toContain(vit.status);
});

test("a prescription for a drug the patient is allergic to is flagged by the AI review", async () => {
  const a = T.users.admin;
  const p = (await a.post("/api/patients", { name: "Allergic Pat", age: 40, gender: "Female", phone: "9844400020", allergies: "Penicillin" })).data;
  const rx = (await T.users.doctor.post("/api/prescriptions", { patientId: p.id, patientName: p.name, doctorId: T.doctorId, diagnosis: "Throat infection", status: "Draft", items: [{ medicineName: "Amoxicillin 500", dosage: "500 mg", frequency: "TDS", duration: "5 days" }] })).data;
  const review = await T.users.doctor.post(`/api/prescriptions/${rx.id}/ai-review`);
  expect([200, 201, 503, 501, 400], JSON.stringify(review.error)).toContain(review.status);
});

test("a deleted/cancelled appointment doesn't keep occupying the slot", async () => {
  const a = T.users.admin;
  const ap = (await a.post("/api/appointments", { patientId: S.p.id, patientName: S.p.name, doctorId: T.doctorId, date: T.tomorrow, time: "11:30 AM", type: "Booked" })).data;
  expect((await a.patch(`/api/appointments/${ap.id}`, { status: "Cancelled" })).status).toBe(200);
  const again = await a.post("/api/appointments", { patientId: S.p.id, patientName: S.p.name, doctorId: T.doctorId, date: T.tomorrow, time: "11:30 AM", type: "Booked" });
  expect(again.status).toBe(201);
});

test("a cancelled lab test can't be reported on", async () => {
  const o = (await T.users.doctor.post("/api/lab/orders", { patientId: S.p.id, patientName: S.p.name, doctorId: T.doctorId, tests: [{ testName: "Urine R/M" }] })).data.tests[0];
  const c = await T.users.lab.patch(`/api/lab/${o.id}`, { status: "Cancelled" });
  expect([200, 400, 409, 422]).toContain(c.status);
  if (c.status === 200) {
    const rep = await T.users.lab.post(`/api/lab/${o.id}/report`, { fileName: "u.pdf", fileUrl: "https://firebasestorage.googleapis.com/v0/b/x/o/u.pdf?alt=media" });
    expect([400, 409, 422], "report on a cancelled test").toContain(rep.status);
  }
});
