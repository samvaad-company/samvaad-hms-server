import { itemRoute } from "@/http/crud";
import { getCodingCase, saveCoding } from "@/services/mrd-coding-service";

export const { GET, PUT, PATCH } = itemRoute({ resource: "mrd", get: getCodingCase, update: saveCoding });
