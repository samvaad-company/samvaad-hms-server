import { itemRoute } from "@/http/crud";
import { incomeService } from "@/services/finance-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "finance",
  get: incomeService.get,
  update: incomeService.update,
  remove: incomeService.remove,
});
