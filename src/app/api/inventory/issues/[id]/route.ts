import { itemRoute } from "@/server/http/crud";
import { deleteIssue } from "@/server/services/inventory-service";

export const { DELETE } = itemRoute({
  resource: "inventory",
  remove: deleteIssue,
});
