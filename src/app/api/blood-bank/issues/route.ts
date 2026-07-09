import { collectionRoute } from "@/server/http/crud";
import {
  listIssues,
  createIssue,
  ISSUES_LIST_CONFIG,
} from "@/server/services/bloodbank-service";

export const { GET, POST } = collectionRoute({
  resource: "bloodbank",
  listConfig: ISSUES_LIST_CONFIG,
  list: listIssues,
  create: createIssue,
});
