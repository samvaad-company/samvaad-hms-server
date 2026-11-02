import { expect, test } from "@playwright/test";

/** Pages a patient opens from a link — no staff sign-in. */
test.describe("Public pages", () => {
  test("a signing link that doesn't work says so to the patient — it never sends them to the staff sign-in", async ({ page }) => {
    await page.goto("/sign/not-a-real-token-0000000000000000");
    await expect(page.getByRole("heading", { name: "This link can't be opened" })).toBeVisible();
    await expect(page.getByText("Please ask the hospital to send you a new link.")).toBeVisible();
    await expect(page).toHaveURL(/\/sign\//);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test("the API's health check is open", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
  });

  test("a staff API is closed without a session", async ({ request }) => {
    const res = await request.get("/api/patients");
    expect(res.status()).toBe(401);
  });
});
