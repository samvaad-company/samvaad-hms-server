import { itemRoute } from "@/server/http/crud";
import { getBed, updateBed, deleteBed } from "@/server/services/beds-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "beds",
  get: getBed,
  update: updateBed,
  remove: deleteBed,
});
