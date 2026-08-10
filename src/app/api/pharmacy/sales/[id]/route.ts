import { itemRoute } from "@/server/http/crud";
import { deleteSale } from "@/server/services/pharmacy-orders-service";

export const { DELETE } = itemRoute({
  resource: "pharmacy",
  remove: deleteSale,
});
