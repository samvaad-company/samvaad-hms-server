import { itemRoute } from "@/server/http/crud";
import { getAppointment, updateAppointment, deleteAppointment } from "@/server/services/appointments-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "appointments",
  get: getAppointment,
  update: updateAppointment,
  remove: deleteAppointment,
});
