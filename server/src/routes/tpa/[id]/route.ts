import { itemRoute } from "@/http/crud";
import { getTpa, updateTpa, deleteTpa } from "@/services/tpa-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "tpa",
  get: getTpa,
  update: updateTpa,
  remove: deleteTpa,
});
