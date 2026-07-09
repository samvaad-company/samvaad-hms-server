import { collectionRoute } from "@/server/http/crud";
import {
  listCalls,
  createCall,
  CALLS_LIST_CONFIG,
} from "@/server/services/ambulance-service";

export const { GET, POST } = collectionRoute({
  resource: "ambulance",
  listConfig: CALLS_LIST_CONFIG,
  list: listCalls,
  create: createCall,
});
