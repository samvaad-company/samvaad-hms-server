import { collectionRoute } from "@/server/http/crud";
import { listAppointments, createAppointment, APPOINTMENT_LIST_CONFIG } from "@/server/services/appointments-service";

export const { GET, POST } = collectionRoute({
  resource: "appointments",
  listConfig: APPOINTMENT_LIST_CONFIG,
  list: listAppointments,
  create: createAppointment,
});
