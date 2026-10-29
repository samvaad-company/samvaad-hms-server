import { itemRoute } from "@/http/crud";
import { updateFolder, deleteFolder } from "@/services/mrd-documents-service";

export const { PUT, PATCH, DELETE } = itemRoute({ resource: "mrd", update: updateFolder, remove: deleteFolder });
