import { itemRoute } from "@/server/http/crud";
import {
  updateCall,
  deleteCall,
} from "@/server/services/ambulance-service";

export const { PUT, PATCH, DELETE } = itemRoute({
  resource: "ambulance",
  update: updateCall,
  remove: deleteCall,
});
