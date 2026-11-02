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

const toasts = (page: Page) => page.getByRole("status").filter({ hasText: "New appointment" });

test("a notification pops up for the admin when someone else books, says who booked it, and can be dismissed", async ({ browser }) => {
  const { context, page } = await T.users.admin.browser(browser);
  await page.goto("/home");
  await connected(page);
  await walkIn("Toast Patient One");
  const toast = toasts(page).filter({ hasText: "Toast Patient One" });
  await expect(toast).toBeVisible({ timeout: 10_000 });
  await expect(toast).toContainText("Dr. Asha Rao");
  await expect(toast).toContainText("booked by Receptionist (reception)");
  await expect(toast.getByRole("link", { name: /View appointments/ })).toHaveAttribute("href", "/appointments");
  await toast.getByRole("button", { name: "Dismiss" }).click();
  await expect(toast).toHaveCount(0);

  // Left alone, one goes away by itself.
  await walkIn("Toast Patient Two");
  const second = toasts(page).filter({ hasText: "Toast Patient Two" });
  await expect(second).toBeVisible({ timeout: 10_000 });
  await expect(second).toHaveCount(0, { timeout: 20_000 });
  await context.close();
});

test("the person who made the booking sees it in their list but isn't notified of their own booking", async ({ browser }) => {
  const { context, page } = await T.users.reception.browser(browser);
  await page.goto("/home");
  await connected(page);
  await walkIn("Booked By Me");
  await expect(page.getByText("Booked By Me").first()).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1000);
  await expect(toasts(page)).toHaveCount(0);
  await context.close();
});

test("a doctor is notified of their own new appointment and not of another doctor's", async ({ browser }) => {
  const other = await T.users.admin.post("/api/doctors", { name: "Dr. Notify Other", specialty: "ENT", departmentId: T.departmentId, phone: "9811100003" });
  expect(other.status).toBe(201);
  const { context, page } = await T.users.doctor.browser(browser);
  await page.goto("/home");
  await connected(page);

  await walkIn("Someone Elses Toast", other.data.id);
  await walkIn("My Own Toast");
  await expect(toasts(page).filter({ hasText: "My Own Toast" })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1000);
  await expect(toasts(page).filter({ hasText: "Someone Elses Toast" })).toHaveCount(0);
  await context.close();
});

test("roles other than the admin, the front desk and doctors open no stream and see no notification", async ({ browser }) => {
  for (const key of ["pharmacist", "nurse", "billing", "telecaller"] as const) {
    const { context, page } = await T.users[key].browser(browser);
    const streams: string[] = [];
    page.on("request", (r) => { if (r.url().includes("/api/events/stream")) streams.push(r.url()); });
    await page.goto("/home");
    await page.waitForTimeout(2000);
    await walkIn(`Not For ${key}`);
    await page.waitForTimeout(1000);
    expect(streams, `${key} shouldn't open the stream`).toEqual([]);
    await expect(toasts(page), `${key} shouldn't see a notification`).toHaveCount(0);
    await context.close();
  }
});
