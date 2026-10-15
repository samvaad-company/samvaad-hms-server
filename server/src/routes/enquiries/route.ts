import { collectionRoute } from "@/http/crud";
import { listEnquiries, createEnquiry, ENQUIRY_LIST_CONFIG } from "@/services/enquiries-service";

export const { GET, POST } = collectionRoute({
  resource: "enquiries",
  listConfig: ENQUIRY_LIST_CONFIG,
  list: listEnquiries,
  create: createEnquiry,
});
