import { collectionRoute } from "@/server/http/crud";
import {
  listPurchaseOrders,
  createPurchaseOrder,
  PO_LIST_CONFIG,
} from "@/server/services/pharmacy-orders-service";

export const { GET, POST } = collectionRoute({
  resource: "pharmacy",
  listConfig: PO_LIST_CONFIG,
  list: listPurchaseOrders,
  create: createPurchaseOrder,
});
