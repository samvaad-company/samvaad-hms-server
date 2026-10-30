import { dialogOpensAndCloses, expect, sectionTests, switchTo } from "../support/sections";

sectionTests("Admin", [
  {
    name: "Admin Panel",
    href: "/admin",
    heading: "Admin Panel",
    controls: ["Settings", "Master Data", "Users", "Radiology Links", "Lab Links"],
    steps: async (page) => { await switchTo(page, "Users"); await switchTo(page, "Master Data"); await switchTo(page, "Settings"); },
  },
]);

sectionTests("Setup", [
  {
    name: "Settings",
    href: "/settings",
    heading: "Settings",
    controls: ["Data import", "Profile & branding", "Billing", "Notifications", "Security", "Appearance", "Protocols"],
    texts: ["Clinic profile"],
    steps: async (page) => { await switchTo(page, "Billing"); await switchTo(page, "Notifications"); await switchTo(page, "Security"); await switchTo(page, "Profile & branding"); },
  },
  {
    name: "Masters",
    href: "/masters",
    heading: "Masters",
    controls: ["Services", "Rate plans", "Packages", "Tax & GST", "Sponsors & contracts", "Payer classes", "Payments & banks"],
    steps: async (page) => { await switchTo(page, "Rate plans"); await switchTo(page, "Packages"); await switchTo(page, "Services"); },
  },
  {
    name: "Hospital setup",
    href: "/hospital-setup",
    heading: "Hospital Setup",
    controls: ["Identity & branches", "Charges & posting", "Clinical policies"],
    texts: ["Identity, statutory & billing", "Financial year", "Registrations & licences"],
    steps: async (page) => { await switchTo(page, "Charges & posting"); await switchTo(page, "Clinical policies"); await switchTo(page, "Identity & branches"); },
  },
  {
    name: "Branches",
    href: "/branches",
    heading: "Branches",
    controls: ["Add branch"],
    steps: async (page) => { await dialogOpensAndCloses(page, "Add branch"); },
  },
  {
    name: "WhatsApp",
    href: "/whatsapp",
    heading: "WhatsApp",
    texts: ["Connection"],
    steps: async (page) => {
      // Not connected on a fresh hospital: both ways to connect are offered. A connected one shows its number and settings instead.
      const connected = await page.locator("main").getByText("Connected", { exact: true }).first().isVisible().catch(() => false);
      if (connected) { await expect(page.locator("main").getByText("Webhook", { exact: true }).first()).toBeVisible(); return; }
      await expect(page.locator("main").getByRole("button", { name: /Connect with Facebook/ })).toBeVisible();
      await page.locator("main").getByRole("button", { name: /Enter details manually/ }).click();
      await expect(page.getByText("Connect WhatsApp by hand")).toBeVisible();
      await expect(page.getByRole("button", { name: /Check and save/ })).toBeDisabled();
      await page.getByRole("button", { name: /^Cancel$/ }).click();
      await expect(page.getByText("Connect WhatsApp by hand")).toBeHidden();
    },
  },
  {
    name: "Plan & licence",
    href: "/plan",
    heading: "Plan & licence",
    texts: ["Plan", "In use"],
    controls: ["Edit"],
  },
  {
    name: "Refer & earn",
    href: "/refer",
    heading: "Refer & earn",
    texts: ["Your referral code", "Who you have referred"],
    controls: ["Copy message", "Edit"],
  },
]);
