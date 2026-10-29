import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { hrOverview } from "@/services/hr-overview-service";

export const GET = withRoute(async () => ok(await hrOverview(await requirePermission("hr", "read"))));
