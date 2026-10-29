import { collectionRoute } from "@/http/crud";
import { listDonors, registerDonor, DONORS_LIST_CONFIG } from "@/services/bloodbank-service";

export const { GET, POST } = collectionRoute({
  resource: "bloodbank",
  listConfig: DONORS_LIST_CONFIG,
  list: listDonors,
  create: registerDonor,
});
