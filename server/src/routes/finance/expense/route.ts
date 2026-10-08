import { collectionRoute } from "@/http/crud";
import {
  expenseService,
  FINANCE_LIST_CONFIG,
} from "@/services/finance-service";

export const { GET, POST } = collectionRoute({
  resource: "finance",
  listConfig: FINANCE_LIST_CONFIG,
  list: expenseService.list,
  create: expenseService.create,
});
