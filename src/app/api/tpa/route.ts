import { collectionRoute } from "@/server/http/crud";
import {
  listTpas,
  createTpa,
  TPA_LIST_CONFIG,
} from "@/server/services/tpa-service";

export const { GET, POST } = collectionRoute({
  resource: "tpa",
  listConfig: TPA_LIST_CONFIG,
  list: listTpas,
  create: createTpa,
});
