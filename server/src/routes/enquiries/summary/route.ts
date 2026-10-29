import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getEnquirySummary } from "@/services/enquiries-service";

/** Lead counts per status, and how many are due for a call back today. */
export const GET = withRoute(async () => ok(await getEnquirySummary(await requirePermission("enquiries", "read"))));
