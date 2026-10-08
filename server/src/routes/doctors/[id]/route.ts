import { itemRoute } from "@/http/crud";
import { getDoctor, updateDoctor, deleteDoctor } from "@/services/doctors-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "doctors",
  get: getDoctor,
  update: updateDoctor,
  remove: deleteDoctor,
});
