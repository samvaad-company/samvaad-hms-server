import { collectionRoute } from "@/http/crud";
import {
  listIssues,
  createIssue,
  INVENTORY_ISSUES_LIST_CONFIG,
} from "@/services/inventory-service";

export const { GET, POST } = collectionRoute({
  resource: "inventory",
  listConfig: INVENTORY_ISSUES_LIST_CONFIG,
  list: listIssues,
  create: createIssue,
});
