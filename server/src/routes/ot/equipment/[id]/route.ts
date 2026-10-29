import { itemRoute } from "@/http/crud";
import { updateEquipment, deleteEquipment } from "@/services/ot-resources-service";

export const { PUT, PATCH, DELETE } = itemRoute({ resource: "ot", update: updateEquipment, remove: deleteEquipment });
