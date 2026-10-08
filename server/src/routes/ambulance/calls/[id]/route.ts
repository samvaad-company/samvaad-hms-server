import { itemRoute } from "@/http/crud";
import {
  updateCall,
  deleteCall,
} from "@/services/ambulance-service";

export const { PUT, PATCH, DELETE } = itemRoute({
  resource: "ambulance",
  update: updateCall,
  remove: deleteCall,
});
