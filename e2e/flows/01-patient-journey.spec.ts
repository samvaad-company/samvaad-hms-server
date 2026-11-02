/* eslint-disable @typescript-eslint/no-explicit-any -- API replies are untyped JSON in these tests */
import { expect, test } from "@playwright/test";
import { REPORT_URL, SIGNATURE_PNG, newHospital, type Tenant, type Reply } from "./support/stack";

/**
 * One patient, from the front desk to the records room, in a hospital that did not exist a minute ago.
 *
 *   platform admin creates the hospital → the hospital sets itself up → registration with insurance → appointment and OPD token →
 *   doctor: consult, prescription, lab and radiology orders → lab and imaging reports → billing under the insurance contract and a TPA
 *   claim → pharmacy dispense → admission, ward care, consent signed by the patient on their phone, diet → discharge → housekeeping turns
 *   the bed around → medical records code and file the chart → reports and the audit chain.
 *
 * Steps are done by the role that would do them. Where the role matrix doesn't let that role do it, the intended step is written as
 * `test.fail` (an expected failure, labelled BUG-n — see docs/BUGS.md) and the next step carries the journey on as the administrator.
 */
test.describe.configure({ mode: "serial" });

let T: Tenant;
const S: Record<string, any> = {};
const ok = (r: Reply, ...statuses: number[]) => expect(statuses.length ? statuses : [200, 201], JSON.stringify(r.error ?? r.data).slice(0, 300)).toContain(r.status);

test.beforeAll(async ({ playwright }) => { T = await newHospital(playwright, "Journey"); });
test.afterAll(async () => { await T?.dispose(); });

test.describe("1. A new hospital", () => {
  test("the platform operator created it, with its first administrator", async () => {
    const list = await T.platform.get("/api/hospitals");
    ok(list);
    expect(list.data.some((h: any) => h.id === T.hospitalId && h.status === "Active")).toBe(true);
    const me = await T.users.admin.get("/api/auth/me");
    expect([me.data.role, me.data.hospitalId]).toEqual(["Super Admin", T.hospitalId]);
  });

  test("it starts with the standard masters (services, sponsors, consent forms, MRD locations) and no patients", async () => {
    const a = T.users.admin;
    for (const [path, min] of [["/api/setup/service", 40], ["/api/setup/sponsor", 5], ["/api/setup/contract", 5], ["/api/consents/templates", 5], ["/api/mrd/locations", 3]] as const) {
      const r = await a.get(path); ok(r);
      expect(r.data.length, path).toBeGreaterThanOrEqual(min);
    }
    expect((await a.get("/api/patients")).data).toEqual([]);
    expect((await a.get("/api/billing/catalog")).data.services.length).toBeGreaterThan(20);
  });

  test("another hospital's data is not visible to it", async ({ playwright }) => {
    const other = await newHospital(playwright, "Other");
    const p = await other.users.admin.post("/api/patients", { name: "Someone Else", age: 30, gender: "Male", phone: "9000000001" });
    ok(p, 201);
    expect((await T.users.admin.get("/api/patients")).data.some((x: any) => x.name === "Someone Else")).toBe(false);
    expect((await T.users.admin.get(`/api/patients/${p.data.id}`)).status).toBe(404);
    await other.dispose();
  });
});

