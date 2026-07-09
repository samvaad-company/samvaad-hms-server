import { itemRoute } from "@/server/http/crud";
import {
  getDonor,
  updateDonor,
  deleteDonor,
} from "@/server/services/bloodbank-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "bloodbank",
  get: getDonor,
  update: updateDonor,
  remove: deleteDonor,
});
