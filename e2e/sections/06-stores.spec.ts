import { expect, sectionTests, switchTo } from "../support/sections";

sectionTests("Stores", [
  {
    name: "Inventory",
    href: "/inventory",
    heading: "Inventory",
    controls: ["Add Item", "Stock Items", "Issue Log", "All", "In Stock", "Low Stock", "Out of Stock"],
    steps: async (page) => { await switchTo(page, "Issue Log"); await switchTo(page, "Stock Items"); },
  },
  {
    name: "CSSD",
    href: "/cssd",
    heading: "CSSD",
    controls: ["Board", "Cycles", "Issues", "Settings"],
    steps: async (page) => { for (const tab of ["Cycles", "Issues", "Settings", "Board"]) await switchTo(page, tab); },
  },
  {
    name: "Dispense",
    href: "/pharmacy/dispense",
    heading: "Pharmacy",
    controls: ["No patient (OTC)", "Separate bill", "Add to patient's bill", "No bill", "Dispense"],
    texts: ["Recent dispensing"],
    steps: async (page) => {
      // Dispensing with nothing on the list is not offered.
      await expect(page.locator("main").getByRole("button", { name: /^Dispense$/ }).first()).toBeDisabled();
    },
  },
]);
