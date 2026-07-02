import { itemRoute } from "@/server/http/crud";
import { getLab, updateLab, deleteLab } from "@/server/services/lab-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "lab",
  get: getLab,
  update: updateLab,
  remove: deleteLab,
});
