import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { issueAttendanceQr } from "@/services/attendance-service";

/** The reception screen polls this for the next rotating QR. */
export const GET = withRoute(async () => {
  const session = await requirePermission("attendance", "write");
  return ok(await issueAttendanceQr(session), {
    headers: { "Cache-Control": "no-store" },
  });
});
