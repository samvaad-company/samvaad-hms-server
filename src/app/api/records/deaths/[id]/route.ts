import { itemRoute } from "@/server/http/crud";
import {
  getDeath,
  updateDeath,
  deleteDeath,
} from "@/server/services/records-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "records",
  get: getDeath,
  update: updateDeath,
  remove: deleteDeath,
});
