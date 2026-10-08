import { itemRoute } from "@/http/crud";
import {
  getVehicle,
  updateVehicle,
  deleteVehicle,
} from "@/services/ambulance-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "ambulance",
  get: getVehicle,
  update: updateVehicle,
  remove: deleteVehicle,
});
