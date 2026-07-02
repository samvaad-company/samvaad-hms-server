import { itemRoute } from "@/server/http/crud";
import { getPharmacyItem, updatePharmacyItem, deletePharmacyItem } from "@/server/services/pharmacy-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "pharmacy",
  get: getPharmacyItem,
  update: updatePharmacyItem,
  remove: deletePharmacyItem,
});
