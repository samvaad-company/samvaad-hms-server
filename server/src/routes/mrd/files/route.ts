import { collectionRoute } from "@/http/crud";
import { listFiles, createFile, FILES_LIST_CONFIG } from "@/services/mrd-files-service";

export const { GET, POST } = collectionRoute({ resource: "mrd", listConfig: FILES_LIST_CONFIG, list: listFiles, create: createFile });
