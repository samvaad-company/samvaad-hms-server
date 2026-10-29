import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { dutyList } from "@/services/hr-roster-service";

/** ?date=YYYY-MM-DD (defaults to today). */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("hr", "read");
  return ok(await dutyList(new URL(req.url).searchParams.get("date"), session));
});
