/* eslint-disable @typescript-eslint/no-explicit-any -- API replies are untyped JSON in these tests */
import { expect, test, type Page } from "@playwright/test";
import { REPORT_URL, newHospital, type RoleKey, type Tenant } from "./support/stack";

/**
 * With a hospital that has real activity in it — a patient with a visit, a prescription, lab and imaging results, a bill under
 * insurance, an admission, a signed consent, a dispense, a chart in the records room — open the screens that show those records,
 * as the role that uses them: they must open without a script error or a server error, and show the patient.
 */
test.describe.configure({ mode: "serial" });
let T: Tenant;
const S: Record<string, any> = {};

test.beforeAll(async ({ playwright }) => {
  T = await newHospital(playwright, "Screens");
  const a = T.users.admin;
  const p = (await a.post("/api/patients", { name: "Screen Patient", age: 44, gender: "Female", phone: "9833300001", payers: [{ type: "Insurance", name: "Star Health", policyNumber: "POL-9", contractId: T.contractId }] })).data;
  S.p = p;
  await a.post("/api/appointments", { patientId: p.id, patientName: p.name, doctorId: T.doctorId, date: T.tomorrow, time: "11:00 AM", type: "Booked", reason: "check-up" });
  S.opd = (await a.post("/api/opd", { patientId: p.id, patientName: p.name, doctorId: T.doctorId, reason: "cough" })).data;
  S.rx = (await T.users.doctor.post("/api/prescriptions", { patientId: p.id, patientName: p.name, doctorId: T.doctorId, doctor: "Dr. Asha Rao", diagnosis: "Bronchitis", status: "Pending", items: [{ medicineName: "Paracetamol 500mg", dosage: "500 mg", frequency: "TDS", duration: "5 days" }] })).data;
  const lab = (await T.users.doctor.post("/api/lab/orders", { patientId: p.id, patientName: p.name, doctorId: T.doctorId, tests: [{ testName: "CBC" }] })).data.tests[0];
  await T.users.lab.patch(`/api/lab/${lab.id}`, { sampleStatus: "Collected" });
  await T.users.lab.post(`/api/lab/${lab.id}/report`, { fileName: "cbc.pdf", fileUrl: REPORT_URL });
  const rad = (await T.users.doctor.post("/api/radiology/orders", { patientId: p.id, patientName: p.name, doctorId: T.doctorId, tests: [{ testName: "Chest X-Ray" }] })).data.tests[0];
  await T.users.lab.patch(`/api/radiology/${rad.id}`, { scanStatus: "Done" });
  await T.users.lab.post(`/api/radiology/${rad.id}/report`, { fileName: "cxr.pdf", fileUrl: REPORT_URL });
  const cat = (await T.users.billing.get(`/api/billing/catalog?patientId=${p.id}`)).data;
  S.bill = (await T.users.billing.post("/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", contractId: T.contractId, items: [{ serviceId: cat.services.find((s: any) => s.code === "PROC-DRS").id, quantity: 2 }] })).data;
  const stock = (await T.users.pharmacist.get("/api/pharmacy/dispense/stock")).data[0];
  await T.users.pharmacist.post("/api/pharmacy/dispense", { patientId: p.id, prescriptionId: S.rx.id, billing: "none", lines: [{ itemId: stock.itemId, quantity: 10 }] });
  S.adm = (await a.post("/api/ipd", { patientId: p.id, patientName: p.name, bedId: T.bedIds[0], doctorId: T.doctorId, diagnosis: "Bronchitis" })).data;
  await T.users.nurse.post("/api/ipd/nurse/vitals", { admissionId: S.adm.id, tempC: 37, pulse: 80, bpSystolic: 120, bpDiastolic: 80, spo2: 97, respRate: 16 });
  const diets = (await a.get("/api/dietary/diets")).data;
  await a.post("/api/dietary/orders", { admissionId: S.adm.id, dietTypeId: diets[0].id });
  const consent = (await T.users.nurse.post("/api/consents", { patientId: p.id, template: "general-consent", language: "English" })).data;
  S.consent = (await T.users.nurse.post(`/api/consents/${consent.id}/link`, { delivery: "qr" })).data;
  await T.users.doctor.post(`/api/ipd/${S.adm.id}/discharge`);
  S.file = (await T.users.mrd.post("/api/mrd/files", { patientId: p.id })).data;
  await T.users.admin.post("/api/waste/collections", { wardId: T.wardId, category: "red", quantityKg: 2.5, bags: 1 });
  await T.users.admin.post("/api/housekeeping/tasks", { location: "Reception", notes: "Spill" });
});
test.afterAll(async () => { await T?.dispose(); });

