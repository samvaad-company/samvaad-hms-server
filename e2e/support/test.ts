import { expect, test as base } from "@playwright/test";

/**
 * `test` with a health check on every test: whatever a test does, a script error on the page or a 5xx answer from the API fails it,
 * so a section that opens but is quietly broken doesn't pass.
 */
export const test = base.extend<{ health: void }>({
  health: [async ({ page }, use) => {
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(`script error: ${e.message.slice(0, 200)}`));
    page.on("response", (r) => { if (r.status() >= 500) problems.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
    await use();
    expect(problems, "the page should have no script errors and the API no server errors").toEqual([]);
  }, { auto: true }],
});

export { expect };
