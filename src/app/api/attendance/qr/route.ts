import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { issueAttendanceQr } from "@/server/services/attendance-service";

/** The reception screen polls this for the next rotating QR. */
export const GET = withRoute(async () => {
  const session = await requirePermission("attendance", "write");
  return ok(await issueAttendanceQr(session), {
    headers: { "Cache-Control": "no-store" },
  });
});
