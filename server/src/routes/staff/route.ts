import { collectionRoute } from "@/http/crud";
import { listStaff, createStaff, STAFF_LIST_CONFIG } from "@/services/staff-service";

export const { GET, POST } = collectionRoute({
  resource: "staff",
  listConfig: STAFF_LIST_CONFIG,
  list: listStaff,
  create: createStaff,
});
