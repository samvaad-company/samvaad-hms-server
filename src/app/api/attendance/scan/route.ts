import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { readJson } from "@/server/http/query";
import { ok } from "@/server/http/response";
import { requireSession } from "@/server/auth/server";
import { scanAttendance } from "@/server/services/attendance-service";

/**
 * Any signed-in hospital user may punch *themselves* — the QR token proves
 * they're at the reception screen and the service checks their GPS against
 * the geofence, so this deliberately isn't gated behind the staff RBAC.
 */
export const POST = withRoute(async (req: NextRequest) => {
  const session = await requireSession();
  return ok(await scanAttendance(await readJson(req), session));
});
