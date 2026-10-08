import { itemRoute } from "@/http/crud";
import { getOt, updateOt, deleteOt } from "@/services/ot-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "ot",
  get: getOt,
  update: updateOt,
  remove: deleteOt,
});
