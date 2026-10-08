import { collectionRoute } from "@/http/crud";
import {
  listSales,
  createSale,
  SALES_LIST_CONFIG,
} from "@/services/pharmacy-orders-service";

export const { GET, POST } = collectionRoute({
  resource: "pharmacy",
  listConfig: SALES_LIST_CONFIG,
  list: listSales,
  create: createSale,
});
