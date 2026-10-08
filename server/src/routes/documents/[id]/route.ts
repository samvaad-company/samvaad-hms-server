import { itemRoute } from "@/http/crud";
import {
  getDocumentRow,
  deleteDocument,
} from "@/services/documents-service";
import { toDocumentDTO } from "@/repositories/mappers";

export const { GET, DELETE } = itemRoute({
  resource: "documents",
  get: async (id, actor) => toDocumentDTO(await getDocumentRow(id, actor)),
  remove: deleteDocument,
});
