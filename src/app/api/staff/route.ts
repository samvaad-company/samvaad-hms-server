import { collectionRoute } from "@/server/http/crud";
import { listStaff, createStaff, STAFF_LIST_CONFIG } from "@/server/services/staff-service";

export const { GET, POST } = collectionRoute({
  resource: "staff",
  listConfig: STAFF_LIST_CONFIG,
  list: listStaff,
  create: createStaff,
});
