import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getDashboard } from "@/services/waste-ic-service";

/** ?days=7|30|90 */
export const GET = withRoute(async (req) => ok(await getDashboard(Number(new URL(req.url).searchParams.get("days")), await requirePermission("cssd", "read"))));
