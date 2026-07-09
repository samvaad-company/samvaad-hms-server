import { itemRoute } from "@/server/http/crud";
import {
  getItem,
  updateItem,
  deleteItem,
} from "@/server/services/inventory-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "inventory",
  get: getItem,
  update: updateItem,
  remove: deleteItem,
});
