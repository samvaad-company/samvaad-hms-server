import { collectionRoute } from "@/server/http/crud";
import { listPrescriptions, createPrescription, RX_LIST_CONFIG } from "@/server/services/prescriptions-service";

export const { GET, POST } = collectionRoute({
  resource: "prescriptions",
  listConfig: RX_LIST_CONFIG,
  list: listPrescriptions,
  create: createPrescription,
});
