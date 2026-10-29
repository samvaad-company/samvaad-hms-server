import { itemRoute } from "@/http/crud";
import { getUnit } from "@/services/bloodbank-service";

export const { GET } = itemRoute({ resource: "bloodbank", get: getUnit });
