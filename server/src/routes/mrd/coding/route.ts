import { collectionRoute } from "@/http/crud";
import { listCodingCases, CODING_LIST_CONFIG } from "@/services/mrd-coding-service";

export const { GET } = collectionRoute({ resource: "mrd", listConfig: CODING_LIST_CONFIG, list: listCodingCases });