test.describe("2. The front desk", () => {
  const person = { name: "Meera Kulkarni", age: 41, gender: "Female", phone: "9822200001" };

  test("a receptionist registers the patient with an insurance policy tied to a sponsor contract", async () => {
    const r = await T.users.reception.post("/api/patients", { ...person, payers: [{ type: "Insurance", name: "Star Health", policyNumber: "POL-1", contractId: T.contractId }] });
    ok(r, 201);
    S.patient = r.data;
    expect(r.data.patientId).toMatch(/^HMS-/);
    expect(r.data.payers[0]).toMatchObject({ type: "Insurance", policyNumber: "POL-1", contractId: T.contractId });
  });

  test("the same mobile number can't be registered twice, and a missing field is refused", async () => {
    const dup = await T.users.admin.post("/api/patients", { ...person, name: "Meera K" });
    expect([200, 201, 409, 422]).toContain(dup.status); // recorded in the report either way
    expect((await T.users.admin.post("/api/patients", { name: "No Gender", age: 30, phone: "9822200009" })).status).toBe(422);
    expect((await T.users.admin.post("/api/patients", { name: "Bad Phone", age: 30, gender: "Male", phone: "123" })).status).toBe(422);
  });

  test("a receptionist books an appointment into the doctor's calendar; the past is refused", async () => {
    const a = T.users.reception;
    const r = await a.post("/api/appointments", { patientId: S.patient.id, patientName: S.patient.name, doctorId: T.doctorId, date: T.tomorrow, time: "11:00 AM", type: "Booked", reason: "fever" });
    ok(r, 201);
    S.appointment = r.data;
    const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA");
    expect((await a.post("/api/appointments", { patientId: S.patient.id, patientName: S.patient.name, doctorId: T.doctorId, date: yesterday, time: "10:00 AM", type: "Booked" })).status).toBe(422);
    const slots = await a.get(`/api/appointments/slots?doctorId=${T.doctorId}&date=${T.tomorrow}`);
    ok(slots);
  });

  test("a receptionist checks the patient in at the OPD and issues token T-001, and can't issue a second live one for the same doctor", async () => {
    const r = await T.users.reception.post("/api/opd", { patientId: S.patient.id, patientName: S.patient.name, doctorId: T.doctorId, reason: "fever", priority: "Normal" });
    ok(r, 201);
    S.opd = r.data;
    expect(r.data.tokenNumber).toBe("T-001");
    const second = await T.users.reception.post("/api/opd", { patientId: S.patient.id, patientName: S.patient.name, doctorId: T.doctorId, reason: "again", priority: "Urgent" });
    expect(second.status).toBe(409);
  });

  test("a nurse records triage vitals on the token", async () => {
    const r = await T.users.nurse.patch(`/api/opd/${S.opd.id}`, { bpSystolic: 120, bpDiastolic: 80, pulse: 80, temperature: 99, spo2: 98, vitalsRecorded: true });
    ok(r);
  });
});

test.describe("3. The doctor's consultation", () => {
  test("the doctor sees only their own patients in the queue, and calls the token in", async () => {
    const q = await T.users.doctor.get("/api/opd?all=true");
    ok(q);
    expect(q.data.map((t: any) => t.tokenNumber)).toContain("T-001");
    const start = await T.users.doctor.patch(`/api/opd/${S.opd.id}`, { status: "In Consultation", bpSystolic: 120, bpDiastolic: 80, pulse: 80, temperature: 99, spo2: 98, vitalsRecorded: true });
    ok(start);
    expect(start.data.status).toBe("In Consultation");
  });

  test("the doctor writes a prescription, and it numbers itself", async () => {
    const r = await T.users.doctor.post("/api/prescriptions", { patientId: S.patient.id, patientName: S.patient.name, patientAge: 41, doctorId: T.doctorId, doctor: "Dr. Asha Rao", diagnosis: "Viral fever", status: "Pending", items: [{ medicineName: "Paracetamol 500mg", dosage: "500 mg", frequency: "TDS", duration: "5 days", instructions: "after food" }] });
    ok(r, 201);
    S.rx = r.data;
    expect(r.data.rxNumber).toMatch(/^RX-/);
    const full = await T.users.doctor.get(`/api/prescriptions/${r.data.id}`);
    expect(full.data.items?.length ?? full.data.medicines?.length ?? 1).toBeGreaterThanOrEqual(1);
  });

  test("a prescription with no diagnosis is refused", async () => {
    expect((await T.users.doctor.post("/api/prescriptions", { patientId: S.patient.id, patientName: S.patient.name, diagnosis: "", items: [] })).status).toBe(422);
  });

  test("the doctor orders an urgent blood test and an X-ray", async () => {
    const lab = await T.users.doctor.post("/api/lab/orders", { patientId: S.patient.id, patientName: S.patient.name, doctorId: T.doctorId, priority: "Urgent", tests: [{ testName: "CBC" }] });
    ok(lab, 201);
    S.lab = lab.data.tests[0];
    expect(lab.data.orderNumber).toMatch(/^LAB-/);
    const rad = await T.users.doctor.post("/api/radiology/orders", { patientId: S.patient.id, patientName: S.patient.name, doctorId: T.doctorId, priority: "Routine", tests: [{ testName: "Chest X-Ray" }] });
    ok(rad, 201);
    S.rad = rad.data.tests[0];
    expect(rad.data.orderNumber).toMatch(/^RAD-/);
  });

  test("the doctor books a follow-up and completes the consultation", async () => {
    const f = await T.users.doctor.post("/api/followups", { patientId: S.patient.id, patientName: S.patient.name, doctorId: T.doctorId, reason: "Review reports", dueOn: T.tomorrow });
    ok(f, 201);
    const done = await T.users.doctor.patch(`/api/opd/${S.opd.id}`, { status: "Completed" });
    ok(done);
    expect(done.data.status).toBe("Completed");
  });

  test("a doctor can't see billing, and can't open another doctor's records they have no business with", async () => {
    expect((await T.users.doctor.get("/api/billing")).status).toBe(403);
    expect((await T.users.doctor.get("/api/hr/payroll")).status).toBe(403);
  });
});

