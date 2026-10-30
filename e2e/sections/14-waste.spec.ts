import { expect, sectionTests, switchTo, control, dialogOpensAndCloses } from "../support/sections";

sectionTests("Waste & IC", [
  {
    name: "Waste & infection control",
    href: "/waste",
    heading: "Waste & infection control",
    controls: ["Print register", "Collection", "Disposal", "Infection control", "Dashboard"],
    steps: async (page) => {
      await expect(page.locator("main").getByText(/entries/).first()).toBeVisible();
      await dialogOpensAndCloses(page, "Log collection");
      await switchTo(page, "Disposal");
      await expect(page.locator("main").getByText("waiting for disposal").first()).toBeVisible();
      await dialogOpensAndCloses(page, "Log disposal");
      await switchTo(page, "Infection control");
      await expect(page.locator("main").getByText("Hand hygiene audits")).toBeVisible();
      await dialogOpensAndCloses(page, "Log infection");
      await dialogOpensAndCloses(page, "Log audit");
      await switchTo(page, "Dashboard");
      await expect(page.locator("main").getByText("Waste collected")).toBeVisible();
      await switchTo(page, "7 days"); await switchTo(page, "90 days"); await switchTo(page, "30 days");
      await expect(control(page, "30 days")).toBeVisible();
      await switchTo(page, "Collection");
    },
  },
]);
