import { collectionRoute } from "@/http/crud";
import { listRequests, createRequest, REQUESTS_LIST_CONFIG } from "@/services/mrd-files-service";

export const { GET, POST } = collectionRoute({ resource: "mrd", listConfig: REQUESTS_LIST_CONFIG, list: listRequests, create: createRequest });
