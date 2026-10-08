import { collectionRoute } from "@/http/crud";
import { listBills, createBill, BILLING_LIST_CONFIG } from "@/services/billing-service";

export const { GET, POST } = collectionRoute({
  resource: "billing",
  listConfig: BILLING_LIST_CONFIG,
  list: listBills,
  create: createBill,
});
