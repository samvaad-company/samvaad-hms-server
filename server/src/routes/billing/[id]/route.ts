import { itemRoute } from "@/http/crud";
import { getBill, updateBill, deleteBill } from "@/services/billing-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "billing",
  get: getBill,
  update: updateBill,
  remove: deleteBill,
});
