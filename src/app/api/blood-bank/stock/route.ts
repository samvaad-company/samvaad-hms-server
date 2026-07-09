import { collectionRoute } from "@/server/http/crud";
import {
  listStock,
  addStock,
  STOCK_LIST_CONFIG,
} from "@/server/services/bloodbank-service";

export const { GET, POST } = collectionRoute({
  resource: "bloodbank",
  listConfig: STOCK_LIST_CONFIG,
  list: listStock,
  create: addStock,
});
