import { itemRoute } from "@/server/http/crud";
import {
  getVehicle,
  updateVehicle,
  deleteVehicle,
} from "@/server/services/ambulance-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "ambulance",
  get: getVehicle,
  update: updateVehicle,
  remove: deleteVehicle,
});
