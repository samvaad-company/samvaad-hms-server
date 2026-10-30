import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./test";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A button or tab in the page whose label starts with `label` (counts such as "Inventory14" are ignored). */
export function control(page: Page, label: string | RegExp): Locator {
  const name = typeof label === "string" ? new RegExp(`^${esc(label)}`) : label;
  const main = page.locator("main");
  return main.getByRole("tab", { name }).or(main.getByRole("button", { name })).or(main.getByRole("radio", { name })).or(main.getByRole("link", { name })).first();
}

export interface Section {
  /** Shown in the test name. */
  name: string;
  /** Where the sidebar link points. */
  href: string;
  /** The page's main heading (any level). */
  heading: string | RegExp;
  /** Buttons / tabs / filters the section must show. */
  controls?: (string | RegExp)[];
  /** Other headings or text that must be on the page. */
  texts?: (string | RegExp)[];
  /** Extra things to do and check once the section is open. */
  steps?: (page: Page) => Promise<void>;
}

/** Sign in is already done (stored session): start at the home page, click the section in the sidebar, check it. */
export async function openFromSidebar(page: Page, href: string): Promise<void> {
  await page.goto("/home");
  const link = page.locator(`a[href="${href}"]`).first();
  await expect(link, `the sidebar should link to ${href}`).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${esc(href)}(/|\\?|$)`));
}

/** One test per section: reachable from the sidebar, its heading, its controls, and the section-specific steps. */
export function sectionTests(group: string, sections: Section[]): void {
  test.describe(group, () => {
    for (const s of sections) {
      test(`${s.name}`, async ({ page }) => {
        await openFromSidebar(page, s.href);
        await expect(page.locator("main").getByRole("heading", { name: s.heading }).first()).toBeVisible();
        for (const c of s.controls ?? []) await expect(control(page, c), `"${c}" should be on the page`).toBeVisible();
        for (const t of s.texts ?? []) await expect(page.locator("main").getByText(t).first(), `"${t}" should be on the page`).toBeVisible();
        await s.steps?.(page);
      });
    }
  });
}

/**
 * Open a dialog with `button`, check it appeared (its Cancel / Close control), then close it. The close control is looked for inside the
 * dialog when there is one, so a "Cancel" button elsewhere on the page (say, on a record) is never the one that gets clicked.
 */
export async function dialogOpensAndCloses(page: Page, button: string | RegExp, closeWith: RegExp = /^(Cancel|Close)$/): Promise<void> {
  await control(page, button).click();
  const dialog = page.getByRole("dialog");
  await dialog.or(page.getByRole("button", { name: closeWith }).first()).first().waitFor({ state: "visible" });
  const close = ((await dialog.count()) > 0 ? dialog.last() : page).getByRole("button", { name: closeWith }).first();
  await expect(close, "a dialog should open").toBeVisible();
  await close.click();
  await expect(close).toBeHidden();
}

/**
 * Switch to a tab, radio or filter: click it, then check it took — the text it is meant to bring up is on the page, or (with none
 * named) that it is still there and, if it reports a selected / checked / pressed state, that the state is on.
 */
export async function switchTo(page: Page, label: string | RegExp, shows?: string | RegExp): Promise<void> {
  const c = control(page, label);
  await c.click();
  if (shows) {
    await expect(page.locator("main").getByText(shows).first(), `"${shows}" should show after switching to "${label}"`).toBeVisible();
    return;
  }
  await expect(c).toBeVisible();
  const state = await c.evaluate((el) => el.getAttribute("aria-selected") ?? el.getAttribute("aria-checked") ?? el.getAttribute("aria-pressed"));
  if (state !== null) expect(state, `"${label}" should be the selected one`).toBe("true");
}

export { expect, test };
