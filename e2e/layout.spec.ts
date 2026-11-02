import { expect, test } from "./support/test";

/**
 * Every section leaves room between the top bar and its first content (a page that starts flush against the bar looks cramped).
 * The standard is the 16px the shared page header uses; anything under 12px fails.
 *
 * Not measured: the patient list (a split view whose panels pad their own content) and AI Chat (full-height, same), and
 * Appointments (its hidden side drawer is the first thing in the page, but its header uses the standard 16px).
 */
const SECTIONS = ["/home", "/opd", "/enquiries", "/followups", "/doctors", "/prescriptions", "/teleconsult", "/pharmacy", "/lab", "/radiology", "/tasks", "/ipd", "/nurse-station", "/checklists", "/ot", "/beds", "/blood-bank", "/housekeeping", "/dietary", "/waste", "/ambulance", "/records", "/inventory", "/cssd", "/pharmacy/dispense", "/file-tracking", "/documents", "/signatures", "/mrd", "/billing", "/finance", "/tpa", "/analytics", "/ai-monitor", "/reports", "/audit", "/hr", "/staff", "/attendance", "/hr/leave", "/hr/roster", "/hr/payroll", "/admin", "/settings", "/masters", "/hospital-setup", "/branches", "/whatsapp", "/plan", "/refer"];

const MIN_GAP = 12;

test.describe("Space below the top bar", () => {
  for (const href of SECTIONS) {
    test(`${href} doesn't touch the top bar`, async ({ page }) => {
      await page.goto(href);
      await expect(page.locator("main").first()).toBeVisible();
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      await page.waitForTimeout(300);
      const gap = await page.evaluate(() => {
        const main = document.querySelector("main")!;
        const top = main.getBoundingClientRect().top;
        let best = Infinity;
        for (const e of main.querySelectorAll("*")) {
          const b = e.getBoundingClientRect();
          if (b.width <= 20 || b.height <= 8) continue;
          const cs = getComputedStyle(e);
          const painted = cs.borderTopWidth !== "0px" || (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent") || (e.children.length === 0 && (e.textContent ?? "").trim().length > 0);
          if (painted && b.top < best) best = b.top;
        }
        return Math.round(best - top);
      });
      expect(gap, `the first thing on ${href} starts ${gap}px below the top bar`).toBeGreaterThanOrEqual(MIN_GAP);
    });
  }
});
