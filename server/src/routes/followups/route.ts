import { collectionRoute } from "@/http/crud";
import { listFollowUps, createFollowUp, FOLLOWUP_LIST_CONFIG } from "@/services/followups-service";

export const { GET, POST } = collectionRoute({
  resource: "followups",
  listConfig: FOLLOWUP_LIST_CONFIG,
  list: listFollowUps,
  create: createFollowUp,
});
