import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getAmbulanceDashboard } from "@/services/ambulance-service";

/** ?days=7|30|90 */
export const GET = withRoute(async (req) => ok(await getAmbulanceDashboard(Number(new URL(req.url).searchParams.get("days")), await requirePermission("ambulance", "read"))));
