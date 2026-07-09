import { itemRoute } from "@/server/http/crud";
import { getTpa, updateTpa, deleteTpa } from "@/server/services/tpa-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "tpa",
  get: getTpa,
  update: updateTpa,
  remove: deleteTpa,
});
