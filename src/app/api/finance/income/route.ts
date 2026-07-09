import { collectionRoute } from "@/server/http/crud";
import {
  incomeService,
  FINANCE_LIST_CONFIG,
} from "@/server/services/finance-service";

export const { GET, POST } = collectionRoute({
  resource: "finance",
  listConfig: FINANCE_LIST_CONFIG,
  list: incomeService.list,
  create: incomeService.create,
});
