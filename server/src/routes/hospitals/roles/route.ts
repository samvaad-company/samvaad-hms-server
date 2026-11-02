import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { grantableRolesFor } from "@/services/hospitals-service";

/** The roles a platform admin can give a login in a hospital (for the role dropdown). */
export const GET = withRoute(async () => {
  return ok(grantableRolesFor(await requirePermission("admin", "read")));
});
