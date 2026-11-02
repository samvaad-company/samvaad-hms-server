import { expect, test } from "../support/test";
import { openFromSidebar } from "../support/sections";
import { LESSONS } from "../../src/types/training";

/**
 * Plays every lesson through as the admin: each step must find what it points at, and the tour must reach its end. Progress is
 * intercepted so nothing is recorded against the real account.
 */
test.describe("Training", () => {
  test("the Training page lists lessons recommended to the role, with progress and search", async ({ page }) => {
    await page.route("**/api/training/progress", (r) => r.fulfill({ json: { data: null } }));
    await openFromSidebar(page, "/training");
    const main = page.locator("main");
    await expect(main.getByRole("heading", { name: "Training & tours" })).toBeVisible();
    await expect(main.getByRole("tab", { name: "My lessons" })).toBeVisible();
    await expect(main.getByRole("tab", { name: "Team progress" })).toBeVisible();
    await expect(main.getByText("Recommended for your role")).toBeVisible();
    await expect(main.getByText(/of \d+ recommended lessons done/)).toBeVisible();
    await main.getByRole("textbox", { name: "Search lessons" }).fill("leave");
    await expect(main.getByRole("heading", { name: "Apply for leave" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Billing" })).toBeHidden();
    await main.getByRole("tab", { name: "Team progress" }).click();
    await expect(main.getByText(/recommended lessons done/)).toBeVisible();
  });

  test("skipping a tour closes it without finishing", async ({ page }) => {
    await page.route("**/api/training/progress", (r) => r.fulfill({ json: { data: null } }));
    await openFromSidebar(page, "/training");
    await page.locator("main").getByRole("button", { name: /^Start Getting started/ }).click();
    const card = page.locator("[data-tour-card]");
    await expect(card).toContainText("1 of");
    await expect(card.getByRole("button", { name: "Skip tour" })).toBeVisible();
    await card.getByRole("button", { name: "Skip tour" }).click();
    await expect(card).toBeHidden();
  });

  for (const lesson of LESSONS) {
    test(`plays "${lesson.title}" from start to finish`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.route("**/api/training/progress", (r) => r.fulfill({ json: { data: null } }));
      await openFromSidebar(page, "/training");
      await page.locator("main").getByRole("button", { name: new RegExp(`^(Start|Continue|Replay) ${lesson.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).click();
      const card = page.locator("[data-tour-card]").first();
      for (let guard = 0; guard < 20; guard++) {
        await expect(card).toBeVisible();
        const title = await card.getByRole("heading").first().textContent();
        if ((await card.getAttribute("data-tour-targeted")) === "true") {
          await expect(page.locator("[data-tour-ring], [data-tour-missing]").first(), `step "${title}" should find its target`).toBeVisible({ timeout: 9_000 });
          expect(await page.locator("[data-tour-missing]").count(), `step "${title}" couldn't find what it points at`).toBe(0);
        }
        const last = (await card.getByRole("button", { name: /^Finish/ }).count()) > 0;
        await card.locator("[data-tour-next]").click();
        if (last) break;
        await page.waitForTimeout(450);
      }
      await expect(page.getByRole("dialog", { name: "Lesson finished" })).toBeVisible();
      await page.getByRole("button", { name: "Done for now" }).click();
      await expect(page.getByRole("dialog", { name: "Lesson finished" })).toBeHidden();
    });
  }
});
