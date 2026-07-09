import { itemRoute } from "@/server/http/crud";
import {
  getRadiology,
  updateRadiology,
  deleteRadiology,
} from "@/server/services/radiology-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "radiology",
  get: getRadiology,
  update: updateRadiology,
  remove: deleteRadiology,
});
