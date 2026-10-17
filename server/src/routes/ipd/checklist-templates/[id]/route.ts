import { itemRoute } from "@/http/crud";
import { updateTemplate, deleteTemplate } from "@/services/checklists-service";

export const { PUT, PATCH, DELETE } = itemRoute({ resource: "nursing", update: updateTemplate, remove: deleteTemplate });
