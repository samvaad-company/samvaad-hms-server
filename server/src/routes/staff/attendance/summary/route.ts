import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { attendanceSummary } from "@/services/attendance-service";

/** Monthly register: ?month=YYYY-MM (defaults to the current month). */
export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("staff", "read");
  return ok(await attendanceSummary(new URL(req.url).searchParams.get("month"), session));
});
