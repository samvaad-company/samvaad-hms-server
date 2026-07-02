import { collectionRoute } from "@/server/http/crud";
import { listPharmacy, createPharmacyItem, PHARMACY_LIST_CONFIG } from "@/server/services/pharmacy-service";

export const { GET, POST } = collectionRoute({
  resource: "pharmacy",
  listConfig: PHARMACY_LIST_CONFIG,
  list: listPharmacy,
  create: createPharmacyItem,
});
