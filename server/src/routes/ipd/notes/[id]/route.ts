import { itemRoute } from "@/http/crud";
import { updateIpdNote, deleteIpdNote } from "@/services/ipd-care-service";

export const { PUT, PATCH, DELETE } = itemRoute({
  resource: "ipd",
  update: updateIpdNote,
  remove: deleteIpdNote,
});
