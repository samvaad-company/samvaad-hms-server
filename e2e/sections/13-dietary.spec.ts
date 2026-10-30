import { expect, sectionTests, switchTo, control, dialogOpensAndCloses } from "../support/sections";

sectionTests("Dietary", [
  {
    name: "Dietary & kitchen",
    href: "/dietary",
    heading: "Dietary & kitchen",
    controls: ["Board", "Orders", "Kitchen", "Canteen", "Diets"],
    steps: async (page) => {
      await expect(page.locator("main").getByText(/active orders?/)).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Ward" })).toBeVisible();
      await switchTo(page, "Orders");
      await expect(control(page, "Active")).toBeVisible();
      await dialogOpensAndCloses(page, "New diet order");
      await switchTo(page, "Kitchen");
      await expect(page.locator("main").getByText("Ward sheets")).toBeVisible();
      await switchTo(page, "Canteen");
      await expect(page.locator("main").getByText("Menu", { exact: true })).toBeVisible();
      await dialogOpensAndCloses(page, "Menu item");
      await switchTo(page, "Diets");
      await expect(page.locator("main").getByText("Normal Regular Diet")).toBeVisible();
      await dialogOpensAndCloses(page, "New diet");
      await switchTo(page, "Board");
    },
  },
]);