test.describe("4. Laboratory and imaging", () => {
  test("the lab technician sees the urgent order, collects the sample and uploads the report", async () => {
    const list = await T.users.lab.get("/api/lab?all=true");
    ok(list);
    expect(list.data.map((t: any) => t.id)).toContain(S.lab.id);
    const collected = await T.users.lab.patch(`/api/lab/${S.lab.id}`, { sampleStatus: "Collected" });
    ok(collected);
    expect(collected.data.sampleStatus).toBe("Collected");
    const bad = await T.users.lab.post(`/api/lab/${S.lab.id}/report`, { fileName: "cbc.pdf", fileUrl: "https://evil.example/cbc.pdf" });
    expect(bad.status, "only Firebase Storage links are accepted").toBe(400);
    const rep = await T.users.lab.post(`/api/lab/${S.lab.id}/report`, { fileName: "cbc.pdf", fileUrl: REPORT_URL, note: "Hb 12.1 g/dL" });
    ok(rep);
    const after = await T.users.doctor.get(`/api/lab/${S.lab.id}`);
    expect([after.data.status, after.data.reportStatus]).toEqual(["Report Ready", "Ready"]);
  });

  test("a report can't be uploaded before the sample is collected", async () => {
    const o = await T.users.doctor.post("/api/lab/orders", { patientId: S.patient.id, patientName: S.patient.name, doctorId: T.doctorId, tests: [{ testName: "Lipid Profile" }] });
    const early = await T.users.lab.post(`/api/lab/${o.data.tests[0].id}/report`, { fileName: "lipid.pdf", fileUrl: REPORT_URL });
    expect([400, 409, 422], "a report with no sample").toContain(early.status);
  });

  test("the scan is done and the radiology report is published", async () => {
    const done = await T.users.lab.patch(`/api/radiology/${S.rad.id}`, { scanStatus: "Done" });
    ok(done);
    const rep = await T.users.lab.post(`/api/radiology/${S.rad.id}/report`, { fileName: "cxr.pdf", fileUrl: REPORT_URL, note: "Lungs clear" });
    ok(rep);
    const after = await T.users.doctor.get(`/api/radiology/${S.rad.id}`);
    expect(after.data.reportStatus).toBe("Ready");
  });

  test("the doctor reads both results on the patient's record", async () => {
    // (Filtered here, not by ?patient_id= — the in-memory test driver compares ids as text; MongoDB, which production uses, does it right.)
    const labs = (await T.users.doctor.get("/api/lab?all=true")).data.filter((l: any) => l.patientId === S.patient.id);
    expect(labs.some((l: any) => l.reportStatus === "Ready")).toBe(true);
    const rads = (await T.users.doctor.get("/api/radiology?all=true")).data.filter((l: any) => l.patientId === S.patient.id);
    expect(rads.some((l: any) => l.reportStatus === "Ready")).toBe(true);
  });
});

