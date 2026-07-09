import { itemRoute } from "@/server/http/crud";
import { expenseService } from "@/server/services/finance-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "finance",
  get: expenseService.get,
  update: expenseService.update,
  remove: expenseService.remove,
});
