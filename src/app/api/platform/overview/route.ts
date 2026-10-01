import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { getPlatformOverview } from "@/server/services/hospitals-service";

export const GET = withRoute(async () => {
  const session = await requirePermission("admin", "read");
  return ok(await getPlatformOverview(session));
});