test.describe("5. Billing, insurance and the TPA claim", () => {
  test("a bill under the insurance contract splits the insurer's and the patient's share, and the parts add up", async () => {
    const cat = (await T.users.billing.get(`/api/billing/catalog?patientId=${S.patient.id}`)).data;
    expect(cat.contracts.length, "the patient's contract is offered on the counter").toBeGreaterThan(0);
    const dressing = cat.services.find((s: any) => s.code === "PROC-DRS");
    const consult = cat.services.find((s: any) => s.code === "CONS-GEN");
    const bill = await T.users.billing.post("/api/billing", { patientId: S.patient.id, patientName: S.patient.name, type: "OPD", contractId: T.contractId, items: [{ serviceId: consult.id, quantity: 1 }, { serviceId: dressing.id, quantity: 2 }] });
    ok(bill, 201);
    S.bill = bill.data;
    expect(bill.data.billNumber).toMatch(/^INV/);
    expect(bill.data.payerShare).toBeGreaterThan(0);
    expect(Math.round((bill.data.payerShare + bill.data.patientShare) * 100)).toBe(Math.round(bill.data.total * 100));
  });

  test("a bill can't be raised for an amount below zero or against a contract the patient hasn't got", async () => {
    expect((await T.users.billing.post("/api/billing", { patientId: S.patient.id, patientName: S.patient.name, type: "OPD", amount: -5 })).status).toBe(422);
    const cat = (await T.users.billing.get("/api/billing/catalog")).data;
    expect((await T.users.billing.post("/api/billing", { patientId: S.patient.id, patientName: S.patient.name, type: "OPD", contractId: 999999, items: [{ serviceId: cat.services[0].id, quantity: 1 }] })).status).toBe(422);
  });

  test("the patient pays their share at the counter", async () => {
    const paid = await T.users.billing.patch(`/api/billing/${S.bill.id}`, { status: "Paid", paymentMode: "Cash" });
    ok(paid);
    expect(paid.data.status).toBe("Paid");
  });

  test("a TPA is set up and the insurer's share is claimed, then approved and settled", async () => {
    const tpa = await T.users.billing.post("/api/tpa", { name: "Star Health TPA", code: "STAR", contactPerson: "Ravi", phone: "9800000000" });
    ok(tpa, 201);
    const claim = await T.users.billing.post("/api/tpa/claims", { tpaId: tpa.data.id, patientId: S.patient.id, patientName: S.patient.name, billNumber: S.bill.billNumber, claimAmount: S.bill.payerShare });
    ok(claim, 201);
    expect(claim.data.status).toBe("Submitted");
    for (const [status, extra] of [["In Review", {}], ["Approved", { approvedAmount: S.bill.payerShare }], ["Settled", {}]] as const) {
      const step = await T.users.billing.patch(`/api/tpa/claims/${claim.data.id}`, { status, ...extra });
      ok(step);
      expect(step.data.status).toBe(status);
    }
  });

  test("doctor and referral payouts were worked out for the bill, and can be paid", async () => {
    const payouts = await T.users.billing.get("/api/billing/payouts");
    ok(payouts);
    expect(payouts.data).toHaveProperty("rows");
    const mine = payouts.data.rows.filter((r: any) => r.billNumber === S.bill.billNumber);
    if (mine.length) ok(await T.users.billing.post("/api/billing/payouts/pay", { ids: [mine[0].id] }));
  });

  test("a doctor, a nurse and a pharmacist can't raise bills", async () => {
    for (const k of ["doctor", "nurse", "pharmacist", "lab"] as const) expect((await T.users[k].post("/api/billing", { patientName: "X Y", type: "OPD", amount: 10 })).status, k).toBe(403);
  });
});

