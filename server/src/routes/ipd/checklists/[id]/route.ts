import { itemRoute } from "@/http/crud";
import { getChecklist } from "@/services/checklists-service";

export const { GET } = itemRoute({ resource: "nursing", get: getChecklist });
