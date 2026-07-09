import { itemRoute } from "@/server/http/crud";
import {
  getBirth,
  updateBirth,
  deleteBirth,
} from "@/server/services/records-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "records",
  get: getBirth,
  update: updateBirth,
  remove: deleteBirth,
});
