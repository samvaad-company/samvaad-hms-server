import { itemRoute } from "@/server/http/crud";
import { getSale, updateSale, deleteSale } from "@/server/services/pharmacy-orders-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "pharmacy",
  get: getSale,
  update: updateSale,
  remove: deleteSale,
});
