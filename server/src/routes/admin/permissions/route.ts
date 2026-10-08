import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { rolePermissionMatrix } from "@/services/admin-service";

/** The full RBAC role × resource matrix, for the admin permissions view. */
export const GET = withRoute(async () => {
  await requirePermission("admin", "read");
  return ok(rolePermissionMatrix());
});
