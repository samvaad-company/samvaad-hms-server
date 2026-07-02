import { itemRoute } from "@/server/http/crud";
import { getPatientDetail, updatePatient, deletePatient } from "@/server/services/patients-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "patients",
  get: getPatientDetail,
  update: updatePatient,
  remove: deletePatient,
});
