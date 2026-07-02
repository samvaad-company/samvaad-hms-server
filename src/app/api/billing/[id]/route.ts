import { itemRoute } from "@/server/http/crud";
import { getBill, updateBill, deleteBill } from "@/server/services/billing-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "billing",
  get: getBill,
  update: updateBill,
  remove: deleteBill,
});
