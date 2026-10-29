import { itemRoute } from "@/http/crud";
import { updateSterilizer } from "@/services/cssd-service";

export const { PUT, PATCH } = itemRoute({ resource: "cssd", update: updateSterilizer });
