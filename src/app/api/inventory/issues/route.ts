import { collectionRoute } from "@/server/http/crud";
import {
  listIssues,
  createIssue,
  INVENTORY_ISSUES_LIST_CONFIG,
} from "@/server/services/inventory-service";

export const { GET, POST } = collectionRoute({
  resource: "inventory",
  listConfig: INVENTORY_ISSUES_LIST_CONFIG,
  list: listIssues,
  create: createIssue,
});
