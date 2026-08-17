import { itemRoute } from "@/server/http/crud";
import {
  getDocumentRow,
  deleteDocument,
} from "@/server/services/documents-service";
import { toDocumentDTO } from "@/server/repositories/mappers";

export const { GET, DELETE } = itemRoute({
  resource: "documents",
  get: async (id, actor) => toDocumentDTO(await getDocumentRow(id, actor)),
  remove: deleteDocument,
});
