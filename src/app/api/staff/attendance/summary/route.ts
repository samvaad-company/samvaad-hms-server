import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { attendanceSummary } from "@/server/services/attendance-service";

/** Monthly register: ?month=YYYY-MM (defaults to the current month). */
export const GET = withRoute(async (req: NextRequest) => {
  const session = await requirePermission("staff", "read");
  return ok(await attendanceSummary(new URL(req.url).searchParams.get("month"), session));
});
