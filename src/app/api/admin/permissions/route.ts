import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { rolePermissionMatrix } from "@/server/services/admin-service";

/** The full RBAC role × resource matrix, for the admin permissions view. */
export const GET = withRoute(async () => {
  await requirePermission("admin", "read");
  return ok(rolePermissionMatrix());
});
