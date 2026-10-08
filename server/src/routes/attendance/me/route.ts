import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { myAttendance } from "@/services/attendance-service";

export const GET = withRoute(async () => {
  const session = await requireSession();
  return ok(await myAttendance(session), { headers: { "Cache-Control": "no-store" } });
});
