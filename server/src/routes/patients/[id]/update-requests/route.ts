import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import { listRequestsForStaff } from "@/services/portal-profile-service";

/** Staff: the changes this patient asked for in the patient portal, newest first. */
export const GET = withRoute(async (_req: ApiRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requirePermission("patients", "read");
  return ok(await listRequestsForStaff(parseId((await ctx.params).id), session));
});
