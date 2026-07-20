import { itemRoute } from "@/server/http/crud";
import {
  getScribeNote,
  updateScribeNote,
  deleteScribeNote,
} from "@/server/services/scribe-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "scribe",
  get: getScribeNote,
  update: updateScribeNote,
  remove: deleteScribeNote,
});
