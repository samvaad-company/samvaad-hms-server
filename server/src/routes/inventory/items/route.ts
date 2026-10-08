import { collectionRoute } from "@/http/crud";
import {
  listItems,
  createItem,
  ITEMS_LIST_CONFIG,
} from "@/services/inventory-service";

export const { GET, POST } = collectionRoute({
  resource: "inventory",
  listConfig: ITEMS_LIST_CONFIG,
  list: listItems,
  create: createItem,
});
