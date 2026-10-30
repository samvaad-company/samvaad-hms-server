import { expect, sectionTests, switchTo } from "../support/sections";

sectionTests("Finance", [
  {
    name: "Billing",
    href: "/billing",
    heading: "Billing",
    controls: ["All Bills", "New Bill", "Bill Lookup", "Payouts", "All"],
    steps: async (page) => {
      await switchTo(page, "New Bill", "Line Items");
      await expect(page.locator("main").getByText("Generate Bill").first()).toBeVisible();
      await switchTo(page, "Payouts", "Owed (pending)");
      await expect(page.locator("main").getByText("By payee").first()).toBeVisible();
      await switchTo(page, "Bill Lookup");
      await switchTo(page, "All Bills");
    },
  },
  {
    name: "Income & Expense",
    href: "/finance",
    heading: "Income & Expense",
    controls: ["Add Income", "Income", "Expenses", "All"],
    steps: async (page) => { await switchTo(page, "Expenses"); await switchTo(page, "Income"); },
  },
  {
    name: "TPA / Insurance",
    href: "/tpa",
    heading: "TPA / Insurance",
    controls: ["Submit Claim", "Claims", "TPA Master", "All", "Submitted", "In Review", "Approved"],
    steps: async (page) => { await switchTo(page, "TPA Master"); await switchTo(page, "Claims"); },
  },
]);
