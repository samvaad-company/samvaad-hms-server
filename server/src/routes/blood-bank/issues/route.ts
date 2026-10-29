import { collectionRoute } from "@/http/crud";
import { listTransfusions, TRANSFUSION_LIST_CONFIG } from "@/services/bloodbank-flow-service";

/** Issues are created by issuing a compatible cross-match, never directly. */
export const { GET } = collectionRoute({
  resource: "bloodbank",
  listConfig: TRANSFUSION_LIST_CONFIG,
  list: listTransfusions,
});
