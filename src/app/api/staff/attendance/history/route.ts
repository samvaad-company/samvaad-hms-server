import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { attendanceHistory } from "@/server/services/attendance-service";

/** Punch log: ?from=YYYY-MM-DD&to=YYYY-MM-DD&staffId=N (defaults to the last 30 days, all staff). */
export const GET = withRoute(async (req: NextRequest) => {
  const session = await requirePermission("staff", "read");
  const q = new URL(req.url).searchParams;
  const staffId = Number(q.get("staffId"));
  return ok(await attendanceHistory(
    { from: q.get("from"), to: q.get("to"), staffId: Number.isFinite(staffId) && staffId > 0 ? staffId : null },
    session,
  ));
});
