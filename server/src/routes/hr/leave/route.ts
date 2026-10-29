import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listLeaveRequests, requestLeave } from "@/services/hr-leave-service";

/** ?status=Pending|Approved|…  &staffId=  &month=YYYY-MM */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("hr", "read");
  const q = new URL(req.url).searchParams;
  const staffId = Number(q.get("staffId"));
  return ok(await listLeaveRequests(session, {
    status: q.get("status") || undefined,
    staffId: Number.isInteger(staffId) && staffId > 0 ? staffId : undefined,
    month: q.get("month") || undefined,
  }));
});

export const POST = withRoute(async (req) => {
  const session = await requirePermission("hr", "write");
  return created(await requestLeave(await readJson(req), session));
});
