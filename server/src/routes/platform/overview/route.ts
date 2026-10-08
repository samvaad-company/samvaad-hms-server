import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getPlatformOverview } from "@/services/hospitals-service";

export const GET = withRoute(async () => {
  const session = await requirePermission("admin", "read");
  return ok(await getPlatformOverview(session));
});
