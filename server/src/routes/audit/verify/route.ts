import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { verifyChain } from "@/services/audit-trail-service";

/** Re-check the whole hash chain now. */
export const GET = withRoute(async () => ok(await verifyChain(await requirePermission("admin", "read"))));
