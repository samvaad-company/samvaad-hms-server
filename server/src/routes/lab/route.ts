import { collectionRoute } from "@/http/crud";
import { listLab, createLab, LAB_LIST_CONFIG } from "@/services/lab-service";

export const { GET, POST } = collectionRoute({
  resource: "lab",
  listConfig: LAB_LIST_CONFIG,
  list: listLab,
  create: createLab,
});
