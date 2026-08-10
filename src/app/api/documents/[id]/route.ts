import { itemRoute } from "@/server/http/crud";
import {
  getDocumentRow,
  deleteDocument,
} from "@/server/services/documents-service";
import { toDocumentDTO } from "@/server/repositories/mappers";

export const { GET, DELETE } = itemRoute({
  resource: "documents",
  get: async (id) => toDocumentDTO(await getDocumentRow(id)),
  remove: deleteDocument,
});
