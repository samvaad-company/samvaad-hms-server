import { collectionRoute } from "@/server/http/crud";
import { listBeds, createBed, BEDS_LIST_CONFIG } from "@/server/services/beds-service";

export const { GET, POST } = collectionRoute({
  resource: "beds",
  listConfig: BEDS_LIST_CONFIG,
  list: listBeds,
  create: createBed,
});
