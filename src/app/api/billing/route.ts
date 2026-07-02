import { collectionRoute } from "@/server/http/crud";
import { listBills, createBill, BILLING_LIST_CONFIG } from "@/server/services/billing-service";

export const { GET, POST } = collectionRoute({
  resource: "billing",
  listConfig: BILLING_LIST_CONFIG,
  list: listBills,
  create: createBill,
});
