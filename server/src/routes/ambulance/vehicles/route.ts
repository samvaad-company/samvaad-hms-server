import { collectionRoute } from "@/http/crud";
import {
  listVehicles,
  createVehicle,
  VEHICLES_LIST_CONFIG,
} from "@/services/ambulance-service";

export const { GET, POST } = collectionRoute({
  resource: "ambulance",
  listConfig: VEHICLES_LIST_CONFIG,
  list: listVehicles,
  create: createVehicle,
});
