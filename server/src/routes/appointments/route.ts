import { collectionRoute } from "@/http/crud";
import { listAppointments, createAppointment, APPOINTMENT_LIST_CONFIG } from "@/services/appointments-service";

export const { GET, POST } = collectionRoute({
  resource: "appointments",
  listConfig: APPOINTMENT_LIST_CONFIG,
  list: listAppointments,
  create: createAppointment,
});
