import { itemRoute } from "@/server/http/crud";
import { getOt, updateOt, deleteOt } from "@/server/services/ot-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "ot",
  get: getOt,
  update: updateOt,
  remove: deleteOt,
});
