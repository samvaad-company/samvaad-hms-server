import { collectionRoute } from "@/http/crud";
import {
  listClaims,
  createClaim,
  CLAIMS_LIST_CONFIG,
} from "@/services/tpa-service";

export const { GET, POST } = collectionRoute({
  resource: "tpa",
  listConfig: CLAIMS_LIST_CONFIG,
  list: listClaims,
  create: createClaim,
});
