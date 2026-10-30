import { expect, sectionTests, switchTo, control, dialogOpensAndCloses } from "../support/sections";

sectionTests("Housekeeping", [
  {
    name: "Housekeeping",
    href: "/housekeeping",
    heading: "Housekeeping",
    controls: ["New task", "Tasks", "Room readiness", "Linen"],
    texts: ["Raised, no one on it yet", "The floor is cleaning", "Awaiting supervisor verify"],
    steps: async (page) => {
      await dialogOpensAndCloses(page, "New task");
      await switchTo(page, "Room readiness");
      await expect(page.locator("main").getByText(/beds ready/)).toBeVisible();
      await switchTo(page, "Linen");
      for (const a of ["New stock in", "Collect soiled", "Send to laundry", "Receive clean", "Issue to ward", "Discard / condemn", "Category"]) await expect(control(page, a)).toBeVisible();
      await expect(page.locator("main").getByText("Recent movements")).toBeVisible();
      await dialogOpensAndCloses(page, "Issue to ward");
      await switchTo(page, "Tasks");
    },
  },
]);
