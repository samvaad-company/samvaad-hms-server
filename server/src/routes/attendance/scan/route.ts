import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { scanAttendance } from "@/services/attendance-service";

/**
 * Any signed-in hospital user may punch *themselves* — the QR token proves
 * they're at the reception screen and the service checks their GPS against
 * the geofence, so this deliberately isn't gated behind the staff RBAC.
 */
export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requireSession();
  return ok(await scanAttendance(await readJson(req), session));
});
