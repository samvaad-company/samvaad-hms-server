import { itemRoute } from "@/server/http/crud";
import {
  updateClaim,
  deleteClaim,
} from "@/server/services/tpa-service";

export const { PUT, PATCH, DELETE } = itemRoute({
  resource: "tpa",
  update: updateClaim,
  remove: deleteClaim,
});
