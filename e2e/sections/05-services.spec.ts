import { control, dialogOpensAndCloses, expect, sectionTests, switchTo } from "../support/sections";

sectionTests("Services", [
  {
    name: "Blood Bank",
    href: "/blood-bank",
    heading: "Blood bank",
    controls: ["Stock", "Donors", "Cross-match", "Issues", "Registers", "Collect unit"],
    texts: ["Available inventory (ABO × Rh)"],
    steps: async (page) => { for (const tab of ["Donors", "Cross-match", "Issues", "Registers", "Stock"]) await switchTo(page, tab); },
  },
  {
    name: "Ambulance",
    href: "/ambulance",
    heading: "Ambulance",
    controls: ["Dispatch", "Calls", "Fleet", "Dashboard", "Open call"],
    texts: ["Fleet board", "Active calls"],
    steps: async (page) => {
      await dialogOpensAndCloses(page, "Open call");
      await switchTo(page, "Calls");
      for (const f of ["All", "Queued", "Dispatched", "At scene", "Transporting", "Completed", "Cancelled"]) await expect(control(page, f)).toBeVisible();
      await switchTo(page, "Fleet");
      await dialogOpensAndCloses(page, "Add vehicle");
      await switchTo(page, "Dashboard");
      await expect(page.locator("main").getByText("Avg dispatch time")).toBeVisible();
      await switchTo(page, "7 days"); await switchTo(page, "30 days");
      await switchTo(page, "Dispatch");
    },
  },
  {
    name: "Birth & Death",
    href: "/records",
    heading: "Birth & Death Records",
    controls: ["Register Birth", "Birth Records", "Death Records"],
    steps: async (page) => { await switchTo(page, "Death Records"); await switchTo(page, "Birth Records"); },
  },
]);
