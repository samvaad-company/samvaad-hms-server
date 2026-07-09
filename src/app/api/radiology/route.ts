import { collectionRoute } from "@/server/http/crud";
import {
  listRadiology,
  createRadiology,
  RADIOLOGY_LIST_CONFIG,
} from "@/server/services/radiology-service";

export const { GET, POST } = collectionRoute({
  resource: "radiology",
  listConfig: RADIOLOGY_LIST_CONFIG,
  list: listRadiology,
  create: createRadiology,
});
