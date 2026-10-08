import { itemRoute } from "@/http/crud";
import {
  updateIssue,
  deleteIssue,
} from "@/services/bloodbank-service";

export const { PUT, PATCH, DELETE } = itemRoute({
  resource: "bloodbank",
  update: updateIssue,
  remove: deleteIssue,
});
