import { itemRoute } from "@/server/http/crud";
import {
  updateIssue,
  deleteIssue,
} from "@/server/services/bloodbank-service";

export const { PUT, PATCH, DELETE } = itemRoute({
  resource: "bloodbank",
  update: updateIssue,
  remove: deleteIssue,
});