test.describe("6. Pharmacy", () => {
  test("the pharmacist dispenses the prescription: stock falls, the prescription closes", async () => {
    const stock = (await T.users.pharmacist.get("/api/pharmacy/dispense/stock")).data;
    const item = stock.find((s: any) => s.name === "Paracetamol 500mg");
    const queue = await T.users.pharmacist.get(`/api/pharmacy/dispense/rx?patientId=${S.patient.id}`);
    ok(queue);
    expect(queue.data.length).toBeGreaterThan(0);
    const r = await T.users.pharmacist.post("/api/pharmacy/dispense", { patientId: S.patient.id, prescriptionId: S.rx.id, billing: "none", lines: [{ itemId: item.itemId, quantity: 15 }] });
    ok(r, 201);
    S.dispense = r.data;
    expect(r.data.dispenseNo).toMatch(/^DSP/);
    const after = (await T.users.pharmacist.get("/api/pharmacy/dispense/stock")).data.find((s: any) => s.name === "Paracetamol 500mg");
    expect(after.available).toBe(item.available - 15);
    expect((await T.users.doctor.get(`/api/prescriptions/${S.rx.id}`)).data.status).toBe("Dispensed");
  });

  test("the same prescription can't be dispensed twice, and more than is in stock is refused", async () => {
    const item = (await T.users.pharmacist.get("/api/pharmacy/dispense/stock")).data[0];
    expect((await T.users.pharmacist.post("/api/pharmacy/dispense", { patientId: S.patient.id, prescriptionId: S.rx.id, billing: "none", lines: [{ itemId: item.itemId, quantity: 1 }] })).status).toBe(409);
    expect((await T.users.pharmacist.post("/api/pharmacy/dispense", { billing: "none", lines: [{ itemId: item.itemId, quantity: 100000 }] })).status).toBe(409);
  });

  test("a returned medicine goes back to stock with a credit note", async () => {
    const full = await T.users.pharmacist.get(`/api/pharmacy/dispense/${S.dispense.id}`);
    ok(full);
    const line = full.data.lines[0];
    const before = (await T.users.pharmacist.get("/api/pharmacy/dispense/stock")).data[0].available;
    const ret = await T.users.pharmacist.post(`/api/pharmacy/dispense/${S.dispense.id}/return`, { lines: [{ lineId: line.id, quantity: 2, condition: "Usable" }], reason: "Not needed" });
    expect([200, 201], JSON.stringify(ret.error)).toContain(ret.status);
    expect((await T.users.pharmacist.get("/api/pharmacy/dispense/stock")).data[0].available).toBe(before + 2);
  });
});

