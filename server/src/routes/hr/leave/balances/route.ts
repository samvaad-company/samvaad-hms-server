import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { leaveBalances } from "@/services/hr-leave-service";

/** ?year=YYYY (defaults to this year). */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("hr", "read");
  return ok(await leaveBalances(new URL(req.url).searchParams.get("year"), session));
});
