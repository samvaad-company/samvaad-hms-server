import { collectionRoute } from "@/server/http/crud";
import { listPatients, createPatient, PATIENT_LIST_CONFIG } from "@/server/services/patients-service";

export const { GET, POST } = collectionRoute({
  resource: "patients",
  listConfig: PATIENT_LIST_CONFIG,
  list: listPatients,
  create: createPatient,
});
