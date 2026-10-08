import { collectionRoute } from "@/http/crud";
import {
  listIpdNotes,
  createIpdNote,
  IPD_NOTES_LIST_CONFIG,
} from "@/services/ipd-care-service";

export const { GET, POST } = collectionRoute({
  resource: "ipd",
  listConfig: IPD_NOTES_LIST_CONFIG,
  list: listIpdNotes,
  create: createIpdNote,
});
