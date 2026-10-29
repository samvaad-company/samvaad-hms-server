import { itemRoute } from "@/http/crud";
import { updateRoom, deleteRoom } from "@/services/ot-resources-service";

export const { PUT, PATCH, DELETE } = itemRoute({ resource: "ot", update: updateRoom, remove: deleteRoom });
