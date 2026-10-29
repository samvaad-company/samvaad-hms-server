import { itemRoute } from "@/http/crud";
import { updatePolicy } from "@/services/mrd-documents-service";

export const { PUT, PATCH } = itemRoute({ resource: "mrd", update: updatePolicy });
