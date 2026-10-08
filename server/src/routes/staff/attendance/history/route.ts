import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { attendanceHistory } from "@/services/attendance-service";

/** Punch log: ?from=YYYY-MM-DD&to=YYYY-MM-DD&staffId=N (defaults to the last 30 days, all staff). */
export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("staff", "read");
  const q = new URL(req.url).searchParams;
  const staffId = Number(q.get("staffId"));
  return ok(await attendanceHistory(
    { from: q.get("from"), to: q.get("to"), staffId: Number.isFinite(staffId) && staffId > 0 ? staffId : null },
    session,
  ));
});