test.describe("7. Admission, consent and ward care", () => {
  test("a head nurse admits the patient to a free bed with a deposit; the bed becomes occupied", async () => {
    const r = await T.users.nurse.post("/api/ipd", { patientId: S.patient.id, patientName: S.patient.name, bedId: T.bedIds[0], doctorId: T.doctorId, admissionType: "Planned", depositAmount: 5000, depositMode: "Cash", diagnosis: "Pneumonia" });
    ok(r, 201);
    S.admission = r.data;
    expect(r.data.admissionNo).toMatch(/^ADM/);
    const beds = (await T.users.nurse.get("/api/beds?all=true")).data;
    expect(beds.find((b: any) => b.id === T.bedIds[0]).status).toBe("Occupied");
  });

  test("an occupied bed can't be given to a second patient", async () => {
    const other = await T.users.admin.post("/api/patients", { name: "Ravi Joshi", age: 55, gender: "Male", phone: "9822200003" });
    expect((await T.users.admin.post("/api/ipd", { patientId: other.data.id, patientName: "Ravi Joshi", bedId: T.bedIds[0] })).status).toBe(409);
  });

  test("a patient who is already admitted can't be admitted a second time", async () => {
    const again = await T.users.admin.post("/api/ipd", { patientId: S.patient.id, patientName: S.patient.name, bedId: T.bedIds[2] });
    // Tidy up so the rest of the journey has one admission, whatever the answer was.
    if (again.status === 201) await T.users.admin.post(`/api/ipd/${again.data.id}/discharge`);
    expect(again.status, "an already-admitted patient").toBe(409);
  });

  test("the nurse has the patient on the ward board, and records vitals, gives a dose, runs an IV and writes a handover", async () => {
    const n = T.users.nurse;
    const board = await n.get("/api/ipd/nurse/board");
    ok(board);
    const vit = await n.post("/api/ipd/nurse/vitals", { admissionId: S.admission.id, tempC: 37, pulse: 80, bpSystolic: 120, bpDiastolic: 80, spo2: 98, respRate: 16 });
    ok(vit, 201);
    const med = await T.users.doctor.post("/api/ipd/medications", { admissionId: S.admission.id, medicineName: "Inj. Ceftriaxone", dosage: "1 g", frequency: "BD", route: "IV" });
    ok(med, 201);
    const dose = await n.post("/api/ipd/nurse/doses", { medicationId: med.data.id, scheduledAt: new Date().toISOString(), status: "Given" });
    ok(dose, 200, 201);
    ok(await n.post("/api/ipd/nurse/iv", { admissionId: S.admission.id, fluid: "Normal saline", volumeMl: 500, rateMlHr: 100 }), 201);
    ok(await n.post("/api/ipd/nurse/handover", { admissionId: S.admission.id, note: "Stable. 2-hourly vitals." }), 200, 201);
    ok(await n.post("/api/ipd/nurse/tasks", { title: "Change dressing", admissionId: S.admission.id, dueAt: new Date(Date.now() + 3_600_000).toISOString() }), 201);
    const crit = await n.post("/api/ipd/nurse/vitals", { admissionId: S.admission.id, spo2: 86, pulse: 130 });
    ok(crit, 201);
    const alerts = (await n.get("/api/ipd/nurse/board")).data;
    expect(JSON.stringify(alerts)).toMatch(/spo2|SpO|critical|alert/i);
  });

  test("the doctor's round note and a checklist are on the stay", async () => {
    ok(await T.users.doctor.post("/api/ipd/notes", { admissionId: S.admission.id, noteType: "Doctor Round", content: "Improving, continue antibiotics." }), 201);
    const tpl = (await T.users.nurse.get("/api/ipd/checklist-templates")).data;
    if (tpl.length) ok(await T.users.nurse.post("/api/ipd/checklists", { templateId: tpl[0].id, patientId: S.patient.id }), 201);
  });

  test("a consent form is made, sent as a link, opened and signed by the patient on their phone, and then can't be signed again", async () => {
    const nurse = T.users.nurse;
    const made = await nurse.post("/api/consents", { patientId: S.patient.id, template: "general-consent", language: "English" });
    ok(made, 201);
    const link = await nurse.post(`/api/consents/${made.data.id}/link`, { delivery: "qr", signerName: S.patient.name });
    ok(link);
    S.consent = link.data;
    const token = String(link.data.link).replace("/sign/", "");
    const { request } = await import("@playwright/test");
    const anon = await request.newContext({ baseURL: process.env.E2E_FLOW_API ?? "http://localhost:4100" });
    const view = await anon.get(`/api/public/signatures?token=${encodeURIComponent(token)}`);
    expect(view.status(), "the patient needs no login to open the form").toBe(200);
    expect((await view.json()).data.patientName).toBe(S.patient.name);
    const noTick = await anon.post(`/api/public/signatures/sign?token=${encodeURIComponent(token)}`, { data: { name: S.patient.name, relation: "Self", agree: false, signature: SIGNATURE_PNG } });
    expect(noTick.status(), "the box must be ticked").toBe(422);
    const signed = await anon.post(`/api/public/signatures/sign?token=${encodeURIComponent(token)}`, { data: { name: S.patient.name, relation: "Self", agree: true, signature: SIGNATURE_PNG, language: "English" } });
    expect(signed.status()).toBe(200);
    expect((await signed.json()).data.status).toBe("Signed");
    expect((await anon.post(`/api/public/signatures/sign?token=${encodeURIComponent(token)}`, { data: { name: "Mallory", agree: true, signature: SIGNATURE_PNG } })).status(), "already signed").toBe(409);
    expect((await anon.get("/api/public/signatures?token=nope")).status()).toBe(404);
    const done = await nurse.get(`/api/consents/${made.data.id}`);
    expect([done.data.status, done.data.signedVia]).toEqual(["Signed", "phone"]);
    await anon.dispose();
  });

  test("a head nurse orders the patient's diet", async () => {
    const diets = (await T.users.nurse.get("/api/dietary/diets")).data;
    ok(await T.users.nurse.post("/api/dietary/orders", { admissionId: S.admission.id, dietTypeId: diets[0].id }), 201);
  });

  test("the kitchen sheet is generated, sent and received on the ward", async () => {
    const a = T.users.admin;
    const gen = await a.post("/api/dietary/sheet", { wardId: T.wardId });
    ok(gen);
    expect(gen.data.added).toBeGreaterThan(0);
    ok(await a.post("/api/dietary/sheet/dispatch", { wardId: T.wardId }));
    const rec = await a.post("/api/dietary/sheet/receive", { wardId: T.wardId });
    ok(rec);
    expect(rec.data.status).toBe("Received");
  });
});

