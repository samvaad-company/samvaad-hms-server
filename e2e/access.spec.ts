import { expect, test } from "@playwright/test";
import { ADMIN, DOCTOR, RECEPTION } from "./support/accounts";

async function signIn(page: import("@playwright/test").Page, who: { email: string; password: string }) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(who.email);
  await page.locator('input[type="password"]').fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/(home|radiology|lab)/);
}
const link = (page: import("@playwright/test").Page, href: string) => page.locator(`a[href="${href}"]`).first();

test.describe("Who sees what", () => {
  test("a hospital admin sees every group, including Setup and Admin", async ({ page }) => {
    await signIn(page, ADMIN);
    for (const href of ["/opd", "/billing", "/hr/payroll", "/admin", "/masters", "/whatsapp"]) await expect(link(page, href), href).toBeVisible();
  });

  test("a doctor gets their own schedule and no Setup or payroll", async ({ page }) => {
    await signIn(page, DOCTOR);
    await expect(link(page, "/my-schedule")).toBeVisible();
    await expect(link(page, "/opd")).toBeVisible();
    for (const href of ["/masters", "/whatsapp", "/hr/payroll", "/admin"]) await expect(link(page, href), href).toHaveCount(0);
  });

  test("reception has no Setup, payroll or billing-only tools", async ({ page }) => {
    await signIn(page, RECEPTION);
    await expect(link(page, "/patients")).toBeVisible();
    for (const href of ["/masters", "/whatsapp", "/hr/payroll", "/admin"]) await expect(link(page, href), href).toHaveCount(0);
  });

  test("opening an admin-only page by address as a doctor shows who manages it, not the page", async ({ page }) => {
    await signIn(page, DOCTOR);
    await page.goto("/whatsapp");
    await expect(page.getByText("WhatsApp is managed by hospital administrators.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Connect with Facebook/ })).toHaveCount(0);
  });
});
