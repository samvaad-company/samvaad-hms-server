import { expect, test as setup } from "@playwright/test";
import { ADMIN } from "./support/accounts";

/** Sign in once through the real login form and keep the session for every other test. */
setup("sign in as the hospital admin", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill(ADMIN.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/home/);
  await page.context().storageState({ path: "e2e/.auth/admin.json" });
});
