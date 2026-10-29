import { collectionRoute } from "@/http/crud";
import { listCrossmatches, requestCrossmatch, CROSSMATCH_LIST_CONFIG } from "@/services/bloodbank-flow-service";

export const { GET, POST } = collectionRoute({
  resource: "bloodbank",
  listConfig: CROSSMATCH_LIST_CONFIG,
  list: listCrossmatches,
  create: requestCrossmatch,
});
