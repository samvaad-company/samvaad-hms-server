import { collectionRoute } from "@/server/http/crud";
import { listIpd, admitPatient, IPD_LIST_CONFIG } from "@/server/services/ipd-service";

export const { GET, POST } = collectionRoute({
  resource: "ipd",
  listConfig: IPD_LIST_CONFIG,
  list: listIpd,
  create: admitPatient,
});
