import { itemRoute } from "@/http/crud";
import { getPrescription, updatePrescription, deletePrescription } from "@/services/prescriptions-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "prescriptions",
  get: getPrescription,
  update: updatePrescription,
  remove: deletePrescription,
});