function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`script error: ${e.message.slice(0, 160)}`));
  page.on("response", (r) => { if (r.status() >= 500) problems.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
  return problems;
}

/** [role, route, text that must be on the screen] */
const SCREENS: [RoleKey, () => string, string | RegExp][] = [
  ["doctor", () => `/patients/${S.p.id}`, "Screen Patient"],
  ["doctor", () => `/prescriptions/${S.rx.id}`, "Bronchitis"],
  ["doctor", () => "/opd", "Screen Patient"],
  ["doctor", () => "/lab", "CBC"],
  ["doctor", () => "/radiology", "Chest X-Ray"],
  ["doctor", () => `/ipd/${S.adm.id}`, "Screen Patient"],
  ["doctor", () => "/my-schedule", /schedule/i],
  ["lab", () => "/lab", "Screen Patient"],
  ["lab", () => "/radiology", "Screen Patient"],
  ["billing", () => `/billing/${S.bill.id}`, "Screen Patient"],
  ["billing", () => "/billing", "Screen Patient"],
  ["billing", () => "/tpa", /TPA/],
  ["billing", () => "/finance", /Income|Expense/],
  ["billing", () => "/reports", "Day book"],
  ["pharmacist", () => "/pharmacy", "Paracetamol"],
  ["pharmacist", () => "/pharmacy/dispense", /Dispense/i],
  ["nurse", () => "/nurse-station", /Nurse station/],
  ["nurse", () => `/ipd/${S.adm.id}`, "Screen Patient"],
  ["nurse", () => "/ipd", /Discharged 1/],
  ["nurse", () => "/beds", "General Ward"],
  ["nurse", () => "/housekeeping", "Reception"],
  ["nurse", () => "/checklists", /Checklists/],
  ["nurse", () => "/dietary", /Dietary/],
  ["mrd", () => "/mrd", /MRD|coding/i],
  ["mrd", () => "/file-tracking", /File tracking|Files/i],
  ["mrd", () => "/documents", /Documents/],
  ["mrd", () => "/signatures", "Screen Patient"],
  ["reception", () => "/patients", "Screen Patient"],
  ["reception", () => "/appointments", "Screen Patient"],
  ["reception", () => "/enquiries", /Enquiries/],
  ["reception", () => "/followups", /Follow-ups/],
  ["admin", () => "/analytics", "Trends"],
  ["admin", () => "/audit", "Audit trail"],
  ["admin", () => "/waste", "Waste & infection control"],
  ["admin", () => "/ambulance", "Fleet board"],
  ["admin", () => "/admin", /Admin/],
  ["admin", () => "/settings", "Clinic profile"],
  ["admin", () => "/hospital-setup", "Hospital Setup"],
  ["admin", () => "/masters", "Masters"],
  ["admin", () => "/branches", /Branch/i],
  ["admin", () => "/plan", /Plan/],
  ["admin", () => "/whatsapp", /WhatsApp/],
  ["admin", () => "/hr", /HR/],
  ["admin", () => "/hr/leave", "Leave"],
  ["admin", () => "/hr/payroll", /Payroll/],
  ["admin", () => "/staff", "Staff directory"],
  ["admin", () => "/blood-bank", /Blood/],
  ["admin", () => "/cssd", /CSSD/],
  ["admin", () => "/ot", /OT|Operation/],
  ["admin", () => "/inventory", "Inventory"],
  ["admin", () => "/records", /Birth/],
  ["admin", () => "/training", "Training & tours"],
  ["admin", () => "/chat", "AI Chat"],
  ["admin", () => "/tasks", "Task Board"],
  ["admin", () => "/teleconsult", /Video|Consult/],
  ["admin", () => "/doctors", "Dr. Asha Rao"],
  ["hr", () => "/hr", /HR/],
  ["driver", () => "/home", /ambulance|Dispatch|Home/i],
  ["telecaller", () => "/enquiries", /Enquiries/],
  ["cssd", () => "/cssd", /CSSD/],
];

for (const [role, route, text] of SCREENS) {
  test(`${role} opens its screen and finds what it should (${route.toString().replace(/.*=> /, "")})`, async ({ browser }, info) => {
    const path = route();
    info.annotations.push({ type: "screen", description: path });
    const { context, page } = await T.users[role].browser(browser);
    const problems = watch(page);
    await page.goto(path);
    await page.waitForTimeout(700);
    await expect(page.locator("main"), `${path} as ${role}`).toContainText(text, { timeout: 45_000 });
    const body = await page.locator("main").innerText();
    expect(body, `${path} shows an error`).not.toMatch(/something went wrong|application error|cannot read properties|undefined is not/i);
    expect(problems, `${path} as ${role}`).toEqual([]);
    await context.close();
  });
}

test("a report opens from the catalogue, runs for the day and shows the bill", async ({ browser }) => {
  await T.users.billing.patch(`/api/billing/${S.bill.id}`, { status: "Paid", paymentMode: "Cash" });
  const { context, page } = await T.users.billing.browser(browser);
  const problems = watch(page);
  await page.goto("/reports");
  await page.locator("main").getByRole("button", { name: "Day book - OPD" }).click();
  await expect(page.locator("main").getByRole("heading", { name: "Day book - OPD" })).toBeVisible();
  await expect(page.locator("main").getByText(S.bill.billNumber)).toBeVisible();
  await expect(page.locator("main").getByRole("button", { name: /CSV/ })).toBeEnabled();
  expect(problems).toEqual([]);
  await context.close();
});

test("the audit screen verifies its chain for the administrator", async ({ browser }) => {
  const { context, page } = await T.users.admin.browser(browser);
  await page.goto("/audit");
  await expect(page.locator("main").getByText(/Chain verified on|tamper-evident chain/)).toBeVisible();
  await page.getByRole("button", { name: "Verify chain" }).click();
  await expect(page.locator("main").getByText(/unbroken|Changes made from now on/)).toBeVisible();
  await context.close();
});
