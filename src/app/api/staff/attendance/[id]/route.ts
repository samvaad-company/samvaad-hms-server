import { itemRoute } from "@/server/http/crud";
import { deleteAttendance } from "@/server/services/attendance-service";

export const { DELETE } = itemRoute({
  resource: "staff",
  remove: deleteAttendance,
});
