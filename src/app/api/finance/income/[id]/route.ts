import { itemRoute } from "@/server/http/crud";
import { incomeService } from "@/server/services/finance-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "finance",
  get: incomeService.get,
  update: incomeService.update,
  remove: incomeService.remove,
});
