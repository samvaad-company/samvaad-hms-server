import { itemRoute } from "@/http/crud";
import {
  getDeath,
  updateDeath,
  deleteDeath,
} from "@/services/records-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "records",
  get: getDeath,
  update: updateDeath,
  remove: deleteDeath,
});
