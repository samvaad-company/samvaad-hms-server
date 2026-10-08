import { collectionRoute } from "@/http/crud";
import {
  listDeaths,
  createDeath,
  DEATHS_LIST_CONFIG,
} from "@/services/records-service";

export const { GET, POST } = collectionRoute({
  resource: "records",
  listConfig: DEATHS_LIST_CONFIG,
  list: listDeaths,
  create: createDeath,
});
