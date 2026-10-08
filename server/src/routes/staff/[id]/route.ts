import { itemRoute } from "@/http/crud";
import { getStaff, updateStaff, deleteStaff } from "@/services/staff-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "staff",
  get: getStaff,
  update: updateStaff,
  remove: deleteStaff,
});
