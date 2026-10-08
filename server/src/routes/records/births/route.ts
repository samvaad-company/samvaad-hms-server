import { collectionRoute } from "@/http/crud";
import {
  listBirths,
  createBirth,
  BIRTHS_LIST_CONFIG,
} from "@/services/records-service";

export const { GET, POST } = collectionRoute({
  resource: "records",
  listConfig: BIRTHS_LIST_CONFIG,
  list: listBirths,
  create: createBirth,
});
