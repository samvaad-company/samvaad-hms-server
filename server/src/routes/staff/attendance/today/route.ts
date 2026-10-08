import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { attendanceToday } from "@/services/attendance-service";

export const GET = withRoute(async () => {
  const session = await requirePermission("staff", "read");
  return ok(await attendanceToday(session), { headers: { "Cache-Control": "no-store" } });
});
