import { itemRoute } from "@/http/crud";
import { getPatientDetail, updatePatient, deletePatient } from "@/services/patients-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "patients",
  get: getPatientDetail,
  update: updatePatient,
  remove: deletePatient,
});
