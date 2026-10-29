import { itemRoute } from "@/http/crud";
import { getFile } from "@/services/mrd-files-service";

export const { GET } = itemRoute({ resource: "mrd", get: getFile });
