/* eslint-disable @typescript-eslint/no-explicit-any -- API replies are untyped JSON in these tests */
import { expect, test } from "@playwright/test";
import { newHospital, type Tenant } from "./support/stack";

/**
 * A busy morning: many people press the same button at the same moment. Nothing may be given out twice, nothing may go below zero,
 * and numbers that must be unique (tokens, invoices, admissions, UHIDs) must stay unique.
 */
test.describe.configure({ mode: "serial" });
let T: Tenant;
test.beforeAll(async ({ playwright }) => { T = await newHospital(playwright, "Rush"); });
test.afterAll(async () => { await T?.dispose(); });
const people = async (n: number) => Promise.all(Array.from({ length: n }, (_, i) => T.users.admin.post("/api/patients", { name: `Rush Patient ${i + 1}`, age: 20 + i, gender: i % 2 ? "Male" : "Female", phone: `98${String(30000000 + i).slice(-8)}` })));

test("20 patients registered at the same instant all get different patient IDs", async () => {
  const rs = await people(20);
  expect(rs.every((r) => r.status === 201), JSON.stringify(rs.filter((r) => r.status !== 201).map((r) => r.error))).toBe(true);
  const ids = rs.map((r) => r.data.patientId);
  expect(new Set(ids).size, `duplicate UHIDs among ${ids.join(",")}`).toBe(20);
});

test("20 patients checked in at once get 20 different tokens", async () => {
  const list = (await T.users.admin.get("/api/patients?all=true")).data;
  const rs = await Promise.all(list.slice(0, 20).map((p: any) => T.users.admin.post("/api/opd", { patientId: p.id, patientName: p.name, doctorId: T.doctorId })));
  expect(rs.every((r) => r.status === 201)).toBe(true);
  const tokens = rs.map((r) => r.data.tokenNumber);
  expect(new Set(tokens).size, `duplicate tokens: ${tokens.join(",")}`).toBe(20);
});

test("10 bills raised at once get 10 different invoice numbers, and the totals are right", async () => {
  const p = (await T.users.admin.get("/api/patients?all=true")).data[0];
  const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => T.users.billing.post("/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", amount: 100 + i })));
  expect(rs.every((r) => r.status === 201), JSON.stringify(rs.filter((r) => r.status !== 201).map((r) => r.error))).toBe(true);
  const nos = rs.map((r) => r.data.billNumber);
  expect(new Set(nos).size, `duplicate invoice numbers: ${nos.join(",")}`).toBe(10);
});

test("five people try to take the same bed at once: exactly one gets it", async () => {
  const pts = (await T.users.admin.get("/api/patients?all=true")).data.slice(0, 5);
  const rs = await Promise.all(pts.map((p: any) => T.users.admin.post("/api/ipd", { patientId: p.id, patientName: p.name, bedId: T.bedIds[0] })));
  const won = rs.filter((r) => r.status === 201);
  expect(won.length, `statuses: ${rs.map((r) => r.status).join(",")}`).toBe(1);
  const occupied = (await T.users.admin.get("/api/beds?all=true")).data.filter((b: any) => b.id === T.bedIds[0] && b.status === "Occupied");
  expect(occupied).toHaveLength(1);
});

test("a patient admitted by two clerks at the same instant is admitted once", async () => {
  const p = (await T.users.admin.get("/api/patients?all=true")).data[10];
  const rs = await Promise.all([T.bedIds[1], T.bedIds[2]].map((bedId) => T.users.admin.post("/api/ipd", { patientId: p.id, patientName: p.name, bedId })));
  expect(rs.filter((r) => r.status === 201).length).toBe(1);
});

test("30 people each ask for 10 of the 200 tablets in stock: stock never goes below zero, and nobody gets what isn't there", async () => {
  const item = (await T.users.pharmacist.get("/api/pharmacy/dispense/stock")).data[0];
  const rs = await Promise.all(Array.from({ length: 30 }, () => T.users.pharmacist.post("/api/pharmacy/dispense", { billing: "none", lines: [{ itemId: item.itemId, quantity: 10 }] })));
  const filled = rs.filter((r) => r.status === 201).length;
  // An item with nothing left drops off the dispensing list, so no row means zero.
  const after = (await T.users.pharmacist.get("/api/pharmacy/dispense/stock")).data.find((s: any) => s.itemId === item.itemId)?.available ?? 0;
  expect(filled * 10 + after, "everything dispensed plus what's left is what there was").toBe(item.available);
  expect(after).toBeGreaterThanOrEqual(0);
  expect(filled).toBe(20);
  expect(rs.filter((r) => r.status === 409).length).toBe(10);
});

