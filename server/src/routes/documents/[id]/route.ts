import { itemRoute } from "@/http/crud";
import {
  getDocumentRow,
  deleteDocument,
  updateDocument,
} from "@/services/documents-service";
import { toDocumentDTO } from "@/repositories/mappers";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "documents",
  get: async (id, actor) => toDocumentDTO(await getDocumentRow(id, actor)),
  update: updateDocument,
  remove: deleteDocument,
});
