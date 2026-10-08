import { itemRoute } from "@/http/crud";
import {
  updateIpdMedication,
  deleteIpdMedication,
} from "@/services/ipd-care-service";

export const { PUT, PATCH, DELETE } = itemRoute({
  resource: "ipd",
  update: updateIpdMedication,
  remove: deleteIpdMedication,
});
