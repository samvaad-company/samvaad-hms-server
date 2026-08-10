import { collectionRoute } from "@/server/http/crud";
import {
  listSales,
  createSale,
  SALES_LIST_CONFIG,
} from "@/server/services/pharmacy-orders-service";

export const { GET, POST } = collectionRoute({
  resource: "pharmacy",
  listConfig: SALES_LIST_CONFIG,
  list: listSales,
  create: createSale,
});
