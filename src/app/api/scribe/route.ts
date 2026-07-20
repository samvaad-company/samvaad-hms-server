import { collectionRoute } from "@/server/http/crud";
import {
  listScribeNotes,
  createScribeNote,
  SCRIBE_LIST_CONFIG,
} from "@/server/services/scribe-service";

export const { GET, POST } = collectionRoute({
  resource: "scribe",
  listConfig: SCRIBE_LIST_CONFIG,
  list: listScribeNotes,
  create: createScribeNote,
});
