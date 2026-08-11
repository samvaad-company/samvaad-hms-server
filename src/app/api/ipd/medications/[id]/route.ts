import { itemRoute } from "@/server/http/crud";
import {
  updateIpdMedication,
  deleteIpdMedication,
} from "@/server/services/ipd-care-service";

export const { PUT, PATCH, DELETE } = itemRoute({
  resource: "ipd",
  update: updateIpdMedication,
  remove: deleteIpdMedication,
});