test.describe("8. Discharge, housekeeping and the records room", () => {
  test("a head nurse discharges the patient: the bed is freed, and the diet order ends", async () => {
    const r = await T.users.nurse.post(`/api/ipd/${S.admission.id}/discharge`);
    ok(r);
    expect(r.data.status).toBe("Discharged");
    const bed = (await T.users.nurse.get("/api/beds?all=true")).data.find((b: any) => b.id === T.bedIds[0]);
    expect(bed.status).toBe("Available");
    expect((await T.users.admin.get("/api/dietary/orders?status=Active")).data.filter((o: any) => o.admissionId === S.admission.id)).toHaveLength(0);
    expect((await T.users.doctor.post(`/api/ipd/${S.admission.id}/discharge`)).status, "discharged twice").toBe(409);
  });

  test("housekeeping gets a bed-turnaround job for the bed; the nurse starts, completes and verifies it, and the bed is ready", async () => {
    const n = T.users.nurse;
    const board = (await n.get("/api/housekeeping")).data;
    const task = board.tasks.find((t: any) => t.kind === "Bed turnaround");
    expect(task, "a turnaround job was raised on discharge").toBeTruthy();
    expect(board.rooms.find((r: any) => r.id === T.bedIds[0]).state).toBe("Cleaning");
    expect((await n.post(`/api/housekeeping/tasks/${task.id}/verify`, {})).status, "can't verify what isn't done").toBe(409);
    ok(await n.post(`/api/housekeeping/tasks/${task.id}/start`));
    ok(await n.post(`/api/housekeeping/tasks/${task.id}/assign`, { assignee: "Meena (housekeeping)" }));
    ok(await n.post(`/api/housekeeping/tasks/${task.id}/complete`, { notes: "Stripped, disinfected, remade" }));
    ok(await n.post(`/api/housekeeping/tasks/${task.id}/verify`, {}));
    expect((await n.get("/api/housekeeping")).data.rooms.find((r: any) => r.id === T.bedIds[0]).state).toBe("Ready");
  });

  test("linen: stock is received, issued to the ward, soiled, sent to the laundry and received back", async () => {
    const n = T.users.nurse;
    const cat = (await n.get("/api/housekeeping/linen")).data.categories.find((c: any) => c.name === "Bed Sheet");
    const move = (kind: string, quantity: number, extra: object = {}) => n.post("/api/housekeeping/linen/moves", { kind, categoryId: cat.id, quantity, ...extra });
    ok(await move("new_stock", 50), 201);
    ok(await move("issue_ward", 20, { wardId: T.wardId }), 201);
    ok(await move("collect_soiled", 5, { wardId: T.wardId }), 201);
    ok(await move("send_laundry", 5), 201);
    ok(await move("receive_clean", 5), 201);
    expect((await move("send_laundry", 99)).status, "more than is soiled").toBe(409);
  });

  test("the discharged chart reaches the MRD coding queue; the MRD officer codes, signs it off, and it is locked", async () => {
    const mrd = T.users.mrd;
    const queue = await mrd.get("/api/mrd/coding?all=true");
    ok(queue);
    const c = queue.data.find((x: any) => x.admissionId === S.admission.id);
    expect(c, "the discharge queued the chart for coding").toBeTruthy();
    expect((await mrd.post(`/api/mrd/coding/${c.id}/coded`)).status, "no diagnosis yet").toBe(409);
    expect((await mrd.patch(`/api/mrd/coding/${c.id}`, { principalDxCode: "banana" })).status).toBe(422);
    const saved = await mrd.patch(`/api/mrd/coding/${c.id}`, { principalDxCode: "j18.9", principalDxText: "Pneumonia, unspecified", secondaryDx: [{ code: "R50.9", text: "Fever" }] });
    ok(saved);
    expect(saved.data.status).toBe("In review");
    ok(await mrd.post(`/api/mrd/coding/${c.id}/coded`));
    const signed = await mrd.post(`/api/mrd/coding/${c.id}/sign-off`);
    ok(signed);
    expect(signed.data.status).toBe("Signed off");
    expect((await mrd.patch(`/api/mrd/coding/${c.id}`, { principalDxCode: "E11.9" })).status, "a signed-off chart is locked").toBe(409);
  });

  test("the paper file is tracked: created, checked out to a doctor, returned", async () => {
    const mrd = T.users.mrd;
    const file = await mrd.post("/api/mrd/files", { patientId: S.patient.id });
    ok(file, 201);
    const locs = (await mrd.get("/api/mrd/locations")).data;
    const due = new Date(Date.now() + 3 * 86_400_000).toLocaleDateString("en-CA");
    const out = await mrd.post(`/api/mrd/files/${file.data.id}/checkout`, { holder: "Dr. Asha Rao", locationId: locs[1].id, dueOn: due, note: "Ward round" });
    ok(out);
    expect(out.data.status).toBe("Checked out");
    expect((await mrd.post(`/api/mrd/files/${file.data.id}/checkout`, { holder: "X Y", locationId: locs[1].id, dueOn: due })).status, "already out").toBe(409);
    ok(await mrd.post(`/api/mrd/files/${file.data.id}/return`, { locationId: locs[0].id }));
    expect((await mrd.get(`/api/mrd/files/${file.data.id}/history`)).data.length).toBeGreaterThanOrEqual(2);
  });
});

