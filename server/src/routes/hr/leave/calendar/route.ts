import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { leaveCalendar } from "@/services/hr-leave-service";

/** ?month=YYYY-MM (defaults to this month). */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("hr", "read");
  return ok(await leaveCalendar(new URL(req.url).searchParams.get("month"), session));
});
