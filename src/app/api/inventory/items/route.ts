import { collectionRoute } from "@/server/http/crud";
import {
  listItems,
  createItem,
  ITEMS_LIST_CONFIG,
} from "@/server/services/inventory-service";

export const { GET, POST } = collectionRoute({
  resource: "inventory",
  listConfig: ITEMS_LIST_CONFIG,
  list: listItems,
  create: createItem,
});
