import { itemRoute } from "@/server/http/crud";
import {
  getPurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
} from "@/server/services/pharmacy-orders-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "pharmacy",
  get: getPurchaseOrder,
  update: (id, input, actor) =>
    updatePurchaseOrderStatus(id, String((input as { status?: string })?.status ?? ""), actor),
  remove: deletePurchaseOrder,
});
