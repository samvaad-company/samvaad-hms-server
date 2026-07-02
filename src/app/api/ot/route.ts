import { collectionRoute } from "@/server/http/crud";
import { listOt, scheduleOt, OT_LIST_CONFIG } from "@/server/services/ot-service";

export const { GET, POST } = collectionRoute({
  resource: "ot",
  listConfig: OT_LIST_CONFIG,
  list: listOt,
  create: scheduleOt,
});
