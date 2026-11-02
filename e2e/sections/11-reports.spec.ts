import { expect, sectionTests, switchTo, control } from "../support/sections";

sectionTests("Reports", [
  {
    name: "Analytics",
    href: "/analytics",
    heading: "Analytics",
    controls: ["Refresh", "Dashboard", "Reports", "AI monitor", "Day", "Week", "Month"],
    texts: ["Trends", "Revenue (today)", "OPD (today)", "IPD & beds", "Pharmacy & lab"],
    steps: async (page) => {
      await switchTo(page, "Week");
      await expect(page.locator("main").getByText(/this week so far/).first()).toBeVisible();
      await switchTo(page, "Month");
      await expect(page.locator("main").getByText(/this month so far/).first()).toBeVisible();
      await switchTo(page, "Reports");
      await expect(page.locator("main").getByRole("button", { name: "Day book - OPD" })).toBeVisible();
      await switchTo(page, "AI monitor");
      await expect(page.locator("main").getByText("AI scribe").first()).toBeVisible();
      await switchTo(page, "Dashboard");
    },
  },
  {
    name: "AI monitor",
    href: "/ai-monitor",
    heading: "AI monitor",
    controls: ["7 days", "30 days", "90 days"],
    texts: ["Activity", "AI scribe", "AI chat", "WhatsApp bot"],
    steps: async (page) => { await switchTo(page, "7 days"); await switchTo(page, "90 days"); await switchTo(page, "30 days"); },
  },
  {
    name: "Reports",
    href: "/reports",
    heading: "Reports",
    controls: ["All", "Cashier & collection", "Billing & revenue", "OPD / IPD registers", "Clinical & diagnostic", "Accounts & statutory", "Patient retention", "Pharmacy & stores"],
    steps: async (page) => {
      await switchTo(page, "Pharmacy & stores");
      await expect(page.locator("main").getByRole("button", { name: "Low stock" })).toBeVisible();
      await switchTo(page, "All");
      await page.getByRole("textbox", { name: "Search reports" }).fill("day book");
      await expect(page.locator("main").getByRole("button", { name: /^Day book/ }).first()).toBeVisible();
      await expect(page.locator("main").getByRole("button", { name: "Low stock" })).toBeHidden();
      await page.getByRole("textbox", { name: "Search reports" }).fill("");
      await page.locator("main").getByRole("button", { name: "Collection report" }).click();
      await expect(page.locator("main").getByRole("heading", { name: "Collection report" })).toBeVisible();
      await expect(control(page, "CSV")).toBeVisible();
      await page.locator("main").getByRole("button", { name: /All reports/ }).click();
      await page.locator("main").getByRole("button", { name: "TDS register" }).click();
      await expect(page.locator("main").getByText(/TDS isn't deducted/)).toBeVisible();
    },
  },
  {
    name: "Audit",
    href: "/audit",
    heading: "Audit trail",
    controls: ["Verify chain", "CSV", "PDF", "Previous", "Next"],
    steps: async (page) => {
      await expect(page.locator("main").getByText(/Chain verified on/)).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Module" })).toBeVisible();
      await page.getByRole("textbox", { name: "Search the audit trail" }).fill("zzz-no-such-entry");
      await expect(page.locator("main").getByText("No entries match.")).toBeVisible();
      await page.getByRole("textbox", { name: "Search the audit trail" }).fill("");
      await control(page, "Verify chain").click();
      await expect(page.locator("main").getByText(/Chain verified on/)).toBeVisible();
    },
  },
]);
