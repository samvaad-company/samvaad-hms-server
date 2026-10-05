import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requireSession } from "@/server/auth/server";
import { myAttendance } from "@/server/services/attendance-service";

export const GET = withRoute(async () => {
  const session = await requireSession();
  return ok(await myAttendance(session), { headers: { "Cache-Control": "no-store" } });
});
