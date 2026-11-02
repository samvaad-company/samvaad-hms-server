import { expect, sectionTests, switchTo } from "../support/sections";

sectionTests("Overview", [
  {
    name: "Home — the command dashboard",
    href: "/home",
    heading: /^Good (morning|afternoon|evening), \w+/,
    texts: ["Needs you today", "Footfall & collections", "Collections by mode", "Appointments today", "Beds by class", "Doctor load", "Patient retention", "Needs your attention", "OPD queue", "Operating theatre"],
    controls: ["7d", "14d", "30d", "Register", "Book", "Walk-in", "Admit"],
    steps: async (page) => {
      // The four "needs you today" cards and the four week tiles.
      for (const card of ["Waiting in OPD", "Urgent lab orders", "Unpaid bills", "Claims to submit", "Patients · week", "Collected · week", "Bed occupancy"]) {
        await expect(page.locator("main").getByText(card, { exact: true }).first()).toBeVisible();
      }
      await switchTo(page, "30d", "last 30 days");
      await switchTo(page, "7d", "last 7 days");
      // The chart is drawn from real days: the last one is today.
      await expect(page.getByRole("img", { name: /Footfall and collections trend/ })).toBeVisible();
    },
  },
  {
    name: "AI Chat",
    href: "/chat",
    heading: "AI Chat",
    controls: ["New Chat"],
  },
]);
