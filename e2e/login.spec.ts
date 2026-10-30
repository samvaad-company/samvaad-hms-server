import { expect, test } from "@playwright/test";
import { ADMIN, PASSWORD } from "./support/accounts";

test.describe("Sign in", () => {
  test("the login page offers the form and the demo accounts", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Sign in to your hospital management account.")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  test("a wrong password is refused with a message and stays on the page", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("form").getByText(/invalid|incorrect|wrong|credentials|unable/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("the right password lands on the home dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/home/);
    await expect(page.getByRole("heading", { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
  });

  test("a page opened while signed out sends you to sign in, then back to it", async ({ page }) => {
    await page.goto("/billing");
    await expect(page).toHaveURL(/\/login\?next=%2Fbilling/);
    await page.locator('input[type="email"]').fill(ADMIN.email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/billing/);
    await expect(page.getByRole("heading", { name: "Billing" }).first()).toBeVisible();
  });
});
