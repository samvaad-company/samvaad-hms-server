import { itemRoute } from "@/server/http/crud";
import { getOpd, updateOpd, deleteOpd } from "@/server/services/opd-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "opd",
  get: getOpd,
  update: updateOpd,
  remove: deleteOpd,
});
