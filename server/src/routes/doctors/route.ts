import { collectionRoute } from "@/http/crud";
import { listDoctors, createDoctor, DOCTOR_LIST_CONFIG } from "@/services/doctors-service";

export const { GET, POST } = collectionRoute({
  resource: "doctors",
  listConfig: DOCTOR_LIST_CONFIG,
  list: listDoctors,
  create: createDoctor,
});
