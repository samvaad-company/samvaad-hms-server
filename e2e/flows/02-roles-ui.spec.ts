/* eslint-disable @typescript-eslint/no-explicit-any -- API replies are untyped JSON in these tests */
import { expect, test, type Page } from "@playwright/test";
import { ROLES, anonymousPage, newHospital, type RoleKey, type Tenant } from "./support/stack";

/**
 * Every role, in a real browser, in a brand-new hospital: what it sees in the sidebar, whether each screen opens without errors,
 * whether the screens offer exactly the buttons the role is allowed to use, and a few things done through the screens themselves
 * (registering a patient, a patient signing a consent form on their phone, housekeeping turning a bed around).
 */
let T: Tenant;
test.beforeAll(async ({ playwright }) => { T = await newHospital(playwright, "Roles"); });
test.afterAll(async () => { await T?.dispose(); });

/** Fails the test when a screen throws or the API answers 5xx while it is open. */
function watch(page: Page): { problems: string[] } {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`script error: ${e.message.slice(0, 160)}`));
  page.on("response", (r) => { if (r.status() >= 500) problems.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
  return { problems };
}

const sidebarLinks = async (page: Page): Promise<string[]> =>
  page.evaluate(() => [...document.querySelectorAll<HTMLAnchorElement>("aside a[href^='/']")].map((a) => a.getAttribute("href")!).filter((h, i, all) => all.indexOf(h) === i));

test.describe("each role's navigation", () => {
  for (const key of Object.keys(ROLES) as RoleKey[]) {
    test(`${ROLES[key]}: lands on Home, sees a sidebar of its own, and every item in it opens without an error`, async ({ browser }) => {
      test.setTimeout(240_000);
      const { context, page } = await T.users[key].browser(browser);
      const w = watch(page);
      await page.goto("/home");
      await expect(page.locator("aside")).toBeVisible();
      const links = (await sidebarLinks(page)).filter((h) => !h.startsWith("/attendance-kiosk"));
      expect(links.length, "a sidebar with something in it").toBeGreaterThan(1);
      // The "Training" lesson list is offered to everyone; nothing the role can't use is in the sidebar.
      expect(links).toContain("/training");
      const me = (await T.users[key].get("/api/auth/me")).data;
      for (const href of links) {
        await page.goto(href);
        await page.waitForTimeout(500);
        await expect(page.locator("main"), `${href} as ${ROLES[key]}`).toBeVisible();
        const body = (await page.locator("main").innerText()).slice(0, 4000);
        expect(body, `${href} shouldn't show an error to ${ROLES[key]}`).not.toMatch(/something went wrong|application error|unhandled|cannot read properties/i);
      }
      expect(w.problems, `errors while ${ROLES[key]} used the app`).toEqual([]);
      expect(me.role).toBe(ROLES[key]);
      await context.close();
    });
  }
});

// A button a screen shows is a promise: if the role can't do it, the screen shouldn't offer it. The permission is read from the
// session, so this follows the role matrix whatever it is.
const BUTTONS: { route: string; text: string; resource: string }[] = [
  { route: "/patients", text: "New patient", resource: "patients" },
  { route: "/opd", text: "New Check-in", resource: "opd" },
  { route: "/appointments", text: "New Appointment", resource: "appointments" },
  { route: "/ipd", text: "Admit patient", resource: "ipd" },
  { route: "/billing", text: "New Bill", resource: "billing" },
  { route: "/lab", text: "Order Test", resource: "lab" },
  { route: "/prescriptions", text: "New Prescription", resource: "prescriptions" },
  { route: "/pharmacy", text: "Add Item", resource: "pharmacy" },
  { route: "/staff", text: "Add Staff", resource: "staff" },
  { route: "/tasks", text: "New Task", resource: "tasks" },
  { route: "/enquiries", text: "New enquiry", resource: "enquiries" },
];

test.describe("buttons follow permissions", () => {
  for (const key of ["reception", "nurse", "doctor", "billing", "pharmacist", "lab", "mrd", "hr", "telecaller"] as RoleKey[]) {
    test(`${ROLES[key]}: a screen offers a create button only where the role may write`, async ({ browser }) => {
      test.setTimeout(240_000);
      const { context, page } = await T.users[key].browser(browser);
      const perms = (await T.users[key].get("/api/auth/me")).data.permissions as Record<string, string>;
      const mismatches: string[] = [];
      for (const b of BUTTONS) {
        if (!["read", "write"].includes(perms[b.resource])) continue; // the screen isn't theirs at all
        await page.goto(b.route);
        await page.waitForTimeout(900);
        const shown = (await page.locator("main").getByRole("button", { name: new RegExp(`^${b.text}`) }).count()) + (await page.locator("main").getByRole("link", { name: new RegExp(`^${b.text}`) }).count()) > 0;
        const may = perms[b.resource] === "write";
        if (shown && !may) mismatches.push(`${b.route}: shows "${b.text}" but the role only has ${b.resource}:${perms[b.resource]}`);
        if (!shown && may) mismatches.push(`${b.route}: doesn't show "${b.text}" though the role may ${b.resource}:write`);
      }
      expect(mismatches, `${ROLES[key]}`).toEqual([]);
      await context.close();
    });
  }
});

test.describe("things done through the screens", () => {
  test("the administrator registers a patient with the registration form, and finds them in the list", async ({ browser }) => {
    const { context, page } = await T.users.admin.browser(browser);
    const w = watch(page);
    await page.goto("/patients/new");
    await page.getByPlaceholder("e.g. Asha Patel").fill("Form Patient");
    await page.locator("button, [role=radio]").filter({ hasText: /^Female/ }).first().click();
    await page.getByPlaceholder("10-digit number").fill("9822200055");
    await page.getByPlaceholder("Years").fill("33");
    await page.getByRole("button", { name: /^Register patient/ }).click();
    await expect(page).toHaveURL(/\/patients(\/\d+)?(\?|$)/, { timeout: 15_000 });
    const found = (await T.users.admin.get("/api/patients?search=Form Patient")).data;
    expect(found.some((p: any) => p.name === "Form Patient" && p.phone === "9822200055")).toBe(true);
    await page.goto("/patients");
    await page.getByPlaceholder(/Search name/).fill("Form Patient");
    await expect(page.locator("main").getByText("Form Patient").first()).toBeVisible();
    expect(w.problems).toEqual([]);
    await context.close();
  });

  test("the registration form refuses a missing name or a bad mobile number", async ({ browser }) => {
    const { context, page } = await T.users.admin.browser(browser);
    await page.goto("/patients/new");
    await page.getByRole("button", { name: /^Register patient/ }).click();
    await expect(page).toHaveURL(/\/patients\/new/);
    await page.getByPlaceholder("e.g. Asha Patel").fill("Bad Mobile");
    await page.locator("button, [role=radio]").filter({ hasText: /^Male/ }).first().click();
    await page.getByPlaceholder("10-digit number").fill("12345");
    await page.getByRole("button", { name: /^Register patient/ }).click();
    await expect(page).toHaveURL(/\/patients\/new/);
    expect((await T.users.admin.get("/api/patients?search=Bad Mobile")).data.length).toBe(0);
    await context.close();
  });

  test("a patient opens the consent link on a phone, reads it, ticks the box, signs with a finger and is told it's done", async ({ browser }) => {
    const nurse = T.users.nurse;
    const p = (await T.users.admin.post("/api/patients", { name: "Sign Patient", age: 60, gender: "Male", phone: "9822200066" })).data;
    const made = (await nurse.post("/api/consents", { patientId: p.id, template: "general-consent", language: "English" })).data;
    const link = (await nurse.post(`/api/consents/${made.id}/link`, { delivery: "qr", signerName: "Sign Patient" })).data;
    const { context, page } = await anonymousPage(browser);
    const w = watch(page);
    await page.goto(link.link);
    await expect(page.getByText("General consent").first()).toBeVisible();
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 60, { steps: 8 });
    await page.mouse.move(box.x + 60, box.y + 20, { steps: 8 });
    await page.mouse.up();
    const name = page.getByRole("textbox").first();
    if (await name.isVisible()) await name.fill("Sign Patient");
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: "Sign and send to the hospital" }).click();
    await expect(page.getByText(/signed|thank you|done/i).first()).toBeVisible({ timeout: 15_000 });
    expect((await nurse.get(`/api/consents/${made.id}`)).data.status).toBe("Signed");
    expect(w.problems).toEqual([]);
    await context.close();
  });

  test("housekeeping: after a discharge the nurse starts, completes and verifies the bed's cleaning on the board, and the bed turns Ready", async ({ browser }) => {
    const a = T.users.admin;
    const p = (await a.post("/api/patients", { name: "Bed Patient", age: 50, gender: "Female", phone: "9822200077" })).data;
    const adm = (await a.post("/api/ipd", { patientId: p.id, patientName: p.name, bedId: T.bedIds[3], doctorId: T.doctorId })).data;
    await T.users.doctor.post(`/api/ipd/${adm.id}/discharge`);
    const { context, page } = await T.users.nurse.browser(browser);
    const w = watch(page);
    await page.goto("/housekeeping");
    const card = page.locator("article", { hasText: "General Ward · G-04" }).first();
    await expect(card).toBeVisible();
    await expect(card.getByText("Bed turnaround")).toBeVisible();
    await card.getByRole("button", { name: "Start" }).click();
    await expect(page.locator("section[aria-label='In progress']").getByText("General Ward · G-04")).toBeVisible();
    await page.locator("section[aria-label='In progress']").locator("article", { hasText: "G-04" }).getByRole("button", { name: /^Complete/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Mark complete" }).click();
    await expect(page.locator("section[aria-label='Completed']").getByText("General Ward · G-04")).toBeVisible();
    await page.locator("section[aria-label='Completed']").locator("article", { hasText: "G-04" }).getByRole("button", { name: /^Verify/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Verify" }).click();
    await expect(page.locator("article", { hasText: "General Ward · G-04" })).toHaveCount(0);
    await page.getByRole("tab", { name: "Room readiness" }).click();
    await expect(page.locator("main").getByText(/beds ready/)).toBeVisible();
    expect((await T.users.nurse.get("/api/housekeeping")).data.rooms.find((r: any) => r.id === T.bedIds[3]).state).toBe("Ready");
    expect(w.problems).toEqual([]);
    await context.close();
  });
});