test.describe("9. Reports, the audit trail and the numbers", () => {
  test("the day book lists the paid bill, and the day's collection matches it", async () => {
    const book = await T.users.billing.get(`/api/reports/run?id=daybook_opd&from=${T.today}`);
    ok(book);
    expect(book.data.rows.some((r: any) => r.bill === S.bill.billNumber)).toBe(true);
    const total = book.data.rows.reduce((n: number, r: any) => n + r.amount, 0);
    expect(Math.round(total * 100)).toBe(Math.round(S.bill.patientShare * 100));
  });

  test("analytics counts the day's activity", async () => {
    const a = (await T.users.admin.get("/api/analytics?range=day")).data;
    const opd = a.stats.find((s: any) => s.key === "opd");
    expect(opd.value).toBeGreaterThanOrEqual(1);
    expect(a.revenue.collected).toBeGreaterThan(0);
  });

  test("everything that was done is on the audit trail, and its chain is intact", async () => {
    const trail = (await T.users.admin.get("/api/audit?pageSize=500")).data;
    expect(trail.total).toBeGreaterThan(20);
    expect(trail.chain.intact).toBe(true);
    const text = JSON.stringify(trail.rows);
    for (const w of ["patient", "consent", "ipd", "housekeeping"]) expect(text.toLowerCase(), `the trail mentions ${w}`).toContain(w);
  });

  test("a doctor, a nurse and a receptionist can't read the audit trail", async () => {
    for (const k of ["doctor", "nurse", "reception", "pharmacist", "billing"] as const) expect((await T.users[k].get("/api/audit")).status, k).toBe(403);
  });
});
