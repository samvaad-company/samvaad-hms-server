import { itemRoute } from "@/http/crud";
import {
  getRadiology,
  updateRadiology,
  deleteRadiology,
} from "@/services/radiology-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "radiology",
  get: getRadiology,
  update: updateRadiology,
  remove: deleteRadiology,
});
