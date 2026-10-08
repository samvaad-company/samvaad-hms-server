import { itemRoute } from "@/http/crud";
import { getAppointment, updateAppointment, deleteAppointment } from "@/services/appointments-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "appointments",
  get: getAppointment,
  update: updateAppointment,
  remove: deleteAppointment,
});