test("a prescription dispensed by two pharmacists at once is dispensed once", async () => {
  const p = (await T.users.admin.get("/api/patients?all=true")).data[3];
  const item = (await T.users.pharmacist.get("/api/pharmacy/dispense/stock")).data[0];
  await T.users.admin.post("/api/pharmacy", { name: "Amoxicillin 500", category: "Antibiotic", stock: 100, minStock: 5, expiryDate: "2028-12-31", supplier: "Cipla" });
  const rx = (await T.users.doctor.post("/api/prescriptions", { patientId: p.id, patientName: p.name, doctorId: T.doctorId, diagnosis: "Infection", status: "Pending", items: [{ medicineName: "Amoxicillin 500", dosage: "500 mg", frequency: "TDS", duration: "5 days" }] })).data;
  const stock = (await T.users.pharmacist.get("/api/pharmacy/dispense/stock")).data.find((s: any) => s.name === "Amoxicillin 500");
  const rs = await Promise.all([1, 2, 3].map(() => T.users.pharmacist.post("/api/pharmacy/dispense", { patientId: p.id, prescriptionId: rx.id, billing: "none", lines: [{ itemId: stock.itemId, quantity: 5 }] })));
  expect(rs.filter((r) => r.status === 201).length, `statuses ${rs.map((r) => r.status)}`).toBe(1);
  void item;
});

test("a bill paid by two cashiers at once is paid once (one payment recorded)", async () => {
  const p = (await T.users.admin.get("/api/patients?all=true")).data[0];
  const b = (await T.users.billing.post("/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", amount: 300 })).data;
  const rs = await Promise.all([1, 2, 3].map(() => T.users.billing.patch(`/api/billing/${b.id}`, { status: "Paid", paymentMode: "Cash" })));
  expect(rs.every((r) => r.status === 200 || r.status === 409), `statuses ${rs.map((r) => r.status)}`).toBe(true);
  const day = (await T.users.admin.get(`/api/reports/run?id=daybook_opd&from=${T.today}`)).data.rows.filter((r: any) => r.bill === b.billNumber);
  expect(day).toHaveLength(1);
});

test("50 requests for the same list return the same answer, none of them an error", async () => {
  const rs = await Promise.all(Array.from({ length: 50 }, () => T.users.admin.get("/api/patients?all=true")));
  expect(rs.every((r) => r.status === 200)).toBe(true);
  expect(new Set(rs.map((r) => r.data.length)).size).toBe(1);
});

test("two housekeeping staff starting the same job at once: one wins, the other is told it's already started", async () => {
  const adm = (await T.users.admin.get("/api/ipd?all=true")).data.find((a: any) => a.status !== "Discharged");
  await T.users.doctor.post(`/api/ipd/${adm.id}/discharge`);
  const task = (await T.users.nurse.get("/api/housekeeping")).data.tasks.find((t: any) => t.kind === "Bed turnaround");
  const rs = await Promise.all([1, 2, 3].map(() => T.users.nurse.post(`/api/housekeeping/tasks/${task.id}/start`)));
  expect(rs.filter((r) => r.status === 200).length, `statuses ${rs.map((r) => r.status)}`).toBe(1);
});

test("a linen store with 10 sheets can't be issued 10 sheets twice at once", async () => {
  const n = T.users.nurse;
  const cat = (await n.get("/api/housekeeping/linen")).data.categories.find((c: any) => c.name === "Towel");
  await n.post("/api/housekeeping/linen/moves", { kind: "new_stock", categoryId: cat.id, quantity: 10 });
  const rs = await Promise.all([1, 2].map(() => n.post("/api/housekeeping/linen/moves", { kind: "issue_ward", categoryId: cat.id, quantity: 10, wardId: T.wardId })));
  expect(rs.filter((r) => r.status === 201).length).toBe(1);
  const after = (await n.get("/api/housekeeping/linen")).data.categories.find((c: any) => c.name === "Towel");
  expect(after.store).toBe(0);
});
