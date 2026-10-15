import { itemRoute } from "@/http/crud";
import { getFollowUp, deleteFollowUp } from "@/services/followups-service";

export const { GET, DELETE } = itemRoute({
  resource: "followups",
  get: getFollowUp,
  remove: deleteFollowUp,
});
