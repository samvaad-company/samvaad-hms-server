import { collectionRoute } from "@/server/http/crud";
import {
  listIpdMedications,
  createIpdMedication,
  IPD_MEDS_LIST_CONFIG,
} from "@/server/services/ipd-care-service";

export const { GET, POST } = collectionRoute({
  resource: "ipd",
  listConfig: IPD_MEDS_LIST_CONFIG,
  list: listIpdMedications,
  create: createIpdMedication,
});
