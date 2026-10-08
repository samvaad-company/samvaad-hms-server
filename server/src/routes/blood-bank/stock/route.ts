import { collectionRoute } from "@/http/crud";
import {
  listStock,
  addStock,
  STOCK_LIST_CONFIG,
} from "@/services/bloodbank-service";

export const { GET, POST } = collectionRoute({
  resource: "bloodbank",
  listConfig: STOCK_LIST_CONFIG,
  list: listStock,
  create: addStock,
});
