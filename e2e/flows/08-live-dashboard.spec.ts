/* eslint-disable @typescript-eslint/no-explicit-any -- API replies are untyped JSON in these tests */
import { expect, test, type Page } from "@playwright/test";
import { newHospital, type Tenant } from "./support/stack";

/**
 * Live dashboards: someone books an appointment and every dashboard open in that hospital shows it at once — nobody reloads,
 * nobody clicks. The server pushes it (GET /api/events/stream), the app puts it in its Redux store, the dashboard draws it.
 */
let T: Tenant;
test.beforeAll(async ({ playwright }) => { T = await newHospital(playwright, "Live"); });
test.afterAll(async () => { await T?.dispose(); });

const walkIn = (name: string, doctorId = T.doctorId) =>
  T.users.reception.post("/api/appointments", { patientName: name, doctorId, date: T.today, time: "10:00 AM", type: "Walk-in", reason: "check-up", status: "Today" });

/** Wait until the page says its live connection is up (the "Live" marker, not "Connecting…"). */
async function connected(page: Page) {
  await expect(page.getByText("Live", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
}

test("the hospital admin's dashboard shows a new appointment the moment it is booked, and counts it once", async ({ browser }) => {
  const { context, page } = await T.users.admin.browser(browser);
  await page.goto("/home");
  await connected(page);
  await expect(page.getByText("No appointments scheduled for today.").first()).toBeVisible();

  const made = await walkIn("Live Walk-in One");
  expect(made.status).toBe(201);
  const card = page.locator("section", { hasText: "Appointments today" }).first();
  await expect(card.getByText("Live Walk-in One")).toBeVisible({ timeout: 10_000 });
  await expect(card.getByText("New", { exact: true })).toBeVisible();
  await expect(card).toContainText("1 booked");

  // A second one: two in the list, two counted (the refresh that follows must not double the pushed one).
  await walkIn("Live Walk-in Two");
  await expect(card.getByText("Live Walk-in Two")).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1500); // let the follow-up refresh land
  await expect(card).toContainText("2 booked");
  await expect(card.getByText("Live Walk-in One")).toHaveCount(1);
  await context.close();
});

test("the receptionist's dashboard shows it too, and a booking made after a dropped connection is caught up", async ({ browser }) => {
  const { context, page } = await T.users.reception.browser(browser);
  await page.goto("/home");
  await connected(page);
  await walkIn("Live Front Desk");
  await expect(page.getByText("Live Front Desk").first()).toBeVisible({ timeout: 10_000 });

  // The connection drops: the page says so, and what happens meanwhile shows up once it is back.
  await context.setOffline(true);
  await expect(page.getByText("Reconnecting…").first()).toBeVisible({ timeout: 30_000 });
  await walkIn("Booked While Offline");
  await context.setOffline(false);
  await expect(page.getByText("Booked While Offline").first()).toBeVisible({ timeout: 60_000 });
  await context.close();
});

test("a doctor's dashboard shows only their own new appointments", async ({ browser }) => {
  const other = await T.users.admin.post("/api/doctors", { name: "Dr. Other Person", specialty: "ENT", departmentId: T.departmentId, phone: "9811100002" });
  expect(other.status).toBe(201);
  const { context, page } = await T.users.doctor.browser(browser);
  await page.goto("/home");
  await connected(page);

  await walkIn("For Another Doctor", other.data.id);
  await walkIn("For The Signed In Doctor");
  await expect(page.getByText("For The Signed In Doctor").first()).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  await expect(page.getByText("For Another Doctor")).toHaveCount(0);
  await context.close();
});

test("someone without access to appointments opens no stream", async ({ browser }) => {
  const { context, page } = await T.users.pharmacist.browser(browser);
  const streams: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/events/stream")) streams.push(r.url()); });
  await page.goto("/home");
  await page.waitForTimeout(2500);
  expect(streams).toEqual([]);
  await context.close();
});
