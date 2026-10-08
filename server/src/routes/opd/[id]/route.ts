import { itemRoute } from "@/http/crud";
import { getOpd, updateOpd, deleteOpd } from "@/services/opd-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "opd",
  get: getOpd,
  update: updateOpd,
  remove: deleteOpd,
});
