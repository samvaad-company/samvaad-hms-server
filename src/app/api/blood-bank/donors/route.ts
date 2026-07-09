import { collectionRoute } from "@/server/http/crud";
import {
  listDonors,
  createDonor,
  DONORS_LIST_CONFIG,
} from "@/server/services/bloodbank-service";

export const { GET, POST } = collectionRoute({
  resource: "bloodbank",
  listConfig: DONORS_LIST_CONFIG,
  list: listDonors,
  create: createDonor,
});
