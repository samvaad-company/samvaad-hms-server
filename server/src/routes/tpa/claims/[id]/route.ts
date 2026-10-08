import { itemRoute } from "@/http/crud";
import {
  updateClaim,
  deleteClaim,
} from "@/services/tpa-service";

export const { PUT, PATCH, DELETE } = itemRoute({
  resource: "tpa",
  update: updateClaim,
  remove: deleteClaim,
});
