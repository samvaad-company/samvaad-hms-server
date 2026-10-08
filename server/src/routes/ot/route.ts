import { collectionRoute } from "@/http/crud";
import { listOt, scheduleOt, OT_LIST_CONFIG } from "@/services/ot-service";

export const { GET, POST } = collectionRoute({
  resource: "ot",
  listConfig: OT_LIST_CONFIG,
  list: listOt,
  create: scheduleOt,
});
