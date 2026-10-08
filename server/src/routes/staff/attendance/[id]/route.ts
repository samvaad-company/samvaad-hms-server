import { itemRoute } from "@/http/crud";
import { deleteAttendance } from "@/services/attendance-service";

export const { DELETE } = itemRoute({
  resource: "staff",
  remove: deleteAttendance,
});
