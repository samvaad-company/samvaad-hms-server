import { itemRoute } from "@/http/crud";
import { deleteIssue } from "@/services/inventory-service";

export const { DELETE } = itemRoute({
  resource: "inventory",
  remove: deleteIssue,
});
