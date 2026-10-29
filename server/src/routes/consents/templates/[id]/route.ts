import { itemRoute } from "@/http/crud";
import { updateTemplate, deleteTemplate } from "@/services/consent-templates-service";

export const { PUT, PATCH, DELETE } = itemRoute({ resource: "consents", update: updateTemplate, remove: deleteTemplate });
