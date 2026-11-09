/** ?search=&rank=basic|silver|gold|platinum|vip&status=Active|Inactive&page=&pageSize= — everyone in the programme, highest points first. */
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listMembers } from "@/services/loyalty-service";

export const GET = withRoute(async (req) => {
  const session = await requirePermission("admin", "read");
  return ok(await listMembers(new URL(req.url, "http://localhost").searchParams, session));
});
