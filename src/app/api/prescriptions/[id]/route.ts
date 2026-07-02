import { itemRoute } from "@/server/http/crud";
import { getPrescription, updatePrescription, deletePrescription } from "@/server/services/prescriptions-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "prescriptions",
  get: getPrescription,
  update: updatePrescription,
  remove: deletePrescription,
});
