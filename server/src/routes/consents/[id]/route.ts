import { itemRoute } from "@/http/crud";
import { getConsent, deleteConsent } from "@/services/consents-service";

export const { GET, DELETE } = itemRoute({ resource: "consents", get: getConsent, remove: deleteConsent });
