/** The supplier credit history: stock returned to suppliers and the credit used on later purchase bills. */
import { collectionRoute } from "@/http/crud";
import { listSupplierCredits, CREDIT_LIST_CONFIG } from "@/services/supplier-credit-service";

export const { GET } = collectionRoute({ resource: "pharmacy", listConfig: CREDIT_LIST_CONFIG, list: listSupplierCredits });
