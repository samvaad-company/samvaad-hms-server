import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getTeam } from "@/services/training-service";

/** How everyone is getting on, against the lessons recommended to their role. For people who manage staff. */
export const GET = withRoute(async () => ok(await getTeam(await requirePermission("staff", "write"))));
