import { itemRoute } from "@/http/crud";
import { getEnquiry, updateEnquiry, deleteEnquiry } from "@/services/enquiries-service";

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "enquiries",
  get: getEnquiry,
  update: updateEnquiry,
  remove: deleteEnquiry,
});
