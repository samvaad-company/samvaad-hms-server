import { itemRoute } from "@/server/http/crud";
import { updateIpdNote, deleteIpdNote } from "@/server/services/ipd-care-service";

export const { PUT, PATCH, DELETE } = itemRoute({
  resource: "ipd",
  update: updateIpdNote,
  remove: deleteIpdNote,
});
