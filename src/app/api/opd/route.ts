import { collectionRoute } from "@/server/http/crud";
import { listOpd, checkInOpd, OPD_LIST_CONFIG } from "@/server/services/opd-service";

export const { GET, POST } = collectionRoute({
  resource: "opd",
  listConfig: OPD_LIST_CONFIG,
  list: listOpd,
  create: checkInOpd,
});
