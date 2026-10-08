import { itemRoute } from "@/http/crud";
import { getBed, updateBed, deleteBed } from "@/services/beds-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "beds",
  get: getBed,
  update: updateBed,
  remove: deleteBed,
});
