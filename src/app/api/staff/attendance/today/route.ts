import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { attendanceToday } from "@/server/services/attendance-service";

export const GET = withRoute(async () => {
  const session = await requirePermission("staff", "read");
  return ok(await attendanceToday(session), { headers: { "Cache-Control": "no-store" } });
});
