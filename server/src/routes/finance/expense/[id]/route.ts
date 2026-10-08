import { itemRoute } from "@/http/crud";
import { expenseService } from "@/services/finance-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "finance",
  get: expenseService.get,
  update: expenseService.update,
  remove: expenseService.remove,
});
