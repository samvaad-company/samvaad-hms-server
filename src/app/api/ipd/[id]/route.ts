import { itemRoute } from "@/server/http/crud";
import { getIpd, updateIpd, deleteIpd } from "@/server/services/ipd-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "ipd",
  get: getIpd,
  update: updateIpd,
  remove: deleteIpd,
});
