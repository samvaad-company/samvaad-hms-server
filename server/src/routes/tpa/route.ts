import { collectionRoute } from "@/http/crud";
import {
  listTpas,
  createTpa,
  TPA_LIST_CONFIG,
} from "@/services/tpa-service";

export const { GET, POST } = collectionRoute({
  resource: "tpa",
  listConfig: TPA_LIST_CONFIG,
  list: listTpas,
  create: createTpa,
});
