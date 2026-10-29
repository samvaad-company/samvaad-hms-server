import { itemRoute } from "@/http/crud";
import { updateLocation } from "@/services/mrd-files-service";

export const { PUT, PATCH } = itemRoute({ resource: "mrd", update: updateLocation });
