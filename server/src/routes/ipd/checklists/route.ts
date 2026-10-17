import { collectionRoute } from "@/http/crud";
import { listChecklists, startChecklist, CHECKLIST_LIST_CONFIG } from "@/services/checklists-service";

export const { GET, POST } = collectionRoute({
  resource: "nursing",
  listConfig: CHECKLIST_LIST_CONFIG,
  list: listChecklists,
  create: startChecklist,
});
