import { collectionRoute } from "@/http/crud";
import { listUnits, collectUnit, UNITS_LIST_CONFIG } from "@/services/bloodbank-service";

export const { GET, POST } = collectionRoute({
  resource: "bloodbank",
  listConfig: UNITS_LIST_CONFIG,
  list: listUnits,
  create: collectUnit,
});
