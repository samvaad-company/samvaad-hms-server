import { collectionRoute } from "@/http/crud";
import {
  listIssues,
  createIssue,
  ISSUES_LIST_CONFIG,
} from "@/services/bloodbank-service";

export const { GET, POST } = collectionRoute({
  resource: "bloodbank",
  listConfig: ISSUES_LIST_CONFIG,
  list: listIssues,
  create: createIssue,
});
