import { collectionRoute } from "@/server/http/crud";
import {
  listDeaths,
  createDeath,
  DEATHS_LIST_CONFIG,
} from "@/server/services/records-service";

export const { GET, POST } = collectionRoute({
  resource: "records",
  listConfig: DEATHS_LIST_CONFIG,
  list: listDeaths,
  create: createDeath,
});
